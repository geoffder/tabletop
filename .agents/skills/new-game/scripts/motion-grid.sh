#!/usr/bin/env bash
# Sets real-time recordings of one motion side by side, labelled, cropped to where it happens and
# looping three times, and prints when each one moved, to confirm each plays at its stated speed.
# Usage: motion-grid.sh OUT.mp4 W:H:X:Y FROM_END LENGTH clip.webm "label" [clip.webm "label"]...
#   W:H:X:Y   the crop in page pixels; it is shown at twice that size.
#   FROM_END  seconds before each clip's end to start (motion-variant.mjs ends TAIL ms after the
#             action, so TAIL/1000 + 0.6 starts 0.6 s before it). Cut from the end: on a cold dev
#             server the video starts late, so times from the start of a recording drift.
#   LENGTH    seconds of each clip to keep.
set -euo pipefail
out=$1 crop=$2 from=$3 length=$4
shift 4
IFS=: read -r cw ch cx cy <<<"$crop"
w=$((cw * 2)) h=$((ch * 2))
font=$(fc-match -f '%{file}' 'DejaVu Sans:bold')
count=$(($# / 2))
columns=$(awk "BEGIN { c = int(sqrt($count)); if (c * c < $count) c++; print c }")
inputs=() filter="" stack="" layout=""
index=0
work=$(mktemp -d)
while [ $# -gt 0 ]; do
    clip=$1 label=$2
    shift 2
    ffmpeg -v error -y -sseof "-$from" -i "$clip" -t "$length" \
        -vf "crop=$cw:$ch:$cx:$cy,scale=$w:$h:flags=lanczos,fps=25" -an "$work/$index.mp4"
    # Frames that differ from the one before: the first run of them, up to four still frames,
    # gives the motion's length. It takes in fades around the motion (marks going and coming
    # back), so compare lengths between clips rather than with the timeline's.
    moved=$(ffmpeg -v error -i "$work/$index.mp4" \
        -vf "signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=-" -f null - 2>/dev/null |
        awk -F= '/YDIF/ {
                if (!done && $2 > 0.05) { if (first == "") first = n; last = n }
                if (first != "" && n - last >= 4) done = 1
                n++
            }
            END { printf "frames %s-%s, %.2f s", first, last, (last - first + 1) / 25 }')
    echo "$label: $moved"
    inputs+=(-i "$work/$index.mp4")
    # drawtext reads ' as a quote and : as an option break.
    text=${label//\'/}
    text=${text//:/\\:}
    filter+="[$index:v]drawtext=fontfile=$font:expansion=none:text='$text':x=12:y=12:fontsize=26:"
    filter+="fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8,loop=loop=2:size=$(awk "BEGIN { print int($length * 25) + 1 }")[v$index];"
    stack+="[v$index]"
    layout+="$((index % columns * w))_$((index / columns * h))|"
    index=$((index + 1))
done
if [ "$count" -eq 1 ]; then
    ffmpeg -v error -y "${inputs[@]}" -filter_complex "${filter%;}" -map "[v0]" \
        -c:v libx264 -pix_fmt yuv420p -r 25 "$out"
else
    ffmpeg -v error -y "${inputs[@]}" \
        -filter_complex "$filter${stack}xstack=inputs=$count:layout=${layout%|}:fill=black[out]" \
        -map "[out]" -c:v libx264 -pix_fmt yuv420p -r 25 "$out"
fi
rm -r "$work"
echo "$out"

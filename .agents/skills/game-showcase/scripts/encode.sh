#!/bin/bash
# Encodes each frame folder <out>/gifs/.<name>/ that showcase.mjs left into <out>/gifs/<name>.gif,
# every frame held for as long as it was on screen, then deletes the folder. Run on the host (the
# devcontainer has no ffmpeg): encode.sh <out>
set -euo pipefail
cd "$1/gifs"
shopt -s nullglob
for dir in .*/; do
  dir=${dir%/}
  [ "$dir" = . ] || [ "$dir" = .. ] && continue
  name=${dir#.}
  read -r crop width < <(python3 -c "import json; e = json.load(open('$dir/encode.json')); print(e['crop'], e['width'])")
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$dir/list.txt" -vf \
    "fps=30,crop=$crop,scale=$width:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle" \
    -loop 0 "$name.gif"
  rm -rf "$dir"
  echo "$name.gif $(du -h "$name.gif" | cut -f1) $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$name.gif") s"
done

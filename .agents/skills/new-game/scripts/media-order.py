# Usage: python3 media-order.py <slug>... (each slug is also its branch: zertz gipf yinsh dvonn lyngk)
# Lists rules inside @media blocks of games/<slug>-ui that a later rule outside the block, with the
# same selector and a shared property, overrides: equal specificity, so the media rule never applies.
import re
import subprocess
import sys

REPO = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True).stdout.strip()


def git(*args):
    return subprocess.run(['git', '-C', REPO, *args], capture_output=True, text=True).stdout


def style_files(branch):
    paths = git('ls-tree', '-r', '--name-only', branch, f'games/{branch}-ui/src').split()
    return [path for path in paths if path.endswith(('.svelte', '.css'))]


def properties(body):
    return {part.split(':')[0].strip() for part in body.split(';') if ':' in part}


def rules(css):
    """Yields (media query or None, selectors, properties, position), one level of @media deep."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    index = 0
    head_pattern = re.compile(r'\s*([^{}]+)\{')
    while index < len(css):
        match = head_pattern.match(css, index)
        if not match:
            index += 1
            continue
        head = match.group(1).strip()
        depth, end = 1, match.end()
        while end < len(css) and depth:
            depth += {'{': 1, '}': -1}.get(css[end], 0)
            end += 1
        body = css[match.end():end - 1]
        if head.startswith('@media'):
            for inner in re.finditer(r'([^{}]+)\{([^{}]*)\}', body):
                selectors = [s.strip() for s in inner.group(1).split(',')]
                yield head, selectors, properties(inner.group(2)), match.end() + inner.start()
        elif not head.startswith('@'):
            yield None, [s.strip() for s in head.split(',')], properties(body), match.start()
        index = end


for branch in sys.argv[1:]:
    for path in style_files(branch):
        text = git('show', f'{branch}:{path}')
        css = ''.join(re.findall(r'<style[^>]*>(.*?)</style>', text, flags=re.S)) if path.endswith('.svelte') else text
        found = list(rules(css))
        for media, selectors, props, position in found:
            if media is None:
                continue
            for selector in selectors:
                for other_media, other_selectors, other_props, other_position in found:
                    clash = props & other_props
                    if other_media is None and other_position > position and selector in other_selectors and clash:
                        print(f'{branch}: {path}: "{selector}" in {media} is overridden by a later rule: {sorted(clash)}')

#!/usr/bin/env bash
# Unpack a week's course materials and make text copies an agent can read.
#   tools/ingest.sh <zip or folder> <course> <week>      e.g. tools/ingest.sh ~/Downloads/cse332-w03.zip cse332 w03
# Result: materials/<course>/<week>/ holds the original files, plus text/ with a .txt for every PDF, slide deck,
# Word file and web page. Read text/ first; open a PDF or slide image only when its text is garbled.
set -euo pipefail
src=$1 course=$2 week=$3
root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/materials/$course/$week"
mkdir -p "$out/text"
if [[ -f $src && $src == *.zip ]]; then unzip -oq "$src" -d "$out"; else cp -r "$src"/. "$out/"; fi
find "$out" -path "$out/text" -prune -o -type f -print | while read -r f; do
  name=$(basename "${f%.*}")
  case "${f,,}" in
    *.pdf) pdftotext -layout "$f" "$out/text/$name.txt" ;;
    *.pptx|*.docx) python3 - "$f" "$out/text/$name.txt" <<'PY'
import sys, zipfile, re
src, dst = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(src)
names = sorted([n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)], key=lambda n: int(re.findall(r"\d+", n)[-1])) or ["word/document.xml"]
with open(dst, "w") as out:
    for i, n in enumerate(names, 1):
        xml = z.read(n).decode("utf8")
        text = re.sub(r"</a:p>|</w:p>", "\n", xml)
        text = re.sub(r"<[^>]+>", "", text)
        if n.startswith("ppt/"): out.write(f"--- slide {i} ---\n")
        out.write(re.sub(r"\n{3,}", "\n\n", text).strip() + "\n\n")
PY
    ;;
    *.html|*.htm|*.php) python3 -c 'import sys,html,re; t=open(sys.argv[1],errors="ignore").read(); t=re.sub(r"(?s)<(script|style).*?</\1>","",t); t=re.sub(r"<br\s*/?>|</p>|</li>|</h\d>|</tr>","\n",t); print(html.unescape(re.sub(r"\n\s*\n+","\n\n",re.sub(r"<[^>]+>","",t))).strip())' "$f" > "$out/text/$name.txt" ;;
    *.txt|*.md|*.java|*.py) cp "$f" "$out/text/$(basename "$f").txt" ;;
  esac
done
echo "$out"
ls "$out/text" | sed 's/^/  text\//'

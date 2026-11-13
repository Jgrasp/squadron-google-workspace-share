#!/usr/bin/env bash
set -euo pipefail
dir=$(cd "${1:?usage: serve-test.sh <dossier> [port]}" && pwd)
port=${2:-8765}
here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$dir/test"
python3 - "$dir/index.html" "$here/mock.js" "$dir/test/index.html" <<'PY'
import sys
html = open(sys.argv[1]).read()
mock = open(sys.argv[2]).read()
out = sys.argv[3]
if html.count("<head>") != 1:
    sys.exit("index.html : <head> absent ou en double")
open(out, "w").write(html.replace("<head>", "<head>\n<script>\n" + mock + "</script>", 1))
PY
cp "$dir/index.html" "$dir/test/local.html"
echo "http://localhost:$port/index.html?u=alice"
echo "http://localhost:$port/index.html?u=bob"
echo "http://localhost:$port/local.html"
exec python3 -m http.server "$port" --bind 127.0.0.1 --directory "$dir/test"

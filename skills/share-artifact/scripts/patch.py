import sys
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent


def blocks(path):
    out, cur, mode = [], None, None
    for line in path.read_text().split("\n"):
        tag = line.strip()
        if tag == "@@@ FIND":
            cur, mode = {"find": [], "replace": []}, "find"
        elif tag == "@@@ REPLACE":
            mode = "replace"
        elif tag == "@@@ END":
            out.append(cur)
            cur, mode = None, None
        elif tag.startswith("@@@ INCLUDE ") and mode == "replace":
            ref = tag[len("@@@ INCLUDE "):].strip()
            src = KIT / ref[4:] if ref.startswith("kit:") else path.parent / ref
            cur["replace"].append(src.read_text().rstrip("\n"))
        elif mode:
            cur[mode].append(line)
    if cur:
        sys.exit(f"{path}: block without @@@ END")
    return [("\n".join(b["find"]), "\n".join(b["replace"])) for b in out]


def apply(src, patch, dst):
    text = src.read_text()
    found = blocks(patch)
    for i, (find, repl) in enumerate(found, 1):
        n = text.count(find)
        if n != 1:
            sys.exit(f"block {i} found {n} times instead of once\n---\n{find[:300]}")
        text = text.replace(find, repl)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(text)
    return len(found)


def main():
    if len(sys.argv) != 4:
        sys.exit("usage: patch.py <source.html> <patch.txt> <out.html>")
    src, patch, dst = map(Path, sys.argv[1:])
    print(f"{dst}: {apply(src, patch, dst)} replacements")


if __name__ == "__main__":
    main()

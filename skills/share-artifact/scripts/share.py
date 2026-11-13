import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = ("Code.gs", "index.html", "appsscript.json")


def clasp():
    if shutil.which("clasp"):
        return ["clasp"]
    if shutil.which("npx"):
        return ["npx", "-y", "@google/clasp@3"]
    sys.exit("clasp is missing: npm i -g @google/clasp")


def run(args, cwd, quiet=False):
    done = subprocess.run(clasp() + args, cwd=cwd, capture_output=True, text=True)
    if done.returncode:
        sys.exit(f"clasp {' '.join(args)}: {done.stderr.strip() or done.stdout.strip()}")
    if not quiet:
        print(done.stdout.strip(), file=sys.stderr)
    return done.stdout


def logged_in(work):
    user = json.loads(run(["--json", "show-authorized-user"], work, quiet=True) or "{}")
    if not user.get("loggedIn"):
        sys.exit("clasp is not logged in: run clasp login in a terminal")
    return user.get("email") or ""


def link(dep, email):
    domain = email.split("@")[1] if "@" in email else ""
    if not domain or domain == "gmail.com":
        return f"https://script.google.com/macros/s/{dep}/exec"
    return f"https://script.google.com/a/macros/{domain}/s/{dep}/exec"


def state(work):
    file = work / "deploy.json"
    return json.loads(file.read_text()) if file.exists() else {}


def deployment_id(out):
    for word in out.replace('"', " ").split():
        if word.startswith("AKfyc"):
            return word.strip(",")
    sys.exit("clasp gave no deployment id")


def deploy(work, title, description):
    for name in FILES:
        if not (work / name).is_file():
            sys.exit(f"{work / name} is missing")
    email = logged_in(work)
    if not (work / ".clasp.json").exists():
        with tempfile.TemporaryDirectory() as tmp:
            run(["create", "--type", "webapp", "--title", title, "--rootDir", "."], tmp)
            script = json.loads((Path(tmp) / ".clasp.json").read_text())["scriptId"]
        (work / ".clasp.json").write_text(json.dumps({"scriptId": script, "rootDir": "build"}))
    build = work / "build"
    shutil.rmtree(build, ignore_errors=True)
    build.mkdir()
    for name in FILES:
        shutil.copy(work / name, build / name)
    run(["push", "-f"], work)
    known = state(work).get("deploymentId")
    out = run(["--json", "deploy", "-d", description] + (["-i", known] if known else []), work)
    dep = deployment_id(out)
    script = json.loads((work / ".clasp.json").read_text())["scriptId"]
    url = link(dep, email)
    (work / "deploy.json").write_text(json.dumps({"scriptId": script, "deploymentId": dep, "url": url, "title": title}, indent=2))
    print(url)


def update(work, source, description):
    sys.path.insert(0, str(HERE))
    from patch import apply

    apply(Path(source), work / "patch.txt", work / "index.html")
    deploy(work, state(work).get("title", work.name), description)


def stop(work, delete):
    known = state(work)
    if known.get("deploymentId"):
        logged_in(work)
        run(["undeploy", known["deploymentId"]], work)
    if delete and (work / ".clasp.json").exists():
        run(["delete-script", json.loads((work / ".clasp.json").read_text())["scriptId"], "--force"], work)
        (work / ".clasp.json").unlink()
    (work / "deploy.json").unlink(missing_ok=True)
    if delete:
        shutil.rmtree(work, ignore_errors=True)


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ("deploy", "update", "stop"):
        sys.exit("usage: share.py deploy <work> <title> [description] | update <work> <source> [description] | stop <work> [--delete]")
    verb, work = sys.argv[1], Path(sys.argv[2]).resolve()
    rest = sys.argv[3:]
    if verb == "deploy":
        deploy(work, rest[0] if rest else work.name, rest[1] if len(rest) > 1 else "Squadron")
    elif verb == "update":
        update(work, rest[0], rest[1] if len(rest) > 1 else "Squadron")
    else:
        stop(work, "--delete" in rest)


if __name__ == "__main__":
    main()

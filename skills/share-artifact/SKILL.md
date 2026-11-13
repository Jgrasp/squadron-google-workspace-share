---
name: share-artifact
description: Turns a Squadron html artifact that keeps its state in localStorage into a Google Apps Script web app shared with the accounts of the user's Google Workspace domain, with a common state synced between them. Use when Squadron's Share menu asks to share an artifact with the team.
context: fork
model: sonnet
background: false
---

# Share an artifact with the team on Google Workspace

Arguments: $ARGUMENTS

They give the artifact's id, title, folder and page, the work folder `W` and the Share menu destination. The user already agreed, in Squadron, to deploy the artifact from their Google account: do the whole share without asking anything. You cannot ask questions; Squadron shows the user your permission requests.

## Progress

Squadron's Artifacts panel shows your steps. At the start of each step below, call `mcp__squadron-pilot__set_progress` with `artifact` (the artifact's id), `total` 6, `done` (the steps already finished, 0 to 5) and `message` (the step's name, in the language of the artifact's page):

1. Checking the tools (section 0);
2. Reading the artifact (sections 1 and 2);
3. Writing the sync layer (section 3);
4. Writing the server (section 4);
5. Testing with two users (section 5);
6. Deploying (section 6).

When `set_progress` gives an error, go on without it.

## When it fails

Stop at the first step you cannot finish, without a workaround. Your last reply is then one sentence that says why and what the user does, such as “clasp is not logged in: run `! clasp login` in Squadron, then share again.” Squadron shows that sentence in the panel.

## The work

The result is a web app whose page is the artifact itself. Apps Script serves the page and keeps the shared state in its script properties. Only accounts of the user's Workspace domain can open it. Without `google`, the same page falls back to its own local mode.

`KIT` is the folder of this skill. Files:

| File | Role |
|---|---|
| `templates/sync.js`, `templates/sync.css` | the sync layer, included as is |
| `templates/Code.gs`, `templates/appsscript.json` | server and manifest |
| `scripts/patch.py` | applies exact replacements, stops when a string is not there exactly once |
| `scripts/mock.js`, `scripts/serve-test.sh` | fake `google.script.run`, two users in two tabs |
| `scripts/share.py` | deploy, update, stop with clasp |

## 0. Prerequisites

Check, and stop with a short message to the user when one is missing:

- `python3` runs;
- `clasp --version` gives 3.x, or `npx -y @google/clasp@3 --version` works. Ask before any `npm i -g @google/clasp`;
- `clasp --json show-authorized-user` says `"loggedIn": true`. Otherwise the user runs `clasp login` in a terminal (in Squadron: `! clasp login`), after turning on the Google Apps Script API at https://script.google.com/home/usersettings.

## 1. Set up W

```bash
mkdir -p W/kit && cp -r KIT/scripts KIT/templates W/kit/
cp <artifact dir>/<page> W/source.html
```

Squadron's Update button later runs `W/kit/scripts/share.py update`, which patches the artifact's current page with `W/patch.txt` and deploys again. Keep that layout. A page that loads other local files (CSS, scripts, images) must get them inlined by patch blocks, and Update only follows changes to the page itself: say so to the user.

## 2. Read the artifact

In its `<script>`, find:

- the `localStorage` key, the load code and `save()`;
- the shared unit: a map `id → object` (for instance `st.cases[id]`), its fields and their possible values. It gives `FIELDS`, the id regex and `clean()` on the server;
- what stays personal (URLs, preferences, filters): it stays in `localStorage` and never reaches the server;
- every place that changes the shared unit (click, checkbox, typing, import);
- the function that draws one element, its counters and totals;
- what depends on Squadron's sandbox: `/__squadron/theme.css`, `var(--x)` without a fallback, `navigator.clipboard`, `<meta>`.

When the shared state is not a map of independent elements (one big document, a list several people reorder), stop and tell the user this skill does not fit.

## 3. Write W/patch.txt

```
@@@ FIND
exact text of the artifact
@@@ REPLACE
replacement
@@@ INCLUDE kit:templates/sync.js
@@@ END
```

`@@@ INCLUDE` only goes in `REPLACE`; `kit:` paths start at `W/kit`. Make these changes:

1. **Theme**: replace `<link … /__squadron/theme.css>` with Google Fonts (DM Sans and DM Mono, or the page's fonts). Give a fallback to every `var(--x)` the page's `:root` does not define.
2. **CSS**: `@@@ INCLUDE kit:templates/sync.css` before `</style>`.
3. **Status line**: `<div class="sync" id="sync"></div>`, near Export/Import when there are such buttons.
4. **Adapters, then the sync layer**, right after the code that reads one element. `sync.js` expects:

   | Name | Contract |
   |---|---|
   | `FIELDS` | the shared fields, like `["done", "status", "note"]` |
   | `item(id)` | the element's state object, made when missing; it also gets `by` and `at` |
   | `idOf(el)` | the id of the element holding `el`, or `undefined` |
   | `renderItem(id)` | replaces that element's node only (`outerHTML`) |
   | `refresh()` | recomputes counters and totals without drawing everything again |
   | `patchWho(id)` | replaces the `whoHtml(item(id))` of the element's row |
   | `save()` | the page's own |

   Then `@@@ INCLUDE kit:templates/sync.js`. Rename on the page side any name `sync.js` defines (`remote`, `run`, `push`, `send`, `pull`, `apply`, `sync`, `copy`, `flush`, `pick`, `same`, `busy`, `hx`, `me`, `timers`, `inflight`, `dirty`, `whoHtml`, `startSync`).
5. **Author and time**: `${whoHtml(s)}` in an element's template, next to its title.
6. **Sending**: after each `save()` that changes a shared element, `push([id], 0)` for a click and `push([id], 800)` for typing.
7. **Import**: after a JSON import, `push(Object.keys(<map>), 0)`, in batches of 500 at most.
8. **Clipboard**: `navigator.clipboard.writeText(x)` becomes `copy(x)`.
9. **Start**: `startSync()` after the first drawing.
10. **Language**: when the page is not in English, define `const SYNC_TEXT = { local, error, unsent, refused, saving, upTo, connecting }` in the page's language before the include, with the same shapes as `SAY` in `sync.js` (`unsent`, `refused` and `upTo` are functions).

Never draw everything again on a pull: focus, typing and scrolling would be lost.

```bash
python3 W/kit/scripts/patch.py W/source.html W/patch.txt W/index.html
node -e 'const h=require("fs").readFileSync(process.argv[1],"utf8");for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g))new Function(m[1])' W/index.html
```

## 4. Write W/Code.gs and W/appsscript.json

Copy them from `W/kit/templates`, then set `TITLE`, `PREFIX`, the strictest `ID` regex that takes every id of the artifact (check it against the real list) and `clean(d)`, one line per field: `!!` for a boolean, a closed list for an enumeration, a cut for a text.

The API is `getState()` → `{ me, items }` and `setItems([[id, fields], …])` → `{ id: { by, at } }`. Script properties hold 9 KB per value and 500 KB in all: estimate elements × size of a full element, and stop past 400 KB.

Keep `executeAs: USER_DEPLOYING` and `access: DOMAIN`: only then does `Session.getActiveUser().getEmail()` give the visitor's email.

## 5. Test locally

Run `W/kit/scripts/serve-test.sh W 8765` in the background. It prints `?u=alice`, `?u=bob` and `local.html`. With a browser tool, check:

- a change by alice shows at bob's within 3 s, with “alice · HH:MM” and updated counters;
- a visible textarea that bob is typing in keeps its focus and text when alice changes the same element;
- with `window.mockFail = true`, the change stays on screen and the status line counts what was not sent; with `false` again, it reaches `mockdb`;
- `local.html` shows the local mode and works like the artifact;
- no console error but the favicon's 404.

Stop the server when done.

## 6. Deploy

```bash
python3 W/kit/scripts/share.py deploy W "<artifact title>"
```

The last line is the `/exec` link, in the domain's form `https://script.google.com/a/macros/<domain>/s/<id>/exec`, the domain being that of the clasp account. Publish that one: the short form `https://script.google.com/macros/s/<id>/exec` fails with « Unable to open the file » as soon as the browser's default Google account is not the domain's. `W/deploy.json` keeps it: never delete it, the next deploy would give a new link. Then call `mcp__squadron-pilot__publish_artifact` with `id` the artifact's id, `destination` the destination from the arguments and `link` that link. Your last reply tells the user, briefly:

- to open the link once to grant the OAuth access, which no tool can do;
- to check from a second account of the domain that a change shows;
- that Update in Squadron's Share menu deploys the artifact's new version at the same link, and Stop sharing takes it down.

## Never

- share with "Anyone": the page may hold test accounts or internal URLs;
- give the `/dev` link, which only the project's editors open;
- publish the short `/macros/s/<id>/exec` form for a Workspace domain: only a `gmail.com` account uses it.

# Google Workspace share

A [Squadron](https://github.com/Jgrasp/squadron) extension that shares an html artifact with your team as a Google Apps Script web app. Everyone opens the same page, and what one person changes (a status, a checkbox, a note) shows for the others, with who changed it and when. Only the accounts of your Google Workspace domain can open it.

## Use

In the Artifacts panel, **Share › Share with the team**. An agent of its own reads the artifact, adds the sync layer, tests it with two fake users, deploys it with clasp and gives back the link. Then the same menu gives:

- **Open** and **Copy link**;
- **Update** once the artifact changed, which deploys the new version at the same link;
- **Stop sharing**, which takes the web app down, and can delete the Apps Script project with what the team entered.

It fits artifacts whose state is a map of independent elements kept in `localStorage`: test plans, checklists, follow-up tables.

## Before the first share

- `python3`;
- [clasp](https://github.com/google/clasp) 3: `npm i -g @google/clasp`, or `npx` available;
- the Google Apps Script API turned on at https://script.google.com/home/usersettings;
- `clasp login` once, in a terminal.

The first time you open a shared link, Google asks you to grant the web app its access.

## What it asks Squadron for

- `python3`, with any arguments: Update and Stop sharing run `share.py`, which calls clasp;
- the skill `workspace-share:share` for your agents.

The working files of each shared artifact stay in the extension's data folder, under `sites/<agent>-<artifact>`.

## Develop

Needs Squadron with the `artifact.actions` slot and `contributes.skills`.

```bash
cargo build --release --target wasm32-wasip2
```

Then **Settings › Extensions › Add a folder…** on this folder.

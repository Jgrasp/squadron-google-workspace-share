const remote = typeof google !== "undefined" && google.script && google.script.run;
const run = () => google.script.run;
const timers = new Map(), inflight = new Map(), dirty = new Set();
let me = "", lastPull = 0, syncErr = "";
const SAY = Object.assign({ local: "Local mode: the data stays in this browser.", error: "Sync error", unsent: n => ` (${n} not sent, tried again at the next sync)`, refused: ids => `refused by the server: ${ids}`, saving: "Saving…", upTo: t => `up to date ${t}`, connecting: "Connecting…" }, typeof SYNC_TEXT === "undefined" ? {} : SYNC_TEXT);
const pick = s => Object.fromEntries(FIELDS.map(f => [f, s[f]]));
const same = (s, r) => s.by === r.by && s.at === r.at && FIELDS.every(f => s[f] === r[f]);
const busy = (id, editing) => timers.has(id) || timers.has("*") || inflight.get(id) > 0 || dirty.has(id) || id === editing;
const hx = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function push(ids, delay) {
  if (!remote || !ids.length) return;
  const k = ids.length === 1 ? ids[0] : "*";
  clearTimeout(timers.get(k)?.t);
  timers.set(k, { ids, t: setTimeout(() => { timers.delete(k); send(ids); }, delay) });
  sync();
}
function flush() {
  for (const [k, x] of timers) { clearTimeout(x.t); timers.delete(k); send(x.ids); }
}
function send(ids) {
  ids.forEach(id => inflight.set(id, (inflight.get(id) || 0) + 1));
  const end = () => ids.forEach(id => inflight.set(id, inflight.get(id) - 1));
  sync();
  run().withSuccessHandler(r => {
    end();
    const refused = ids.filter(id => !r[id]);
    ids.forEach(id => r[id] ? dirty.delete(id) : dirty.add(id));
    if (refused.length) syncErr = SAY.refused(refused.join(", ")); else if (!dirty.size) syncErr = "";
    for (const id in r) { Object.assign(item(id), r[id]); patchWho(id); }
    save(); sync();
  })
    .withFailureHandler(e => { end(); ids.forEach(id => dirty.add(id)); syncErr = e.message || String(e); sync(); })
    .setItems(ids.map(id => [id, pick(item(id))]));
}
function pull() {
  const retry = [...dirty].filter(id => !(inflight.get(id) > 0));
  if (retry.length) send(retry);
  run().withSuccessHandler(r => { me = r.me; lastPull = Date.now(); if (!dirty.size) syncErr = ""; apply(r.items); sync(); })
    .withFailureHandler(e => { syncErr = e.message || String(e); sync(); })
    .getState();
}
function apply(items) {
  const a = document.activeElement;
  const editing = a && (a.tagName === "TEXTAREA" || a.type === "text") ? idOf(a) : "";
  const changed = [];
  for (const id in items) {
    const r = items[id], s = item(id);
    if (!s || busy(id, editing) || r.at < (s.at || 0) || same(s, r)) continue;
    Object.assign(s, r); changed.push(id);
  }
  if (!changed.length) return;
  save();
  changed.forEach(renderItem);
  refresh();
}
function sync() {
  const el = document.getElementById("sync"); if (!el) return;
  if (!remote) { el.className = "sync"; el.textContent = SAY.local; return; }
  const n = timers.size + [...inflight.values()].filter(v => v > 0).length;
  const left = dirty.size ? SAY.unsent(dirty.size) : "";
  const time = new Date(lastPull).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  el.className = "sync" + (syncErr ? " err" : "");
  el.textContent = syncErr ? `${SAY.error}: ${syncErr}${left}` : n ? SAY.saving : lastPull ? `${me ? me + " · " : ""}${SAY.upTo(time)}` : SAY.connecting;
}
function whoHtml(s) {
  if (!s || !s.by || !s.at) return "";
  const d = new Date(s.at), today = d.toDateString() === new Date().toDateString();
  const when = today ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
  return `<span class="who" title="${hx(s.by)} · ${hx(d.toLocaleString())}">${hx(s.by.split("@")[0])} · ${when}</span>`;
}
function copy(v) {
  const legacy = () => { const t = document.createElement("textarea"); t.value = v; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); };
  navigator.clipboard ? navigator.clipboard.writeText(v).catch(legacy) : legacy();
}
function startSync() {
  sync();
  if (!remote) return;
  pull();
  setInterval(pull, window.PULL_MS || 15000);
  document.addEventListener("visibilitychange", () => document.hidden ? flush() : pull());
}

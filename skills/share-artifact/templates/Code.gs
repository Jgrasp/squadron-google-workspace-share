const TITLE = "__TITRE__";
const PREFIX = "item:";
const ID = /^[A-Za-z0-9_.-]{1,64}$/;
const MAX_BATCH = 500;
const MAX_VALUE = 9000;

function clean(d) {
  return {
    done: !!d.done,
    note: String(d.note || "").slice(0, 2500),
  };
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle(TITLE)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function getState() {
  const all = PropertiesService.getScriptProperties().getProperties();
  const items = {};
  for (const k in all) if (k.startsWith(PREFIX)) items[k.slice(PREFIX.length)] = JSON.parse(all[k]);
  return { me: Session.getActiveUser().getEmail(), items };
}

function setItems(list) {
  if (!Array.isArray(list) || list.length > MAX_BATCH) throw new Error("Invalid request");
  const by = Session.getActiveUser().getEmail() || "?";
  const at = Date.now();
  const props = {};
  const out = {};
  for (const [id, d] of list) {
    if (typeof id !== "string" || !ID.test(id) || !d || typeof d !== "object") continue;
    const v = JSON.stringify({ ...clean(d), by, at });
    if (v.length > MAX_VALUE) throw new Error(`Element too big: ${id}`);
    props[PREFIX + id] = v;
    out[id] = { by, at };
  }
  PropertiesService.getScriptProperties().setProperties(props, false);
  return out;
}

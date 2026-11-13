(() => {
  const u = new URLSearchParams(location.search).get("u") || "alice";
  const U = u + "@example.com";
  const raw = { get: Storage.prototype.getItem, set: Storage.prototype.setItem, del: Storage.prototype.removeItem };
  const key = k => (k === "mockdb" ? k : u + ":" + k);
  Storage.prototype.getItem = function (k) { return raw.get.call(this, key(k)); };
  Storage.prototype.setItem = function (k, v) { return raw.set.call(this, key(k), v); };
  Storage.prototype.removeItem = function (k) { return raw.del.call(this, key(k)); };
  const db = () => JSON.parse(localStorage.getItem("mockdb") || "{}");
  window.PULL_MS = 2000;
  function mk(ok, ko) {
    return {
      withSuccessHandler: f => mk(f, ko),
      withFailureHandler: f => mk(ok, f),
      getState: () => setTimeout(() => ok && ok({ me: U, items: db() }), 150),
      setItems: list => setTimeout(() => {
        if (window.mockFail) return ko && ko(new Error("panne simulée"));
        const d = db(), at = Date.now(), out = {};
        for (const [id, x] of list) { d[id] = { ...x, by: U, at }; out[id] = { by: U, at }; }
        localStorage.setItem("mockdb", JSON.stringify(d));
        ok && ok(out);
      }, 250),
    };
  }
  window.google = { script: { get run() { return mk(); } } };
})();

import { app as S, ipcMain as a, dialog as N, BrowserWindow as _, shell as E } from "electron";
import v from "path";
import { fileURLToPath as W } from "url";
import { Client as x } from "ssh2";
import J from "keytar";
import s from "fs";
const O = v.dirname(W(import.meta.url)), i = v.join(S.getPath("userData"), "connections.json");
let m = null;
const h = /* @__PURE__ */ new Map();
a.on(
  "ssh-session-resize",
  (n, e) => {
    const { sessionId: t, cols: r, rows: o, heightPx: l = 0, widthPx: d = 0 } = e ?? {};
    if (!t || r < 1 || o < 1) return;
    const p = h.get(t), c = p == null ? void 0 : p.stream;
    if (c != null && c.setWindow)
      try {
        c.setWindow(o, r, l, d);
      } catch {
      }
  }
);
async function j() {
  m = new _({
    width: 1200,
    height: 800,
    webPreferences: {
      // Vite outputs preload as preload.mjs next to main.js
      preload: v.join(O, "preload.mjs")
    }
  }), process.env.NODE_ENV === "development" ? await m.loadURL("http://localhost:5173") : await m.loadFile(v.join(O, "../dist/index.html")), m.webContents.setWindowOpenHandler(({ url: n }) => ((n.startsWith("https:") || n.startsWith("http:")) && E.openExternal(n), { action: "deny" }));
}
S.whenReady().then(j);
S.on("window-all-closed", () => S.quit());
a.handle("ssh-connect", async (n, e) => {
  const t = new x();
  return new Promise((r, o) => {
    t.on("ready", () => {
      r("connected");
    }).on("error", (l) => {
      o(l.message ?? String(l));
    }).connect({
      host: e.host,
      port: e.port,
      username: e.username,
      password: e.password,
      privateKey: e.privateKey || (e.privateKeyPath ? s.readFileSync(e.privateKeyPath) : void 0),
      passphrase: e.passphrase,
      readyTimeout: 1e4
    });
  });
});
a.handle("ssh-shell", async (n, e) => {
  const t = new x();
  return new Promise((r, o) => {
    t.on("ready", () => {
      t.shell({ term: "xterm-256color" }, (l, d) => {
        if (l) return o(l);
        d.on("data", (c) => {
          n.sender.send("ssh-data", (c == null ? void 0 : c.toString()) ?? "");
        }), a.removeAllListeners("ssh-input");
        const p = (c, u) => {
          d.write(u);
        };
        a.on("ssh-input", p), d.on("close", () => {
          a.removeListener("ssh-input", p);
        }), r("shell-open");
      });
    }).on("error", (l) => o(l)).connect({
      host: e.host,
      port: e.port,
      username: e.username,
      password: e.password,
      privateKey: e.privateKey || (e.privateKeyPath ? s.readFileSync(e.privateKeyPath) : void 0),
      passphrase: e.passphrase,
      readyTimeout: 1e4
    });
  });
});
a.handle("ssh-open", async (n, { sessionId: e, config: t }) => {
  const r = h.get(e);
  if (r != null && r.conn && r.stream)
    return "session-open";
  const o = new x(), l = Math.max(1, Math.min(4096, t.cols ?? 80)), d = Math.max(1, Math.min(4096, t.rows ?? 24));
  return h.set(e, { conn: o, stream: null }), new Promise((p, c) => {
    o.on("ready", () => {
      o.shell({ term: "xterm-256color", cols: l, rows: d }, (u, w) => {
        if (u) return c(u);
        h.set(e, { conn: o, stream: w });
        const f = `ssh-input:${e}`, K = `ssh-data:${e}`, P = (y, F) => {
          try {
            w.write(F);
          } catch {
          }
        };
        a.removeAllListeners(f), a.on(f, P), w.on("data", (y) => {
          n.sender.send(K, (y == null ? void 0 : y.toString()) ?? "");
        }), w.on("close", () => {
          a.removeListener(f, P);
          const y = h.get(e);
          y && h.set(e, { conn: y.conn, stream: null });
          try {
            o.end();
          } catch {
          }
        }), p("session-open");
      });
    }).on("error", (u) => c(u)).connect({
      host: t.host,
      port: t.port,
      username: t.username,
      password: t.password,
      privateKey: t.privateKey || (t.privateKeyPath ? s.readFileSync(t.privateKeyPath) : void 0),
      passphrase: t.passphrase,
      readyTimeout: 1e4
    });
  });
});
a.handle("ssh-disconnect", async (n, e) => {
  const t = h.get(e);
  if (t != null && t.conn)
    try {
      t.conn.end();
    } catch {
    }
  h.delete(e);
});
a.handle("save-secret", async (n, { id: e, password: t }) => (await J.setPassword("ElectronSSH", e, t), !0));
a.handle("get-secret", async (n, e) => J.getPassword("ElectronSSH", e));
a.handle("get-connections", () => s.existsSync(i) ? JSON.parse(s.readFileSync(i, "utf8")) : []);
a.handle("save-connection", (n, e) => {
  const t = s.existsSync(i) ? JSON.parse(s.readFileSync(i, "utf8")) : [];
  t.push(e), s.writeFileSync(i, JSON.stringify(t, null, 2));
});
a.handle("update-connection", (n, e) => {
  const t = s.existsSync(i) ? JSON.parse(s.readFileSync(i, "utf8")) : [], r = t.findIndex((o) => o.id === e.id);
  r >= 0 && (t[r] = e), s.writeFileSync(i, JSON.stringify(t, null, 2));
});
a.handle("delete-connection", (n, e) => {
  const r = (s.existsSync(i) ? JSON.parse(s.readFileSync(i, "utf8")) : []).filter((o) => o.id !== e);
  s.writeFileSync(i, JSON.stringify(r, null, 2));
});
a.handle("export-connections", async () => {
  if (!s.existsSync(i)) return !1;
  const n = s.readFileSync(i, "utf8"), { filePath: e } = await N.showSaveDialog(m, {
    title: "Bağlantıları Export Et",
    defaultPath: "connections.json",
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  return e ? (s.writeFileSync(e, n), !0) : !1;
});
a.handle("import-connections", async () => {
  const { filePaths: n } = await N.showOpenDialog(m, {
    title: "Bağlantıları Import Et",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (!n || n.length === 0) return !1;
  const e = JSON.parse(s.readFileSync(n[0], "utf8")), t = s.existsSync(i) ? JSON.parse(s.readFileSync(i, "utf8")) : [], r = [...t, ...e.filter((o) => !t.some((l) => l.id === o.id))];
  return s.writeFileSync(i, JSON.stringify(r, null, 2)), !0;
});

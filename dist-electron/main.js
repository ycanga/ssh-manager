import { app, ipcMain, dialog, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "ssh2";
import keytar from "keytar";
import fs from "fs";
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.join(app.getPath("userData"), "connections.json");
let win = null;
const sessions = /* @__PURE__ */ new Map();
async function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Vite outputs preload as preload.mjs next to main.js
      preload: path.join(currentDir, "preload.mjs")
    }
  });
  if (process.env.NODE_ENV === "development") {
    await win.loadURL("http://localhost:5173");
  } else {
    await win.loadFile(path.join(currentDir, "../dist/index.html"));
  }
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
ipcMain.handle("ssh-connect", async (_event, config) => {
  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn.on("ready", () => {
      resolve("connected");
    }).on("error", (err) => {
      reject(err.message ?? String(err));
    }).connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey || (config.privateKeyPath ? fs.readFileSync(config.privateKeyPath) : void 0),
      passphrase: config.passphrase,
      readyTimeout: 1e4
    });
  });
});
ipcMain.handle("ssh-shell", async (_event, config) => {
  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn.on("ready", () => {
      conn.shell({ term: "xterm-256color" }, (err, stream) => {
        if (err) return reject(err);
        stream.on("data", (data) => {
          _event.sender.send("ssh-data", (data == null ? void 0 : data.toString()) ?? "");
        });
        ipcMain.removeAllListeners("ssh-input");
        const onInput = (_, input) => {
          stream.write(input);
        };
        ipcMain.on("ssh-input", onInput);
        stream.on("close", () => {
          ipcMain.removeListener("ssh-input", onInput);
        });
        resolve("shell-open");
      });
    }).on("error", (err) => reject(err)).connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey || (config.privateKeyPath ? fs.readFileSync(config.privateKeyPath) : void 0),
      passphrase: config.passphrase,
      readyTimeout: 1e4
    });
  });
});
ipcMain.handle("ssh-open", async (event, { sessionId, config }) => {
  const conn = new Client();
  sessions.set(sessionId, { conn });
  return new Promise((resolve, reject) => {
    conn.on("ready", () => {
      conn.shell({ term: "xterm-256color" }, (err, stream) => {
        if (err) return reject(err);
        const inputChannel = `ssh-input:${sessionId}`;
        const dataChannel = `ssh-data:${sessionId}`;
        const onInput = (_, input) => {
          try {
            stream.write(input);
          } catch (e) {
          }
        };
        ipcMain.removeAllListeners(inputChannel);
        ipcMain.on(inputChannel, onInput);
        stream.on("data", (data) => {
          event.sender.send(dataChannel, (data == null ? void 0 : data.toString()) ?? "");
        });
        stream.on("close", () => {
          ipcMain.removeListener(inputChannel, onInput);
          try {
            conn.end();
          } catch (e) {
          }
        });
        resolve("session-open");
      });
    }).on("error", (err) => reject(err)).connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey || (config.privateKeyPath ? fs.readFileSync(config.privateKeyPath) : void 0),
      passphrase: config.passphrase,
      readyTimeout: 1e4
    });
  });
});
ipcMain.handle("ssh-disconnect", async (_event, sessionId) => {
  const s = sessions.get(sessionId);
  if (s == null ? void 0 : s.conn) {
    try {
      s.conn.end();
    } catch (e) {
    }
  }
  sessions.delete(sessionId);
});
ipcMain.handle("save-secret", async (_e, { id, password }) => {
  await keytar.setPassword("ElectronSSH", id, password);
  return true;
});
ipcMain.handle("get-secret", async (_e, id) => {
  return keytar.getPassword("ElectronSSH", id);
});
ipcMain.handle("get-connections", () => {
  if (!fs.existsSync(storePath)) return [];
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
});
ipcMain.handle("save-connection", (_e, conn) => {
  const all = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, "utf8")) : [];
  all.push(conn);
  fs.writeFileSync(storePath, JSON.stringify(all, null, 2));
});
ipcMain.handle("update-connection", (_e, conn) => {
  const all = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, "utf8")) : [];
  const idx = all.findIndex((c) => c.id === conn.id);
  if (idx >= 0) {
    all[idx] = conn;
  }
  fs.writeFileSync(storePath, JSON.stringify(all, null, 2));
});
ipcMain.handle("delete-connection", (_e, id) => {
  const all = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, "utf8")) : [];
  const filtered = all.filter((c) => c.id !== id);
  fs.writeFileSync(storePath, JSON.stringify(filtered, null, 2));
});
ipcMain.handle("export-connections", async () => {
  if (!fs.existsSync(storePath)) return false;
  const data = fs.readFileSync(storePath, "utf8");
  const { filePath } = await dialog.showSaveDialog(win, {
    title: "Bağlantıları Export Et",
    defaultPath: "connections.json",
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (filePath) {
    fs.writeFileSync(filePath, data);
    return true;
  }
  return false;
});
ipcMain.handle("import-connections", async () => {
  const { filePaths } = await dialog.showOpenDialog(win, {
    title: "Bağlantıları Import Et",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (!filePaths || filePaths.length === 0) return false;
  const imported = JSON.parse(fs.readFileSync(filePaths[0], "utf8"));
  const existing = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, "utf8")) : [];
  const merged = [...existing, ...imported.filter((c) => !existing.some((e) => e.id === c.id))];
  fs.writeFileSync(storePath, JSON.stringify(merged, null, 2));
  return true;
});

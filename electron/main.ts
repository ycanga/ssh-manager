// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'ssh2';
import keytar from 'keytar';
import fs from 'fs';
// Helper to resolve current file directory in ESM
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.join(app.getPath('userData'), 'connections.json');

// Minimal ssh stream interface
interface SshStream {
  on(event: 'data', cb: (data: Buffer) => void): void;
  on(event: 'close', cb: () => void): void;
  write(data: string | Buffer): void;
}

let win: BrowserWindow | null = null;
const sessions = new Map<string, { conn: Client | null }>();

async function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Vite outputs preload as preload.mjs next to main.js
      preload: path.join(currentDir, 'preload.mjs'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    await win.loadURL('http://localhost:5173');
  } else {
    await win.loadFile(path.join(currentDir, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// === SSH IPC Handler ===
ipcMain.handle('ssh-connect', async (_event, config: { host: string; port?: number; username?: string; password?: string; privateKey?: string | Buffer; privateKeyPath?: string; passphrase?: string }) => {
  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn
      .on('ready', () => {
        resolve('connected');
      })
      .on('error', (err: unknown) => {
        reject((err as Error).message ?? String(err));
      })
      .connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey || (config.privateKeyPath ? fs.readFileSync(config.privateKeyPath) : undefined),
        passphrase: config.passphrase,
        readyTimeout: 10000,
      });
  });
});
ipcMain.handle('ssh-shell', async (_event, config: { host: string; port?: number; username?: string; password?: string; privateKey?: string | Buffer; privateKeyPath?: string; passphrase?: string }) => {
  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn
      .on('ready', () => {
        conn.shell({ term: 'xterm-256color' }, (err: unknown, stream: SshStream) => {
          if (err) return reject(err);
          // Stream eventlerini Renderer’a iletmek için
          stream.on('data', (data) => {
            _event.sender.send('ssh-data', data?.toString() ?? '');
          });
          // Önceki listener'ları kaldır, tekil listener kullan
          ipcMain.removeAllListeners('ssh-input');
          const onInput = (_: unknown, input: string) => {
            stream.write(input);
          };
          ipcMain.on('ssh-input', onInput);
          stream.on('close', () => {
            ipcMain.removeListener('ssh-input', onInput);
          });
          resolve('shell-open');
        });
      })
      .on('error', (err: unknown) => reject(err))
      .connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey || (config.privateKeyPath ? fs.readFileSync(config.privateKeyPath) : undefined),
        passphrase: config.passphrase,
        readyTimeout: 10000,
      });
  });
});

// === Session-scoped SSH (supports multiple tabs) ===
ipcMain.handle('ssh-open', async (event, { sessionId, config }: { sessionId: string; config: { host: string; port?: number; username?: string; password?: string; privateKey?: string | Buffer; privateKeyPath?: string; passphrase?: string } }) => {
  const conn = new Client();
  sessions.set(sessionId, { conn });
  return new Promise((resolve, reject) => {
    conn
      .on('ready', () => {
        conn.shell({ term: 'xterm-256color' }, (err: unknown, stream: SshStream) => {
          if (err) return reject(err);
          const inputChannel = `ssh-input:${sessionId}`;
          const dataChannel = `ssh-data:${sessionId}`;
          const onInput = (_: unknown, input: string) => {
            try {
              stream.write(input);
            } catch (e) {
              // ignore
            }
          };
          ipcMain.removeAllListeners(inputChannel);
          ipcMain.on(inputChannel, onInput);
          stream.on('data', (data) => {
            event.sender.send(dataChannel, data?.toString() ?? '');
          });
          stream.on('close', () => {
            ipcMain.removeListener(inputChannel, onInput);
            try {
              conn.end();
            } catch (e) {
              // ignore
            }
          });
          resolve('session-open');
        });
      })
      .on('error', (err: unknown) => reject(err))
      .connect({
        host: config.host!,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey || (config.privateKeyPath ? fs.readFileSync(config.privateKeyPath) : undefined),
        passphrase: config.passphrase,
        readyTimeout: 10000,
      });
  });
});

ipcMain.handle('ssh-disconnect', async (_event, sessionId: string) => {
  const s = sessions.get(sessionId);
  if (s?.conn) {
    try {
      s.conn.end();
    } catch (e) {
      // ignore
    }
  }
  sessions.delete(sessionId);
});


// === Keychain saklama ===
ipcMain.handle('save-secret', async (_e, { id, password }) => {
  await keytar.setPassword('ElectronSSH', id, password);
  return true;
});

ipcMain.handle('get-secret', async (_e, id) => {
  return keytar.getPassword('ElectronSSH', id);
});

ipcMain.handle('get-connections', () => {
  if (!fs.existsSync(storePath)) return [];
  return JSON.parse(fs.readFileSync(storePath, 'utf8'));
});

ipcMain.handle('save-connection', (_e, conn) => {
  const all = fs.existsSync(storePath)
    ? JSON.parse(fs.readFileSync(storePath, 'utf8'))
    : [];
  all.push(conn);
  fs.writeFileSync(storePath, JSON.stringify(all, null, 2));
});

ipcMain.handle('update-connection', (_e, conn: { id: string; name: string; host: string; port?: number; username: string }) => {
  const all: { id: string; name: string; host: string; port?: number; username: string }[] = fs.existsSync(storePath)
    ? JSON.parse(fs.readFileSync(storePath, 'utf8'))
    : [];
  const idx = all.findIndex((c) => c.id === conn.id);
  if (idx >= 0) {
    all[idx] = conn;
  }
  fs.writeFileSync(storePath, JSON.stringify(all, null, 2));
});

ipcMain.handle('delete-connection', (_e, id: string) => {
  const all: { id: string }[] = fs.existsSync(storePath)
    ? JSON.parse(fs.readFileSync(storePath, 'utf8'))
    : [];
  const filtered = all.filter((c) => c.id !== id);
  fs.writeFileSync(storePath, JSON.stringify(filtered, null, 2));
});
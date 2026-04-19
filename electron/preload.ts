import { contextBridge, ipcRenderer } from 'electron';

type SshConfig = {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string | Buffer;
  cols?: number;
  rows?: number;
};

type Connection = {
  id: string;
  name: string;
  host: string;
  port?: number;
  username: string;
};

type ElectronAPI = {
  sshConnect: (config: SshConfig) => Promise<unknown>;
  saveSecret: (id: string, password: string) => Promise<boolean>;
  getSecret: (id: string) => Promise<string | null>;
  openShell: (cfg: SshConfig) => Promise<unknown>;
  sendInput: (data: string) => void;
  onData: (callback: (data: string) => void) => () => void;
  getConnections: () => Promise<Connection[]>;
  saveConnection: (conn: Connection) => Promise<void>;
  updateConnection: (conn: Connection) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  openSession: (sessionId: string, cfg: SshConfig) => Promise<unknown>;
  sendSessionInput: (sessionId: string, data: string) => void;
  onSessionData: (sessionId: string, callback: (data: string) => void) => () => void;
  disconnectSession: (sessionId: string) => Promise<void>;
  resizeSession: (sessionId: string, cols: number, rows: number, heightPx?: number, widthPx?: number) => void;
  exportConnections: () => Promise<boolean>;
  importConnections: () => Promise<boolean>;
};

const api: ElectronAPI = {
  sshConnect: (config) => ipcRenderer.invoke('ssh-connect', config),
  saveSecret: (id, password) => ipcRenderer.invoke('save-secret', { id, password }),
  getSecret: (id) => ipcRenderer.invoke('get-secret', id),
  openShell: (cfg) => ipcRenderer.invoke('ssh-shell', cfg),
  sendInput: (data) => ipcRenderer.send('ssh-input', data),
  onData: (callback) => {
    const listener = (_e: unknown, msg: string) => callback(msg);
    ipcRenderer.on('ssh-data', listener);
    return () => ipcRenderer.removeListener('ssh-data', listener);
  },
  getConnections: () => ipcRenderer.invoke('get-connections'),
  saveConnection: (conn) => ipcRenderer.invoke('save-connection', conn),
  updateConnection: (conn) => ipcRenderer.invoke('update-connection', conn),
  deleteConnection: (id) => ipcRenderer.invoke('delete-connection', id),
  openSession: (sessionId, cfg) => ipcRenderer.invoke('ssh-open', { sessionId, config: cfg }),
  sendSessionInput: (sessionId, data) => ipcRenderer.send(`ssh-input:${sessionId}`, data),
  onSessionData: (sessionId, callback) => {
    const channel = `ssh-data:${sessionId}`;
    const listener = (_e: unknown, msg: string) => callback(msg);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  disconnectSession: (sessionId) => ipcRenderer.invoke('ssh-disconnect', sessionId),
  resizeSession: (sessionId, cols, rows, heightPx, widthPx) =>
    ipcRenderer.send('ssh-session-resize', { sessionId, cols, rows, heightPx, widthPx }),
  exportConnections: () => ipcRenderer.invoke('export-connections'),
  importConnections: () => ipcRenderer.invoke('import-connections'),
};

contextBridge.exposeInMainWorld('electronAPI', api);

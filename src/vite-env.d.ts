/// <reference types="vite/client" />

type Connection = { id: string; name: string; host: string; port?: number; username: string };

interface ElectronAPI {
  sshConnect: (config: { host: string; port?: number; username: string; password?: string }) => Promise<unknown>;
  saveSecret: (id: string, password: string) => Promise<boolean>;
  getSecret: (id: string) => Promise<string | null>;
  openShell: (cfg: { host: string; port?: number; username?: string; password?: string; privateKey?: string | Buffer }) => Promise<unknown>;
  sendInput: (data: string) => void;
  onData: (callback: (data: string) => void) => () => void;
  getConnections: () => Promise<Connection[]>;
  saveConnection: (conn: Connection) => Promise<void>;
  updateConnection: (conn: Connection) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  openSession: (sessionId: string, cfg: { host: string; port?: number; username?: string; password?: string; privateKey?: string | Buffer; privateKeyPath?: string; passphrase?: string }) => Promise<unknown>;
  sendSessionInput: (sessionId: string, data: string) => void;
  onSessionData: (sessionId: string, callback: (data: string) => void) => () => void;
  disconnectSession: (sessionId: string) => Promise<void>;
}

declare interface Window {
  electronAPI: ElectronAPI;
}
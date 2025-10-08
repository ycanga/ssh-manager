"use strict";
const electron = require("electron");
const api = {
  sshConnect: (config) => electron.ipcRenderer.invoke("ssh-connect", config),
  saveSecret: (id, password) => electron.ipcRenderer.invoke("save-secret", { id, password }),
  getSecret: (id) => electron.ipcRenderer.invoke("get-secret", id),
  openShell: (cfg) => electron.ipcRenderer.invoke("ssh-shell", cfg),
  sendInput: (data) => electron.ipcRenderer.send("ssh-input", data),
  onData: (callback) => {
    const listener = (_e, msg) => callback(msg);
    electron.ipcRenderer.on("ssh-data", listener);
    return () => electron.ipcRenderer.removeListener("ssh-data", listener);
  },
  getConnections: () => electron.ipcRenderer.invoke("get-connections"),
  saveConnection: (conn) => electron.ipcRenderer.invoke("save-connection", conn),
  updateConnection: (conn) => electron.ipcRenderer.invoke("update-connection", conn),
  deleteConnection: (id) => electron.ipcRenderer.invoke("delete-connection", id),
  openSession: (sessionId, cfg) => electron.ipcRenderer.invoke("ssh-open", { sessionId, config: cfg }),
  sendSessionInput: (sessionId, data) => electron.ipcRenderer.send(`ssh-input:${sessionId}`, data),
  onSessionData: (sessionId, callback) => {
    const channel = `ssh-data:${sessionId}`;
    const listener = (_e, msg) => callback(msg);
    electron.ipcRenderer.on(channel, listener);
    return () => electron.ipcRenderer.removeListener(channel, listener);
  },
  disconnectSession: (sessionId) => electron.ipcRenderer.invoke("ssh-disconnect", sessionId),
  exportConnections: () => electron.ipcRenderer.invoke("export-connections"),
  importConnections: () => electron.ipcRenderer.invoke("import-connections")
};
electron.contextBridge.exposeInMainWorld("electronAPI", api);

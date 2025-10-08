// src/App.tsx
import { useEffect, useState } from 'react';
import TerminalView from './components/TerminalView';
import './index.css';

function App() {
  type Connection = { id: string; name: string; host: string; port?: number; username: string; password?: string };
  const [connections, setConnections] = useState<Connection[]>([]);
  const [tabs, setTabs] = useState<{ id: string; title: string; conn: Connection }[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<Connection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await window.electronAPI!.getConnections();
      setConnections(list || []);
    })();
  }, []);

  const connectSSH = async (conn: { host: string; port?: number; username: string; password?: string }) => {
    setIsConnecting(true);
    try {
      const sessionId = `${conn.username}@${conn.host}:${conn.port||22}-${Date.now()}`;
      await window.electronAPI.openSession(sessionId, conn);
      const tab = { id: sessionId, title: `${conn.username}@${conn.host}`, conn: { id: sessionId, name: sessionId, host: conn.host, port: conn.port, username: conn.username, password: conn.password } };
      setTabs((t) => [...t, tab]);
      setActiveTabId(sessionId);
    } catch (err) {
      alert('Bağlantı hatası: ' + err);
    } finally {
      setIsConnecting(false);
    }
  };

  const saveConnection = async () => {
    if (!name || !host || !username) return alert('Ad, host ve kullanıcı gerekli');
    const id = `${name}-${Date.now()}`;
    const conn = { id, name, host, port, username };
    if (password) {
      await window.electronAPI!.saveSecret(id, password);
    }
    await window.electronAPI!.saveConnection(conn);
    const list = await window.electronAPI.getConnections();
    setConnections(list || []);
    setShowAdd(false);
    setName(''); setHost(''); setPort(22); setUsername(''); setPassword('');
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="header">
          <h1>SSH Manager</h1>
          <div className="row">
            <button className="btn" onClick={() => {
              const root = document.documentElement;
              if (root.classList.contains('theme-dark')) {
                root.classList.remove('theme-dark');
                root.classList.add('theme-light');
              } else {
                root.classList.remove('theme-light');
                root.classList.add('theme-dark');
              }
            }}>Tema</button>
          <button className="btn" onClick={() => { setEditing(null); setName(''); setHost(''); setPort(22); setUsername(''); setPassword(''); setShowAdd(true); }}>Ekle</button>
          </div>
        </div>

        <div className="list">
          {connections.map((c) => (
            <div key={c.id} className="card">
              <div className="font-medium">{c.name}</div>
              <div className="muted">{c.username}@{c.host}:{c.port || 22}</div>
              <div className="row">
                <button
                  className="btn primary"
                  disabled={isConnecting}
                  onClick={async () => {
                    const saved = await window.electronAPI.getSecret(c.id);
                    await connectSSH({ host: c.host, port: c.port || 22, username: c.username, password: saved || '' });
                  }}
                >{isConnecting ? 'Bağlanıyor...' : 'Başlat'}</button>
                <button
                  className="btn"
                  onClick={() => { setEditing(c); setShowAdd(true); setName(c.name); setHost(c.host); setPort(c.port || 22); setUsername(c.username); setPassword(''); }}
                >Düzenle</button>
                <button
                  className="btn danger"
                  onClick={async () => {
                    if (!confirm('Bu bağlantıyı silmek istediğinize emin misiniz?')) return;
                    await window.electronAPI.deleteConnection(c.id);
                    const list = await window.electronAPI.getConnections();
                    setConnections(list||[]);
                  }}
                >Sil</button>
              </div>
            </div>
          ))}
          {connections.length === 0 && (
            <div className="muted">Henüz bağlantı eklenmedi.</div>
          )}
        </div>
      </div>

      <div className="content">
        {tabs.length > 0 ? (
          <div style={{display:'flex', flexDirection:'column', height:'100%'}}>
            <div style={{display:'flex', gap:'.5rem', borderBottom:'1px solid var(--border)', padding:'.5rem'}}>
              {tabs.map(t => (
                <div key={t.id} className="card" style={{padding:'.35rem .6rem', display:'flex', alignItems:'center', gap:'.5rem', background: activeTabId===t.id? 'var(--panel)':'#0b1220'}}>
                  <button className="btn ghost" onClick={() => setActiveTabId(t.id)}>{t.title}</button>
                  <button className="btn danger" onClick={async () => {
                    await window.electronAPI.disconnectSession(t.id);
                    setTabs((prev)=>prev.filter(x=>x.id!==t.id));
                    if (activeTabId===t.id) setActiveTabId(() => {
                      const rest = tabs.filter(x=>x.id!==t.id);
                      return rest[0]?.id ?? null;
                    });
                  }}>×</button>
                </div>
              ))}
            </div>
            <div style={{flex:1}}>
              {tabs.filter(t=>t.id===activeTabId).map(t => (
                <TerminalView key={t.id} connection={t.conn} />
              ))}
            </div>
          </div>
        ) : (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%', color:'#94a3b8'}}>
            Bir bağlantı seçin veya ekleyin.
          </div>
        )}
      </div>
      {showAdd && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-title">{editing ? 'Bağlantıyı Düzenle' : 'Bağlantı Ekle'}</div>
            <div className="grid">
              <input className="input" placeholder="Ad" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="input" placeholder="Host" value={host} onChange={(e) => setHost(e.target.value)} />
              <input className="input" placeholder="Port" type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
              <input className="input" placeholder="Kullanıcı adı" value={username} onChange={(e) => setUsername(e.target.value)} />
              <div className="input-row">
                <input className="input" placeholder="Parola (opsiyonel)" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="toggle-eye" onClick={() => setShow(s => !s)} title={show ? 'Gizle' : 'Göster'}>
                  {show ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div className="row" style={{justifyContent:'flex-end'}}>
              <button className="btn ghost" onClick={() => setShowAdd(false)}>Vazgeç</button>
              <button className="btn primary" onClick={async () => {
                if (editing) {
                  const updated: Connection = { ...editing, name, host, port, username };
                  if (password) {
                    await window.electronAPI.saveSecret(updated.id, password);
                  }
                  await window.electronAPI.updateConnection(updated);
                  const list = await window.electronAPI.getConnections();
                  setConnections(list||[]);
                  setEditing(null);
                  setShowAdd(false);
                  setName(''); setHost(''); setPort(22); setUsername(''); setPassword(''); setShow(false);
                } else {
                  await saveConnection();
                }
              }}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

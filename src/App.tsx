import { useEffect, useState } from 'react';
import TerminalView from './components/TerminalView';
import './index.css';
import { FiUpload, FiDownload, FiSun, FiPlus } from 'react-icons/fi'

function App() {
  type Connection = { id: string; name: string; host: string; port?: number; username: string; password?: string };
  const [connections, setConnections] = useState<Connection[]>([]);
  const [tabs, setTabs] = useState<{ id: string; title: string; conn: Connection }[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [sessionLayout, setSessionLayout] = useState<'tabs' | 'tiled'>(() => {
    try {
      const v = localStorage.getItem('ssh-manager-session-layout');
      if (v === 'tiled' || v === 'tabs') return v;
    } catch {
      /* ignore */
    }
    return 'tabs';
  });
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

    const root = document.documentElement;
    if (!root.classList.contains('theme-light') && !root.classList.contains('theme-dark')) {
      root.classList.add('theme-light');
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ssh-manager-session-layout', sessionLayout);
    } catch {
      /* ignore */
    }
  }, [sessionLayout]);

  useEffect(() => {
    if (tabs.length === 0) {
      setActiveTabId(null);
      return;
    }
    setActiveTabId((a) => (a && tabs.some((t) => t.id === a) ? a : tabs[0].id));
  }, [tabs]);

  const connectSSH = async (conn: { host: string; port?: number; username: string; password?: string }) => {
    setIsConnecting(true);
    try {
      const sessionId = `${conn.username}@${conn.host}:${conn.port || 22}-${Date.now()}`;
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

  const closeSessionTab = async (tabId: string) => {
    await window.electronAPI.disconnectSession(tabId);
    setTabs((prev) => {
      const next = prev.filter((x) => x.id !== tabId);
      setActiveTabId((cur) => {
        if (cur !== tabId) return cur;
        const i = prev.findIndex((x) => x.id === tabId);
        const neighbor = prev[i - 1] ?? prev[i + 1];
        return neighbor?.id ?? next[0]?.id ?? null;
      });
      return next;
    });
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="header" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>SSH Manager</h1>
          <p className="sidebar-github">
            <a href="https://github.com/ycanga" target="_blank" rel="noopener noreferrer">
              github.com/ycanga
            </a>
          </p>
          <div
            className="row"
            style={{
              display: 'flex',
              gap: '0.1rem',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              padding: '0.25rem 0',
            }}
          >
            <button className="btn modern" style={{ whiteSpace: 'nowrap', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', gap: '0rem', padding: '0.5rem 0.8rem', borderRadius: '0.35rem', flexShrink: 0 }}
              onClick={async () => {
                const ok = await window.electronAPI.exportConnections();
                if (ok) alert('Bağlantılar export edildi.');
              }}
            ><FiUpload size={15} /> Export</button>

            <button className="btn modern" style={{ whiteSpace: 'nowrap', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', gap: '0rem', padding: '0.5rem 0.8rem', borderRadius: '0.35rem', flexShrink: 0 }}
              onClick={async () => {
                const ok = await window.electronAPI.importConnections();
                if (ok) {
                  alert('Bağlantılar import edildi.');
                  const list = await window.electronAPI.getConnections();
                  setConnections(list || []);
                }
              }}
            ><FiDownload size={15} /> Import</button>

            <button className="btn modern" style={{ whiteSpace: 'nowrap', background: '#facc15', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0rem', padding: '0.5rem 0.8rem', borderRadius: '0.35rem', flexShrink: 0 }}
              onClick={() => {
                const root = document.documentElement;
                if (!root.classList.contains('theme-dark')) {
                  root.classList.remove('theme-light');
                  root.classList.add('theme-dark');
                } else {
                  root.classList.remove('theme-dark');
                  root.classList.add('theme-light');
                }
              }}
            ><FiSun size={15} /> Tema</button>

            <button className="btn modern" style={{ whiteSpace: 'nowrap', background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', gap: '0rem', padding: '0.5rem 0.8rem', borderRadius: '0.35rem', flexShrink: 0 }}
              onClick={() => {
                setEditing(null);
                setName('');
                setHost('');
                setPort(22);
                setUsername('');
                setPassword('');
                setShowAdd(true);
              }}
            ><FiPlus size={15} /> Ekle</button>
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
                    setConnections(list || []);
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
          <div className="session-area">
            <div className="session-toolbar">
              <div className="session-layout-toggle" role="group" aria-label="Oturum düzeni">
                <button
                  type="button"
                  className={sessionLayout === 'tabs' ? 'is-active' : undefined}
                  onClick={() => setSessionLayout('tabs')}
                >
                  Sekmeler
                </button>
                <button
                  type="button"
                  className={sessionLayout === 'tiled' ? 'is-active' : undefined}
                  onClick={() => setSessionLayout('tiled')}
                >
                  Yan yana
                </button>
              </div>
            </div>

            {sessionLayout === 'tabs' ? (
              <div className="tab-stack">
                <div className="tab-bar" role="tablist">
                  {tabs.map((t) => (
                    <div
                      key={t.id}
                      className={`tab-chip${activeTabId === t.id ? ' tab-chip--active' : ''}`}
                      role="presentation"
                    >
                      <button type="button" className="tab-chip-label" role="tab" aria-selected={activeTabId === t.id} onClick={() => setActiveTabId(t.id)}>
                        {t.title}
                      </button>
                      <button
                        type="button"
                        className="tab-chip-close btn danger"
                        aria-label="Sekmeyi kapat"
                        onClick={() => void closeSessionTab(t.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="tab-panes">
                  {tabs.map((t) => (
                    <div
                      key={t.id}
                      className="tab-pane"
                      role="tabpanel"
                      style={{ display: activeTabId === t.id ? 'flex' : 'none' }}
                    >
                      <TerminalView connection={t.conn} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="session-strip session-strip--tiled" role="list">
                {tabs.map((t) => (
                  <section key={t.id} className="session-pane" role="listitem" aria-label={t.title}>
                    <header className="session-pane-header">
                      <span className="session-pane-title" title={t.title}>
                        {t.title}
                      </span>
                      <button
                        type="button"
                        className="btn danger"
                        onClick={() => void closeSessionTab(t.id)}
                      >
                        ×
                      </button>
                    </header>
                    <div className="session-pane-terminal">
                      <TerminalView connection={t.conn} />
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
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
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setShowAdd(false)}>Vazgeç</button>
              <button className="btn primary" onClick={async () => {
                if (editing) {
                  const updated: Connection = { ...editing, name, host, port, username };
                  if (password) {
                    await window.electronAPI.saveSecret(updated.id, password);
                  }
                  await window.electronAPI.updateConnection(updated);
                  const list = await window.electronAPI.getConnections();
                  setConnections(list || []);
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

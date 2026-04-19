// src/components/TerminalView.tsx
import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import type { ITheme } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

/** Tokyo Night–esque palette: okunaklı ANSI renkleri */
const terminalTheme: ITheme = {
    background: '#1a1b26',
    foreground: '#a9b1d6',
    cursor: '#7dcfff',
    cursorAccent: '#1a1b26',
    selectionBackground: '#33467c80',
    selectionForeground: '#c0caf5',
    black: '#32344a',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#a9b1d6',
    brightBlack: '#444b6a',
    brightRed: '#ff899d',
    brightGreen: '#b9f27c',
    brightYellow: '#ffdb8e',
    brightBlue: '#8db0ff',
    brightMagenta: '#c7a9ff',
    brightCyan: '#9ae9ff',
    brightWhite: '#c8d3f5',
};

type Connection = { id: string; name: string; host: string; port?: number; username: string; password?: string };
export default function TerminalView({ connection }: { connection: Connection }) {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const term = new Terminal({
            theme: terminalTheme,
            cursorBlink: true,
            cursorStyle: 'bar',
            cursorWidth: 2,
            fontFamily:
                '"JetBrains Mono", "SF Mono", "Fira Code", ui-monospace, "Cascadia Code", Menlo, Monaco, Consolas, monospace',
            fontSize: 13,
            lineHeight: 1.35,
            letterSpacing: 0.02,
            allowTransparency: false,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(el);
        const doFit = () => {
            try {
                fit.fit();
            } catch {
                /* ignore fit before layout is ready */
            }
        };
        doFit();

        let ptyResizeTimer: ReturnType<typeof setTimeout> | null = null;
        const notifyRemoteSize = () => {
            doFit();
            const { cols, rows } = term;
            if (cols < 1 || rows < 1) return;
            if (ptyResizeTimer) clearTimeout(ptyResizeTimer);
            ptyResizeTimer = setTimeout(() => {
                ptyResizeTimer = null;
                window.electronAPI.resizeSession(
                    connection.id,
                    term.cols,
                    term.rows,
                    el.clientHeight,
                    el.clientWidth,
                );
            }, 40);
        };

        const ro = new ResizeObserver(() => notifyRemoteSize());
        ro.observe(el);
        window.addEventListener('resize', notifyRemoteSize);

        term.write(`Connecting to ${connection.host}...\r\n`);
        const sshCfg = {
            host: connection.host,
            port: connection.port,
            username: connection.username,
            password: connection.password,
            cols: term.cols,
            rows: term.rows,
        };
        window.electronAPI
            .openSession(connection.id, sshCfg)
            .then(() => {
                doFit();
                window.electronAPI.resizeSession(
                    connection.id,
                    term.cols,
                    term.rows,
                    el.clientHeight,
                    el.clientWidth,
                );
                term.write('Shell opened.\r\n');
            })
            .catch((e) => term.write(`Error: ${String(e)}\r\n`));
        const offData = window.electronAPI.onSessionData(connection.id, (data) => term.write(data));
        const inputDisposer = term.onData((input) => window.electronAPI.sendSessionInput(connection.id, input));

        return () => {
            if (ptyResizeTimer) clearTimeout(ptyResizeTimer);
            ro.disconnect();
            window.removeEventListener('resize', notifyRemoteSize);
            offData?.();
            inputDisposer?.dispose?.();
            term.dispose();
        };
    }, [connection]);

    return (
        <div className="terminal-shell">
            <div ref={ref} className="terminal-view" />
        </div>
    );
}

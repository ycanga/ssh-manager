// src/components/TerminalView.tsx
import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

type Connection = { id: string; name: string; host: string; port?: number; username: string; password?: string };
export default function TerminalView({ connection }: { connection: Connection }) {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const term = new Terminal({
            theme: { background: '#0f172a', foreground: '#e2e8f0' },
            cursorBlink: true,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(ref.current!);
        fit.fit();
        term.write(`Connecting to ${connection.host}...\r\n`);
        // Session-scoped channels
        window.electronAPI
            .openSession(connection.id, connection)
            .then(() => term.write('Shell opened.\r\n'))
            .catch((e) => term.write(`Error: ${String(e)}\r\n`));
        const offData = window.electronAPI.onSessionData(connection.id, (data) => term.write(data));
        const inputDisposer = term.onData((input) => window.electronAPI.sendSessionInput(connection.id, input));

        return () => {
            offData?.();
            inputDisposer?.dispose?.();
            term.dispose();
        };
    }, [connection]);

    return <div ref={ref} className="w-full h-full" />;
}

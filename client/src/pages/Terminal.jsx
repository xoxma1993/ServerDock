import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import 'xterm/css/xterm.css';
import { useAuthStore } from '../store';

export default function Terminal() {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const [fontSize, setFontSize] = useState(14);
  const token = useAuthStore((s) => s.token);

  const connect = () => {
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws/terminal?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      termRef.current?.write('Connected to ServerDock terminal\r\n');
    };
    ws.onmessage = (ev) => {
      termRef.current?.write(ev.data);
    };
    ws.onclose = () => {
      termRef.current?.write('\r\n*** Disconnected ***\r\n');
    };
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new XTerm({
      fontFamily: 'JetBrains Mono, monospace',
      fontSize,
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3'
      }
    });
    termRef.current = term;
    term.open(containerRef.current);
    term.focus();
    term.onData((data) => {
      wsRef.current?.send(data);
    });
    connect();

    return () => {
      wsRef.current?.close();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize;
    }
  }, [fontSize]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2 text-xs text-text-secondary">
        <button
          onClick={() => setFontSize((s) => Math.max(10, s - 1))}
          className="px-2 py-1 border border-border rounded hover:bg-bg-elevated"
        >
          A-
        </button>
        <button
          onClick={() => setFontSize((s) => s + 1)}
          className="px-2 py-1 border border-border rounded hover:bg-bg-elevated"
        >
          A+
        </button>
        <button
          onClick={() => {
            wsRef.current?.close();
            connect();
          }}
          className="ml-2 px-2 py-1 border border-border rounded hover:bg-bg-elevated"
        >
          Reconnect
        </button>
      </div>
      <div ref={containerRef} className="flex-1 border border-border rounded bg-black" />
    </div>
  );
}


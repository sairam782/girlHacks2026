'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Orb, Wave } from './trees';

const serif = "'Instrument Serif', serif";
const mono = "'Geist Mono', monospace";

type Status = 'idle' | 'listening' | 'thinking' | 'speaking';
interface Line { who: 'you' | 'canopy'; text: string }

// Minimal typing for the browser speech API, which TypeScript's DOM lib does not include.
interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; abort(): void;
}
type RecognitionCtor = new () => Recognition;

const HINTS = ["What's at risk?", 'Who is slipping?', 'Push the security review to Thursday', 'Nudge the owner'];

// Talk to Canopy: speak, it acts on your real commitments and answers out loud.
export function VoiceAgent({ personId, personName, asof, onChanged, onClose }: {
  personId: string; personName: string; asof: string; onChanged: () => void; onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState('');
  const [changes, setChanges] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [typed, setTyped] = useState('');
  const [canListen, setCanListen] = useState(true);
  const rec = useRef<Recognition | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const alive = useRef(true);
  const linesRef = useRef<Line[]>([]);

  useEffect(() => { linesRef.current = lines; }, [lines]);

  const stopSpeaking = () => {
    audio.current?.pause();
    audio.current = null;
    window.speechSynthesis?.cancel();
  };

  const say = useCallback((text: string, src: string | null) => {
    const done = () => alive.current && setStatus('idle');
    setStatus('speaking');
    if (src) {
      const a = new Audio(src);
      audio.current = a;
      a.onended = done;
      a.play().catch(done);
    } else if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.onend = done;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } else done();
  }, []);

  const send = useCallback(async (said: string) => {
    const history = linesRef.current.slice(-6);
    setLines((l) => [...l, { who: 'you', text: said }]);
    setInterim('');
    setStatus('thinking');
    try {
      const r = await fetch('/api/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ said, personId, asof, history }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Something went wrong');
      if (!alive.current) return;
      setLines((l) => [...l, { who: 'canopy', text: j.reply }]);
      if (j.changes?.length) { setChanges(j.changes); onChanged(); }
      say(j.reply, j.audio);
    } catch (e) {
      setNote((e as Error).message);
      setStatus('idle');
    }
  }, [personId, asof, onChanged, say]);

  const listen = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { setCanListen(false); setNote('This browser cannot record speech. Type instead, or use Chrome or Safari.'); return; }
    stopSpeaking();
    rec.current?.abort();
    const r = new Ctor();
    r.lang = 'en-US';
    r.interimResults = true;
    r.continuous = false;
    let heard = '';
    r.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      heard = res[0].transcript;
      setInterim(heard);
      if (res.isFinal) { r.onend = null; r.abort(); void send(heard.trim()); }
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { setCanListen(false); setNote('Microphone access is blocked. Allow it in the browser, or type instead.'); }
      else if (e.error === 'no-speech') setNote('I did not hear anything. Tap the orb and try again.');
      setStatus('idle');
    };
    r.onend = () => { if (heard.trim()) void send(heard.trim()); else setStatus((s) => (s === 'listening' ? 'idle' : s)); };
    rec.current = r;
    setNote('');
    setInterim('');
    setStatus('listening');
    try { r.start(); } catch { setStatus('idle'); }
  }, [send]);

  useEffect(() => {
    alive.current = true;
    listen(); // opened by a click or the V key, so the browser lets us use the microphone
    return () => { alive.current = false; rec.current?.abort(); stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onOrb = () => {
    if (status === 'listening') { rec.current?.abort(); setStatus('idle'); }
    else if (status === 'idle' || status === 'speaking') listen();
  };
  const orbState = status === 'listening' ? 'listening' : status === 'speaking' ? 'speaking' : changes.length && status === 'idle' ? 'done' : 'idle';
  const label = { idle: 'Tap to talk', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking' }[status];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'linear-gradient(180deg, rgba(243,242,236,0) 40%, rgba(243,242,236,0.7))' }} />
      <div data-screen-label="Voice agent" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', width: 'min(680px, calc(100% - 32px))', zIndex: 71, display: 'grid', gridTemplateColumns: '128px minmax(0,1fr)', gap: 22, alignItems: 'center', padding: '20px 22px 20px 16px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(18px)', border: '1px solid #e4e2d9', borderRadius: 20, boxShadow: '0 24px 60px rgba(40,55,45,0.18)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <button onClick={onOrb} aria-label={status === 'listening' ? 'Stop listening' : 'Talk to Canopy'} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <Orb state={orbState} size={104} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 14 }}>
            {status === 'listening' && <Wave />}
            <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2f8a77' }}>{label}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a948d' }}>Canopy voice · {personName}</span>
            <button onClick={onClose} style={{ background: 'none', border: '1px solid #e4e2d9', borderRadius: 7, padding: '3px 8px', fontFamily: mono, fontSize: 10, color: '#7a857e', cursor: 'pointer' }}>ESC</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 210, overflowY: 'auto' }}>
            {lines.length === 0 && !interim && (
              <div style={{ fontSize: 13.5, color: '#65706a', lineHeight: 1.5 }}>
                {status === 'listening' ? 'Go ahead, I am listening.' : 'Tap the orb, then try:'}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {HINTS.map((h) => <button key={h} onClick={() => void send(h)} style={{ background: '#f4f6ec', border: '1px solid #e4e2d9', borderRadius: 12, padding: '3px 10px', fontSize: 12, color: '#3a453e', cursor: 'pointer' }}>“{h}”</button>)}
                </div>
              </div>
            )}
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '54px minmax(0,1fr)', gap: 12, alignItems: 'baseline' }}>
                <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: l.who === 'you' ? '#8a948d' : '#2f8a77' }}>{l.who === 'you' ? 'You' : 'Canopy'}</span>
                {l.who === 'you'
                  ? <span style={{ fontSize: 15, lineHeight: 1.45, color: '#4a554e' }}>{l.text}</span>
                  : <span style={{ fontFamily: serif, fontSize: 21, lineHeight: 1.28, color: '#16211b' }}>{l.text}</span>}
              </div>
            ))}
            {interim && (
              <div style={{ display: 'grid', gridTemplateColumns: '54px minmax(0,1fr)', gap: 12, alignItems: 'baseline' }}>
                <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a948d' }}>You</span>
                <span style={{ fontSize: 15, lineHeight: 1.45, color: '#8a948d' }}>{interim}…</span>
              </div>
            )}
          </div>
          {changes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {changes.map((c) => (
                <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8a5a0c', background: '#fdf3e1', border: '1px solid #f1d9a8', borderRadius: 12, padding: '4px 11px' }}>
                  <span style={{ width: 12, height: 7, borderRadius: '0 100% 0 100%', background: '#e3a33b' }} />
                  {c}
                </span>
              ))}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); const v = typed.trim(); if (v) { setTyped(''); rec.current?.abort(); stopSpeaking(); void send(v); } }} style={{ display: 'flex', gap: 8 }}>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={canListen ? 'Or type it…' : 'Type here…'} style={{ flex: 1, height: 32, padding: '0 10px', borderRadius: 9, border: '1px solid #dcdad0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }} />
          </form>
          {note && <span style={{ fontSize: 11.5, color: '#9c4529' }}>{note}</span>}
        </div>
      </div>
    </>
  );
}

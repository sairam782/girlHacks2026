'use client';

import { useEffect, useRef, useState } from 'react';

const serif = "'Instrument Serif', serif";
const mono = "'Geist Mono', monospace";

export interface BriefingItem { text: string; kind: 'overdue' | 'soon' | 'seed' }

const SPEEDS = [1, 1.25, 1.5];
const BARS = Array.from({ length: 40 }, (_, i) => 6 + Math.round(Math.abs(Math.sin(i * 1.7) * 14 + Math.sin(i * 0.6) * 8)));

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function Marker({ kind }: { kind: BriefingItem['kind'] }) {
  if (kind === 'seed') {
    return <span style={{ width: 9, height: 12, margin: '0 2px', flex: 'none', borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: '#c9a54b' }} />;
  }
  return <span style={{ width: 14, height: 8, flex: 'none', borderRadius: '0 100% 0 100%', background: kind === 'overdue' ? '#b9573a' : '#e3a33b', transition: 'background 1.6s' }} />;
}

// Daily spoken briefing. Audio comes from ElevenLabs via /api/briefing; without an API key it
// falls back to the browser's built-in speech so the demo still talks.
export function MorningBriefing({ dateLabel, items, script }: { dateLabel: string; items: BriefingItem[]; script: string }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(() => Math.round((script.split(/\s+/).length / 150) * 60));
  const [speed, setSpeed] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioFor = useRef('');
  const fallback = useRef(false);

  useEffect(() => () => {
    audio.current?.pause();
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = SPEEDS[speed];
  }, [speed]);

  const speakFallback = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(script);
    u.rate = SPEEDS[speed];
    u.onboundary = (e) => setProgress(e.charIndex / script.length);
    u.onend = () => { setPlaying(false); setProgress(1); };
    synth.speak(u);
    setPlaying(true);
  };

  const toggle = async () => {
    if (playing) {
      if (fallback.current) window.speechSynthesis.cancel();
      else audio.current?.pause();
      setPlaying(false);
      return;
    }
    if (fallback.current) return speakFallback();
    if (!audio.current || audioFor.current !== script) {
      setLoading(true);
      try {
        const res = await fetch('/api/briefing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: script }) });
        if (!res.ok) throw new Error('briefing audio unavailable');
        const url = URL.createObjectURL(await res.blob());
        audio.current?.pause();
        const a = new Audio(url);
        a.playbackRate = SPEEDS[speed];
        a.onloadedmetadata = () => setDuration(a.duration);
        a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
        a.onended = () => setPlaying(false);
        audio.current = a;
        audioFor.current = script;
      } catch {
        fallback.current = true;
        setLoading(false);
        return speakFallback();
      }
      setLoading(false);
    }
    if (audio.current!.ended) audio.current!.currentTime = 0;
    await audio.current!.play();
    setPlaying(true);
  };

  const played = Math.round(progress * BARS.length);

  return (
    <section style={{ background: '#fff', border: '1px solid #e4e2d9', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: serif, fontSize: 23, color: '#16211b' }}>Morning briefing</span>
        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.1em', color: '#65706a', textTransform: 'uppercase' }}>{dateLabel} · {fmt(duration)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5, lineHeight: 1.35 }}>
        {items.map((it) => (
          <div key={it.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Marker kind={it.kind} />
            {it.text}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 13, background: '#eef4ee' }}>
        <button className="hov-primary" onClick={toggle} disabled={loading} aria-label={playing ? 'Pause briefing' : 'Play briefing'}
          style={{ width: 44, height: 44, flex: 'none', borderRadius: '50%', border: 'none', background: '#2f6b4f', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2.5" y="2" width="3" height="10" rx="1" fill="#fff" /><rect x="8.5" y="2" width="3" height="10" rx="1" fill="#fff" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5z" fill="#fff" /></svg>
          )}
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 2 }}>
            {BARS.map((h, i) => (
              <span key={i} style={{ flex: 1, borderRadius: 1, height: h, background: i < played ? '#2f6b4f' : '#c4d3c6', transition: 'background .2s', animation: playing && i === played ? 'wave 0.8s ease-in-out infinite' : undefined }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: mono, fontSize: 10.5, color: '#4a554e' }}>
            <span>{loading ? 'Loading…' : fmt(progress * duration)}</span>
            <button onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)} aria-label="Playback speed"
              style={{ background: 'none', border: 'none', padding: '0 4px', fontFamily: mono, fontSize: 10.5, color: '#4a554e', cursor: 'pointer' }}>
              {SPEEDS[speed]}x
            </button>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#65706a' }}>Voice · Powered by ElevenLabs</div>
    </section>
  );
}

// Floating orb in the bottom-right corner; opens the voice agent.
export function TalkButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ position: 'fixed', right: 28, bottom: 28, zIndex: 50, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 14px', borderRadius: 18, background: '#fff', border: '1px solid #e4e2d9', boxShadow: '0 8px 24px rgba(40,55,45,0.12)', fontSize: 13, color: '#1d2620', whiteSpace: 'nowrap', pointerEvents: 'none', opacity: hover ? 1 : 0, transform: hover ? 'translateX(0)' : 'translateX(8px)', transition: 'opacity .2s, transform .2s' }}>
        Talk to Canopy
        <span style={{ fontFamily: mono, fontSize: 10.5, color: '#65706a', border: '1px solid #e4e2d9', borderRadius: 5, padding: '1px 5px' }}>V</span>
      </span>
      <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)} aria-label="Talk to Canopy"
        style={{ width: 64, height: 64, flex: 'none', borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'radial-gradient(circle at 36% 30%, #ffffff 0%, #c9f2e2 16%, #5fcaa3 42%, #23876a 74%, #155a47 100%)', boxShadow: hover ? '0 0 0 10px rgba(76,195,154,0.22), 0 14px 34px rgba(35,135,106,0.45)' : '0 0 0 8px rgba(76,195,154,0.16), 0 12px 30px rgba(35,135,106,0.4)', transform: hover ? 'scale(1.06)' : 'scale(1)', transition: 'transform .2s, box-shadow .2s', animation: 'orbBreathe 3.4s ease-in-out infinite' }} />
    </div>
  );
}

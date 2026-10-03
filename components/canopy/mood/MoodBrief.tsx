'use client';

// The private spoken recap of one person's own report, in the same player style as Canopy's
// morning briefing. Audio comes from ElevenLabs via the Mood Mirror service; when it has no key,
// the service still returns the script and the browser reads it aloud.

import { useEffect, useRef, useState } from 'react';
import type { MoodReport } from './types';
import { card, cardTitle, mono, PRIVATE, sectionNote } from './ui';

const BARS = Array.from({ length: 36 }, (_, i) => 6 + Math.round(Math.abs(Math.sin(i * 1.7) * 13 + Math.sin(i * 0.6) * 7)));
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function MoodBrief({ report, speaker, who }: { report: MoodReport; speaker: string; who: string }) {
  const [script, setScript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const spoken = useRef(false); // the brief for this person came back without audio

  const stop = () => {
    audio.current?.pause();
    audio.current = null;
    window.speechSynthesis?.cancel();
  };

  // A different person (or meeting) means a different brief.
  useEffect(() => {
    stop();
    setScript(null);
    setPlaying(false);
    setProgress(0);
    setErr(null);
    spoken.current = false;
  }, [speaker, report.id]);

  useEffect(() => () => stop(), []);

  const speak = (text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.onboundary = (e) => setProgress(e.charIndex / text.length);
    u.onend = () => { setPlaying(false); setProgress(1); };
    synth.speak(u);
    setPlaying(true);
  };

  const toggle = async () => {
    if (playing) {
      if (spoken.current) window.speechSynthesis.cancel();
      else audio.current?.pause();
      setPlaying(false);
      return;
    }
    if (audio.current) {
      if (audio.current.ended) audio.current.currentTime = 0;
      await audio.current.play();
      setPlaying(true);
      return;
    }
    if (spoken.current && script) return speak(script);

    setLoading(true);
    setErr(null);
    try {
      const body = new FormData();
      body.append('analysis_id', report.id!);
      body.append('speaker', speaker);
      // The service greets with "Hi {name}." — a first name keeps that from reading "Hi Jordan M..".
      body.append('name', who.trim().split(/\s+/)[0].replace(/\.$/, '') || who);
      const res = await fetch('/api/mood/brief', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.detail || res.statusText);
      setScript(data.script);
      if (!data.audio || !data.url) {
        spoken.current = true;
        speak(data.script);
        return;
      }
      const a = new Audio(data.url);
      a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
      a.onended = () => setPlaying(false);
      audio.current = a;
      await a.play();
      setPlaying(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!report.id) return null; // the brief lives on the service, keyed to an analysis id
  const played = Math.round(progress * BARS.length);
  const seconds = script ? Math.round((script.split(/\s+/).length / 150) * 60) : 0;

  return (
    <section style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={cardTitle}>Hear it back</span>
        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#65706a' }}>
          {who}{seconds ? ` · ${fmt(seconds)}` : ''}
        </span>
      </div>
      <p style={{ ...sectionNote, margin: 0 }}>A spoken recap of this report, for you only.</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 13, background: PRIVATE.bg }}>
        <button className="hov-primary" onClick={toggle} disabled={loading} aria-label={playing ? 'Pause recap' : 'Play recap'}
          style={{ width: 44, height: 44, flex: 'none', borderRadius: '50%', border: 'none', background: '#2f6b4f', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2.5" y="2" width="3" height="10" rx="1" fill="#fff" /><rect x="8.5" y="2" width="3" height="10" rx="1" fill="#fff" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5z" fill="#fff" /></svg>
          )}
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 26, display: 'flex', alignItems: 'center', gap: 2 }}>
            {BARS.map((h, i) => (
              <span key={i} style={{ flex: 1, borderRadius: 1, height: h, background: i < played ? '#2f6b4f' : '#c6c5d6', transition: 'background .2s', animation: playing && i === played ? 'wave 0.8s ease-in-out infinite' : undefined }} />
            ))}
          </div>
          <span style={{ fontFamily: mono, fontSize: 10.5, color: '#4a554e' }}>
            {loading ? 'Writing your recap…' : playing ? 'Playing' : script ? 'Ready' : 'Play your recap'}
          </span>
        </div>
      </div>

      {err && <span style={{ fontSize: 12.5, lineHeight: 1.45, color: '#9c4529' }}>{err}</span>}
      {script && (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: '#65706a', textWrap: 'pretty' }}>{script}</p>
      )}
      <div style={{ textAlign: 'center', fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#65706a' }}>
        Voice · Powered by ElevenLabs
      </div>
    </section>
  );
}

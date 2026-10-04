'use client';

// The opt-in face layer. Off by default, never applied to anyone who has not turned it on, run on
// that person's own video, and the video is deleted as soon as the service has finished reading it.
//
// What it is for: a "yes" is not always real agreement. This flags the moments where the words
// sounded fine but the face did not — the ones most likely to become a wilting leaf.

import { useRef, useState } from 'react';
import { LABEL, TONE, type FaceBlock, type MoodReport } from './types';
import { card, cardTitle, LeafMark, mono, PRIVATE, primaryBtn, secondaryBtn, sectionNote, serif, Tag } from './ui';

export function FaceLayer({ report, speaker, who, onUpdated }: {
  report: MoodReport;
  speaker: string;
  who: string;
  onUpdated: (speaker: string, face: FaceBlock, suggestions: MoodReport['people'][string]['suggestions']) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement | null>(null);

  const face = report.people[speaker]?.face;
  // Only a report from the Python service can take a face layer; it keys the video to an analysis id.
  const available = Boolean(report.id);

  const send = async (body: FormData) => {
    setBusy(true);
    setErr(null);
    try {
      body.append('analysis_id', report.id!);
      body.append('speaker', speaker);
      body.append('consent', 'true');
      const res = await fetch('/api/mood/face', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.detail || res.statusText);
      onUpdated(speaker, data.person.face as FaceBlock, data.person.suggestions);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const body = new FormData();
    body.append('file', f);
    void send(body);
  };

  const header = (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <span style={cardTitle}>Face layer</span>
      <Tag>{face ? face.source : 'Opt-in · off by default'}</Tag>
    </div>
  );

  if (!available) {
    return (
      <section style={{ ...card, padding: 18 }}>
        {header}
        <p style={sectionNote}>
          Reading a video needs the Mood Mirror service running. Start it with{' '}
          <code style={{ fontFamily: mono, fontSize: 11.5 }}>cd mood-mirror &amp;&amp; uvicorn app:app --port 8000</code>, then
          run the meeting again.
        </p>
      </section>
    );
  }

  return (
    <section style={{ ...card, padding: 18 }}>
      {header}
      <p style={sectionNote}>
        Your own words next to your own expression, so you can see where the two disagreed. Read from {who}&apos;s video only,
        on this machine, and the video is deleted right after it is processed.
      </p>

      {face ? <FaceReport face={face} /> : (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: PRIVATE.bg, border: `1px solid ${PRIVATE.line}`, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, lineHeight: 1.5, color: '#3a453e', cursor: 'pointer' }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 2, width: 15, height: 15, accentColor: PRIVATE.fill, flex: 'none', cursor: 'pointer' }} />
            <span>
              This is my own video and I want it read for my report. Nobody else&apos;s face is analysed, and the file is
              deleted as soon as it has been processed.
            </span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <button onClick={() => picker.current?.click()} disabled={!consent || busy}
              style={{ ...primaryBtn, background: consent && !busy ? '#2f6b4f' : '#b9c3bb', cursor: consent && !busy ? 'pointer' : 'not-allowed' }}>
              {busy ? 'Reading the video…' : 'Add my video'}
            </button>
            {report.has_meeting_video && (
              <button onClick={() => { const b = new FormData(); b.append('use_meeting_video', 'true'); void send(b); }}
                disabled={!consent || busy} style={{ ...secondaryBtn, opacity: consent && !busy ? 1 : 0.5, cursor: consent && !busy ? 'pointer' : 'not-allowed' }}>
                Use the meeting video
              </button>
            )}
            <input ref={picker} type="file" accept=".mp4,.mov,.webm,.mkv,.avi,.m4v" onChange={onPick} style={{ display: 'none' }} />
          </div>
          {err && <span style={{ fontSize: 12.5, lineHeight: 1.45, color: '#9c4529' }}>{err}</span>}
        </div>
      )}
    </section>
  );
}

function FaceReport({ face }: { face: FaceBlock }) {
  const stat = (v: string, k: string) => (
    <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontFamily: serif, fontSize: 26, lineHeight: 1, color: '#16211b' }}>{v}</span>
      <span style={{ fontSize: 11.5, color: '#8a948d', lineHeight: 1.35 }}>{k}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', padding: '12px 15px', borderRadius: 12, background: PRIVATE.bg, border: `1px solid ${PRIVATE.line}` }}>
        {stat(face.agreement == null ? '—' : `${Math.round(face.agreement * 100)}%`, 'words and face agreed')}
        {stat(`${Math.round(face.face_rate * 100)}%`, 'of frames had a face')}
        {stat(String(face.mismatches.length), 'said one thing, looked another')}
      </div>

      {face.mismatches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: '#3a453e' }}>Where your words and your face disagreed</span>
          {face.mismatches.map((m) => (
            <div key={m.id} style={{ padding: '12px 14px', borderRadius: 12, background: '#f8f8f3', border: '1px solid #ebeae2', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <Tag ink={TONE[m.said].text} bg={TONE[m.said].bg}>
                  <LeafMark color={TONE[m.said].fill} w={11} h={6} />Said {LABEL[m.said]}
                </Tag>
                <span style={{ color: '#b4bcb6' }}>·</span>
                <Tag ink={TONE[m.looked].text} bg={TONE[m.looked].bg}>
                  <LeafMark color={TONE[m.looked].fill} w={11} h={6} />Looked {LABEL[m.looked]}
                </Tag>
                <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 10.5, color: '#8a948d' }}>{m.time}</span>
              </div>
              <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 19, lineHeight: 1.3, color: '#16211b', textWrap: 'pretty' }}>“{m.text}”</div>
              <span style={{ fontSize: 11.5, color: '#8a948d' }}>Expression confidence {Math.round(m.conf * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      {face.reactions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: '#3a453e' }}>Reactions you kept to yourself</span>
          {face.reactions.map((r) => (
            <div key={r.id} style={{ padding: '11px 14px', borderRadius: 12, background: '#f8f8f3', border: '1px solid #ebeae2', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <Tag ink={TONE[r.looked].text} bg={TONE[r.looked].bg}>
                  <LeafMark color={TONE[r.looked].fill} w={11} h={6} />Looked {LABEL[r.looked]}
                </Tag>
                <span style={{ fontSize: 12, color: '#65706a' }}>while {r.speaker} was talking</span>
                <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 10.5, color: '#8a948d' }}>{r.time}</span>
              </div>
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: '#65706a' }}>“{r.text}”</span>
            </div>
          ))}
        </div>
      )}

      {face.mismatches.length === 0 && face.reactions.length === 0 && (
        <span style={{ fontSize: 13, color: '#8a948d' }}>Your words and your expression lined up all the way through.</span>
      )}
    </div>
  );
}

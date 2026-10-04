'use client';

// Grove rail teaser: the way into Mood Mirror from the home screen.

const serif = "'Instrument Serif', serif";
const mono = "'Geist Mono', monospace";

export function MoodCard({ onOpen }: { onOpen: () => void }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e4e2d9', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontFamily: serif, fontSize: 23, color: '#16211b' }}>Mood Mirror</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4b4d72', whiteSpace: 'nowrap' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6f7196' }} />
          Private
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: '#7a857e' }}>
        Canopy tracks what you owe. Mood Mirror covers how the meeting felt while you agreed to it — the tone of each
        moment, what triggered it, and what to do next. Only you see your own report.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 13, background: 'linear-gradient(135deg, #f1f0f6, #eef1f6)' }}>
        <span style={{ width: 34, height: 34, flex: 'none', borderRadius: '2px 100% 2px 100%', background: 'linear-gradient(135deg, #a9b0d4, #6f7196)' }} />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, color: '#1d2620', lineHeight: 1.3 }}>Q4 Vendor Migration · Monday standup</span>
          <span style={{ fontFamily: mono, fontSize: 10.5, color: '#65706a' }}>3:05 · 5 speakers · ready</span>
        </div>
      </div>
      <button className="hov-primary" onClick={onOpen}
        style={{ height: 40, borderRadius: 11, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>
        Open your report
      </button>
      <div style={{ textAlign: 'center', fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#65706a' }}>
        Tone · Powered by Azure OpenAI
      </div>
    </section>
  );
}

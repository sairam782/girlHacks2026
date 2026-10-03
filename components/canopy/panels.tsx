'use client';

import { initials, SEEDS } from './data';
import type { SelData } from './selection';

const serif = "'Instrument Serif', serif";
const mono = "'Geist Mono', monospace";
const card = { background: '#fff', border: '1px solid #e4e2d9', borderRadius: 16 } as const;
const cardTitle = { fontFamily: serif, fontSize: 23, color: '#16211b' } as const;

export interface Person { name: string; init: string; bg: string; ratio: string; pct: string; bar: string }

export function UnownedDecisions({ planted, picking, orphanCount, onPlant, onPick }: {
  planted: Record<string, string>;
  picking: string | null;
  orphanCount: number;
  onPlant: (id: string) => void;
  onPick: (id: string, name: string) => void;
}) {
  return (
    <section style={{ ...card, padding: '18px 18px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={cardTitle}>Unowned decisions</span>
        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8a6a1e' }}>{orphanCount} seeds</span>
      </div>
      <p style={{ margin: '6px 0 8px', fontSize: 12.5, lineHeight: 1.45, color: '#7a857e' }}>Decided out loud, owned by no one. Plant each with an owner.</p>
      {SEEDS.map((s) => {
        const owner = planted[s.id];
        const isPicking = !owner && picking === s.id;
        return (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '14px minmax(0,1fr)', gap: 12, padding: '11px 0', borderTop: '1px solid #efeee7' }}>
            {owner ? (
              <span style={{ width: 12, height: 7, marginTop: 5, borderRadius: '0 100% 0 100%', background: '#4f9d69' }} />
            ) : (
              <span style={{ width: 9, height: 13, margin: '3px 0 0 2px', borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: 'radial-gradient(circle at 40% 30%, #fbefc8, #d9b863 55%, #a17f33)', boxShadow: '0 1px 3px rgba(120,90,30,0.3)' }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <span style={{ fontSize: 13, lineHeight: 1.4, color: '#1d2620' }}>{s.text}</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 10.5, color: '#8a948d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.src}</span>
                {!owner && !isPicking && (
                  <button className="hov-plant" onClick={() => onPlant(s.id)} style={{ flex: 'none', whiteSpace: 'nowrap', background: '#fbf6e6', border: '1px dashed #d9bf7a', borderRadius: 12, padding: '3px 10px', fontSize: 11.5, color: '#7a5c14', cursor: 'pointer' }}>
                    Plant
                  </button>
                )}
              </div>
              {isPicking && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {s.picks.map((n) => (
                    <button key={n} className="hov-pick" onClick={() => onPick(s.id, n)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #dcdad0', borderRadius: 12, padding: '3px 9px 3px 4px', fontSize: 11.5, color: '#1d2620', cursor: 'pointer' }}>
                      <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#e7ece4', fontSize: 8, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(n)}</span>
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {owner && <span style={{ fontSize: 11.5, color: '#2f7a4a' }}>Planted with {owner} on the {s.branch} branch</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function FollowThrough({ people }: { people: Person[] }) {
  return (
    <section style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={cardTitle}>Follow-through</span>
        <span style={{ fontSize: 11.5, color: '#8a948d' }}>Kept on time · 30 days</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 14 }}>
        {people.map((m) => (
          <div key={m.name} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) 92px 30px', gap: 10, alignItems: 'center' }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#2b3630' }}>{m.init}</span>
            <span style={{ fontSize: 13, color: '#2b3630', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
            <span style={{ height: 6, borderRadius: 3, background: '#efeee7', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', borderRadius: 3, width: m.pct, background: m.bar }} />
            </span>
            <span style={{ fontFamily: mono, fontSize: 11, color: '#7a857e', textAlign: 'right' }}>{m.ratio}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceIcon({ k }: { k: 'mtg' | 'chat' | 'doc' }) {
  if (k === 'mtg')
    return (
      <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #65706a', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#65706a' }} />
      </span>
    );
  if (k === 'chat') return <span style={{ width: 12, height: 9, borderRadius: '3px 3px 3px 1px', border: '1.5px solid #65706a', boxSizing: 'border-box' }} />;
  return <span style={{ width: 9, height: 12, borderRadius: '1px 4px 1px 1px', border: '1.5px solid #65706a', boxSizing: 'border-box' }} />;
}

const label = { fontSize: 11.5, color: '#8a948d' } as const;
const secondaryBtn = { height: 38, padding: '0 12px', borderRadius: 10, background: '#fff', border: '1px solid #dcdad0', color: '#3a453e', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' } as const;

export function CommitmentPanel({ sel, nudged, onClose, onNudge }: { sel: SelData; nudged: boolean; onClose: () => void; onNudge: () => void }) {
  return (
    <section data-screen-label="03 Commitment panel" style={{ ...card, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #efeee7' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a948d' }}>{sel.ws} · Commitment</span>
          <button className="hov-close" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #e4e2d9', background: '#fff', color: '#65706a', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
          <span style={{ width: 30, height: 17, marginTop: 8, flex: 'none', borderRadius: '0 100% 0 100%', background: sel.color, transition: 'background 1.6s' }} />
          <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: 28, lineHeight: 1.08, margin: 0, color: '#16211b', textWrap: 'pretty' }}>{sel.title}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '14px 16px', marginTop: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={label}>Owner</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#1d2620' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#e7ece4', fontSize: 9.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sel.init}</span>
              {sel.owner}
            </span>
            {sel.forWho && <span style={label}>Owed to {sel.forWho}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={label}>Due</span>
            <span style={{ fontSize: 13.5, color: '#1d2620', paddingTop: 3 }}>{sel.due}</span>
            {sel.dueWas && (
              <span style={label}>
                originally <span style={{ textDecoration: 'line-through' }}>{sel.dueWas}</span>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={label}>State</span>
            <span style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 500, color: sel.textColor, background: sel.colorBg, border: `1px solid ${sel.colorLine}`, borderRadius: 12, padding: '3px 10px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sel.color }} />
              {sel.stateLabel}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={label}>Slip risk</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: serif, fontSize: 28, lineHeight: 0.9, color: sel.textColor }}>{sel.risk}%</span>
              <span style={{ flex: 1, height: 5, borderRadius: 3, background: '#efeee7', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', borderRadius: 3, width: sel.risk + '%', background: sel.color }} />
              </span>
            </div>
          </div>
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 12.5, lineHeight: 1.5, color: '#65706a', textWrap: 'pretty' }}>{sel.why}</p>
      </div>

      <div style={{ flex: '1 0 auto', minWidth: 0, padding: '16px 20px 8px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: '#3a453e', marginBottom: 12 }}>Lifecycle</div>
        <div style={{ display: 'flex', marginBottom: 20 }}>
          {sel.steps.map((st, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0, paddingRight: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginRight: -8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', background: st.color, boxShadow: `0 0 0 3px ${st.ring}` }} />
                {st.notLast && <span style={{ flex: 1, height: 1, margin: '0 6px', background: '#dcdad0' }} />}
              </div>
              <span style={{ fontSize: 11.5, lineHeight: 1.25, color: '#1d2620' }}>{st.label}</span>
              <span style={{ fontFamily: mono, fontSize: 9.5, color: '#8a948d', overflowWrap: 'anywhere' }}>{st.date}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: '#3a453e' }}>Evidence</span>
          <span style={label}>{sel.evCount}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sel.ev.map((e, i) => (
            <div key={i} style={{ padding: '12px 14px', borderRadius: 12, background: '#f8f8f3', border: '1px solid #ebeae2', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, background: '#fff', border: '1px solid #e4e2d9', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <SourceIcon k={e.k} />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#3a453e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.src}</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: '#8a948d', whiteSpace: 'nowrap' }}>{e.when}</span>
              </div>
              <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 19, lineHeight: 1.28, color: '#16211b', textWrap: 'pretty' }}>“{e.quote}”</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: e.tcText, background: e.tcBg, borderRadius: 9, padding: '2px 8px' }}>{e.tag}</span>
                <span style={label}>{e.who}</span>
              </div>
            </div>
          ))}
        </div>

        {sel.hasContra && <Contradiction />}
      </div>

      <div style={{ position: 'sticky', bottom: 0, display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 20px', borderTop: '1px solid #efeee7', background: '#fff' }}>
        <button className="hov-primary" onClick={onNudge} style={{ flex: '1 1 150px', minWidth: 0, height: 38, padding: '0 12px', borderRadius: 10, border: 'none', background: '#2f6b4f', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {nudged ? `Nudged ${sel.first} with evidence` : `Nudge ${sel.first}`}
        </button>
        <button style={secondaryBtn}>Reassign</button>
        <button style={secondaryBtn}>Mark done</button>
      </div>
    </section>
  );
}

function Contradiction() {
  const side = { background: '#fff', borderRadius: 9, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 } as const;
  const when = { fontFamily: mono, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a948d' } as const;
  const choice = { background: '#fff', border: '1px solid #e3cfc5', borderRadius: 8, padding: '6px 11px', fontSize: 12, color: '#5a3a2e', cursor: 'pointer' } as const;
  return (
    <div style={{ margin: '14px 0', padding: 14, borderRadius: 12, background: '#fbf1ec', border: '1px solid #efd3c6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, background: '#b9573a', transform: 'rotate(45deg)' }} />
        <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9c4529' }}>Contradiction</span>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#8a6a5c' }}>Affects 4 leaves</span>
      </div>
      <div style={{ fontFamily: serif, fontSize: 20, color: '#16211b', margin: '8px 0 10px' }}>Which vendor is this quote for?</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
        <div style={{ ...side, border: '1px solid #ecdcd3' }}>
          <span style={when}>Mon Sep 28 · Standup</span>
          <span style={{ fontSize: 13.5, lineHeight: 1.4, color: '#1d2620' }}>
            Decided to use <strong style={{ fontWeight: 600 }}>Vendor A</strong>.
          </span>
          <span style={{ fontSize: 11, color: '#8a948d' }}>Recorded decision · Dana K.</span>
        </div>
        <div style={{ ...side, border: '1px solid #e5bfae' }}>
          <span style={when}>Thu Oct 1 · Chat thread</span>
          <span style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 16, lineHeight: 1.25, color: '#16211b' }}>“we&apos;re going with Vendor B.”</span>
          <span style={{ fontSize: 11, color: '#8a948d' }}>Marcus L. in #vendor-migration</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        <button style={{ background: '#b9573a', border: 'none', borderRadius: 8, padding: '6px 11px', fontSize: 12, color: '#fff', cursor: 'pointer' }}>Ask Dana to resolve</button>
        <button style={choice}>Keep A</button>
        <button style={choice}>Switch to B</button>
      </div>
    </div>
  );
}


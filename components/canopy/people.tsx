'use client';

import { AV, C, CT, initials } from './data';
import { card, mono, serif } from './panels';
import type { Person, Project } from '@/lib/types';
import type { PersonStat, VItem } from '@/lib/view';

const MAX_SHOWN = 5;

// Team members: what each person owes across every project, worst first.
export function PeopleView({ people, perProject, stats, viewerId, onOpen, onViewAs }: {
  people: Person[];
  perProject: { p: Project; vs: VItem[] }[];
  stats: PersonStat[];
  viewerId: string | null;
  onOpen: (projectId: string, itemId: string) => void;
  onViewAs: (personId: string) => void;
}) {
  const rows = people.map((person, i) => {
    const open = perProject
      .flatMap(({ p, vs }) => vs.filter((v) => v.it.owner_id === person.id && v.it.type === 'action' && v.d.state !== 'x').map((v) => ({ v, p })))
      .sort((a, b) => (a.v.it.deadline ?? '9999').localeCompare(b.v.it.deadline ?? '9999'));
    const atRisk = open.filter(({ v }) => v.d.state !== 'g').length;
    const projects = [...new Set(open.map(({ p }) => p.name))];
    const st = stats.find((s) => s.id === person.id);
    return { person, bg: AV[i % AV.length], open, atRisk, projects, st };
  }).sort((a, b) => b.atRisk - a.atRisk || b.open.length - a.open.length || a.person.name.localeCompare(b.person.name));

  return (
    <div data-screen-label="People" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '4px 24px 20px', gap: 16 }}>
      <div>
        <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a948d' }}>People · {people.length} on the team</div>
        <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: 'clamp(28px, 5vh, 40px)', lineHeight: 1.05, margin: '6px 0 4px', color: '#16211b' }}>Who owes what</h1>
        <div style={{ fontSize: 14, color: '#65706a' }}>Everyone named in a source, with their open commitments across projects. Most at risk first.</div>
      </div>

      {people.length === 0 ? (
        <div style={{ ...card, padding: 24, fontSize: 14, color: '#65706a' }}>No one yet. Paste a transcript and Canopy adds everyone it hears taking on work.</div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, alignContent: 'start', paddingBottom: 96 }}>
          {rows.map(({ person, bg, open, atRisk, projects, st }) => {
            const isYou = person.id === viewerId;
            return (
              <section key={person.id} style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 40, height: 40, flex: 'none', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#2b3630' }}>{initials(person.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: serif, fontSize: 22, lineHeight: 1.1, color: '#16211b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</span>
                      {isYou && <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '0.12em', color: '#2f7a4a', background: '#e8eee6', borderRadius: 8, padding: '2px 7px' }}>YOU</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#7a857e', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {projects.length ? projects.join(' · ') : person.email || 'Nothing open right now'}
                    </div>
                  </div>
                  {!isYou && (
                    <button className="hov-crumb" onClick={() => onViewAs(person.id)} title={`See Canopy as ${person.name}`} style={{ flex: 'none', alignSelf: 'flex-start', marginTop: 2, padding: 0, border: 'none', background: 'none', fontSize: 11, color: '#9aa29c', cursor: 'pointer' }}>view as</button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 18, fontSize: 12, color: '#7a857e' }}>
                  <span><span style={{ fontFamily: serif, fontSize: 20, color: '#16211b' }}>{open.length}</span> open</span>
                  <span><span style={{ fontFamily: serif, fontSize: 20, color: atRisk ? '#a86d10' : '#16211b' }}>{atRisk}</span> at risk</span>
                  <span><span style={{ fontFamily: serif, fontSize: 20, color: '#16211b' }}>{st ? `${st.kept}/${st.total}` : '–'}</span> kept on time</span>
                </div>

                {open.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {open.slice(0, MAX_SHOWN).map(({ v, p }) => {
                      const s = v.d.state as 'g' | 'a' | 'r' | 'd';
                      return (
                        <button key={v.it.id} className="hov-soft" onClick={() => onOpen(p.id, v.it.id)}
                          style={{ display: 'grid', gridTemplateColumns: '14px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '9px 6px', margin: '0 -6px', border: 'none', borderTop: '1px solid #efeee7', borderRadius: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                          <span style={{ width: 14, height: 8, borderRadius: '0 100% 0 100%', background: C[s], transform: s === 'd' ? 'rotate(150deg)' : undefined }} />
                          <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 13, color: '#1d2620', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.it.text}</span>
                            <span style={{ fontSize: 11, color: '#8a948d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                          </span>
                          <span style={{ fontFamily: mono, fontSize: 10.5, color: CT[s], whiteSpace: 'nowrap' }}>{v.it.deadline ? v.due : 'No date'}</span>
                        </button>
                      );
                    })}
                    {open.length > MAX_SHOWN && <div style={{ fontSize: 11.5, color: '#8a948d', paddingTop: 8, borderTop: '1px solid #efeee7' }}>+{open.length - MAX_SHOWN} more</div>}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

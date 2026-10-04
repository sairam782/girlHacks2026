// Calendar-date helpers. Dates are plain 'YYYY-MM-DD' strings in local time, so there is no timezone drift.
const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, '0');
const toUTC = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fromUTC = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

export const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(toUTC(s));
export function todayISO(): string {
  if (process.env.CANOPY_TODAY && isDate(process.env.CANOPY_TODAY)) return process.env.CANOPY_TODAY;
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const addDays = (s: string, n: number) => fromUTC(toUTC(s) + n * DAY);
export const diffDays = (from: string, to: string) => Math.round((toUTC(to) - toUTC(from)) / DAY);
export const weekday = (s: string) => new Date(toUTC(s)).getUTCDay(); // 0 = Sunday

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MOL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = WDL.map((x) => x.toLowerCase());
export const MONTHS = MOL.map((x) => x.toLowerCase());

export const fmt = (s: string) => { const d = new Date(toUTC(s)); return `${WD[d.getUTCDay()]} ${MO[d.getUTCMonth()]} ${d.getUTCDate()}`; };
export const fmtShort = (s: string) => { const d = new Date(toUTC(s)); return `${MO[d.getUTCMonth()]} ${d.getUTCDate()}`; };
export const fmtLong = (s: string) => { const d = new Date(toUTC(s)); return `${WDL[d.getUTCDay()]}, ${MOL[d.getUTCMonth()]} ${d.getUTCDate()}`; };

// Next occurrence of a weekday strictly after `from` (or today when `orToday`).
export function nextWeekday(from: string, wd: number, orToday = false): string {
  let diff = (wd - weekday(from) + 7) % 7;
  if (diff === 0 && !orToday) diff = 7;
  return addDays(from, diff);
}

// Resolves phrases like "by Friday", "tomorrow", "next Tuesday", "Oct 9" against the meeting date. Null if none found.
export function resolveRelative(text: string, meeting: string): string | null {
  const t = text.toLowerCase();
  const iso = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso && isDate(iso[1])) return iso[1];
  const md = t.match(new RegExp(`\\b(${MONTHS.join('|')}|${MO.map((m) => m.toLowerCase()).join('|')})\\.? (\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (md) {
    const mi = MONTHS.findIndex((m) => m.startsWith(md[1].slice(0, 3)));
    const y = Number(meeting.slice(0, 4));
    let cand = `${y}-${pad(mi + 1)}-${pad(Number(md[2]))}`;
    if (isDate(cand) && diffDays(meeting, cand) < -30) cand = `${y + 1}-${pad(mi + 1)}-${pad(Number(md[2]))}`;
    if (isDate(cand)) return cand;
  }
  if (/\b(today|eod|end of (the )?day|tonight)\b/.test(t)) return meeting;
  if (/\btomorrow\b/.test(t)) return addDays(meeting, 1);
  if (/\bend of (the )?week\b|\beow\b/.test(t)) return nextWeekday(meeting, 5, true);
  if (/\bnext week\b/.test(t)) return nextWeekday(meeting, 1);
  if (/\bend of (the )?month\b/.test(t)) {
    const [y, m] = meeting.split('-').map(Number);
    return fromUTC(Date.UTC(y, m, 0));
  }
  // "by the 14th", "Monday the 12th" — the next time that day of the month comes round.
  // Checked before the weekday rule so "Monday the 12th" resolves to the 12th, not to Monday.
  const dom = t.match(/\bthe (\d{1,2})(?:st|nd|rd|th)\b/);
  if (dom) {
    const day = Number(dom[1]);
    const [y, m] = meeting.split('-').map(Number);
    if (day >= 1 && day <= 31) {
      let cand = fromUTC(Date.UTC(y, m - 1, day));
      if (diffDays(meeting, cand) < 0) cand = fromUTC(Date.UTC(y, m, day));
      return cand;
    }
  }
  const wd = t.match(new RegExp(`\\b(next |this )?(${WEEKDAYS.join('|')})\\b`));
  if (wd) {
    const idx = WEEKDAYS.indexOf(wd[2]);
    let d = nextWeekday(meeting, idx, true);
    if (wd[1] === 'next ' && diffDays(meeting, d) < 7) d = addDays(d, 7);
    return d;
  }
  const inN = t.match(/\bin (\d+) (day|week)s?\b/);
  if (inN) return addDays(meeting, Number(inN[1]) * (inN[2] === 'week' ? 7 : 1));
  return null;
}

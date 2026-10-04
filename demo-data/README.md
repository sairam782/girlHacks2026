# Demo data

Synthetic data for showing Canopy at full strength: all four leaf colors, history with real slips, unowned decisions, a full follow-through board, and a briefing worth hearing. Nothing here is real. Names, projects, and the `northwind.example` emails are invented.

## Load it

| Way | How |
| --- | --- |
| In the app (empty) | Open the Grove and click **Load demo data**. |
| In the app (already has data) | Sidebar, bottom: **Reset to demo data**, then click again to confirm. This **replaces everything**. |
| API | `curl -X POST localhost:3000/api/demo -H 'content-type: application/json' -d '{}'` (add `"force":true` to replace existing data) |
| Copy the snapshot | Copy `store.snapshot.json` to `.data/store.json`. Dates in it are fixed to **Mon Oct 5, 2026**, so pin the clock: `CANOPY_TODAY=2026-10-05` in `.env.local`. |

The generator (`lib/demo.ts`) builds everything **relative to today**, so leaves are always in the right colors no matter when you load it. To match the README's demo day, set `CANOPY_TODAY=2026-10-05` before loading.

If `DATABASE_URL` is set, the history events are also written to Tiger Data. Loading the demo again first deletes the previous demo events there (only for the three demo projects), so nothing is duplicated.

## What is inside

| | Count |
| --- | --- |
| Projects | 3: Q4 Vendor Migration, Onboarding Revamp, Payroll API Launch |
| People | 11, all with emails |
| Sources | 11: meetings, chat threads, and doc comments |
| Commitments | 67 (actions, owned decisions, and unowned seeds) |
| History events | about 105 (created, moved, reassigned, edited, done, overdue) |

On Mon Oct 5 the leaves split like this: 26 green, 6 yellow, 3 wilting, 2 fallen, 18 done. There are 5 unowned items waiting to be planted.

Every commitment sits on the exact line it came from, so the source quote in the panel always matches the Sources tab.

## The three projects

| Project | Story | Health |
| --- | --- | --- |
| **Q4 Vendor Migration** | The troubled one. Three branches (Legal, Engineering, Finance). A quote that slipped twice, a DPA gone fallen, a budget sign-off wilting, a security review due tomorrow, a reassigned task, and two unowned items. | 83%, 71% green days |
| **Onboarding Revamp** | The healthy one. Mostly done or green, one yellow, a single slip. Shows what a good project looks like. | 100% |
| **Payroll API Launch** | In between. A wilting tax endpoint, a fallen regression pass, two items due within 3 days, an unowned incident runbook. | 85% |

## Who to view as

The first person in the list is the default, and it is the best one to demo.

| Person | Why they are interesting |
| --- | --- |
| **Jordan M.** (default) | One overdue item (budget, 2 days), one due tomorrow (security review), three more this week. Follow-through 1/3. Great briefing. |
| **Dana K.** | Perfect record, 2/2. Owns most decisions. |
| **Sam R.** | Mixed: 2 of 4 kept. A done-late wiki item and a wilting runbook. |
| **Chloe B.** | Strong but with one fallen leaf. Received a reassigned task. |
| **Nia O.** | 0/1: her only finished item was late. |
| **Priya S.** | Perfect so far, but her quote leaf has slipped twice. |

## A five-minute demo

1. **Grove.** Three trees, three health levels. Say who you are viewing as.
2. **Briefing.** Press play on the card. It reads Jordan's overdue budget first.
3. **Open Q4 Vendor Migration.** Point at the red and yellow leaves. Click the quote leaf: moved twice, the lifecycle strip, the exact quote.
4. **Orb.** Say (or type) "Push the security review to Thursday." The leaf changes, a slip is recorded, Canopy answers aloud.
5. **Timeline.** The slip you just made appears in "How deadlines slipped". Show the green and red day strip.
6. **Time travel.** Click **+3d** and watch yellow leaves wilt and the briefing change.
7. **Unowned decisions.** Plant the support rota with an owner. The seed becomes a leaf.
8. **Paste a transcript live.** Use a file from `transcripts/` (see below). Watch Gemini find owners and dates, and a new tree grow.
9. **Mood Mirror.** Open the private report for the same meeting.

## Transcripts to paste live

Use **Add a source** and set the meeting date to the day you present. Paste a file's text in the box. These are a fresh project ("Customer Portal Redesign"), so create it first.

| File | Tests |
| --- | --- |
| `01-kickoff-meeting.txt` | Relative dates ("by Friday", "next Wednesday"), a hedge from Mei, an **unowned decision** (analytics plan), a question nobody answers, and a decision ("freeze new features"). |
| `02-chat-thread.txt` | Timestamps in the text, "Probably Thursday" hedging, a decision, an item with no owner and no taker, and an ownership promise with a date ("by Monday"). |
| `03-doc-comments.txt` | Comment-style text, an explicit date ("by the 14th"), an item with no date ("Will follow up"), and a decision. |

Expect Gemini to return some of these as unowned or dateless on purpose. The app should show them as seeds instead of guessing.

## Notes

- The data is generated, not recorded, so the Mood Mirror demo meeting still uses its own sample transcript.
- Loading the demo replaces the app's local data. It does not touch `.env.local` or your keys.
- The only mutable state a demo run leaves behind is whatever you edit live. Reset to demo data to put everything back.

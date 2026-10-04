# Canopy: Frontend Overview

> "Meetings end. Commitments should not."

Canopy tracks the commitments people make in meetings, chat, and docs ("I'll send the quote by Wednesday") and shows them as leaves on a tree. Each project is a tree, each workstream is a branch, and each commitment is a leaf colored by its deadline.

| Leaf | Meaning |
|---|---|
| Green | Due more than 3 days out |
| Yellow | Due within 3 days |
| Wilting (red) | 1 to 2 days late |
| Fallen (brown, on the ground) | 3 or more days late; still tracked |
| Bloom | Done |
| Seed | A decision or task nobody owns yet |

The app is a single Next.js page (`app/page.tsx` → `components/canopy/CanopyApp.tsx`). **All data is real**: it comes from `GET /api/state`, which reads the JSON store in `.data/` (and Tiger Data when `DATABASE_URL` is set). Nothing is hard-coded demo data anymore; an empty install starts with no projects. For the file-by-file code map and API routes, see the [README](README.md#code-map).

## Screens and features

### 1. The Grove (home)
- "Good morning, [viewer]" and a summary line for all projects.
- One procedurally drawn tree per project, with health %, leaf counts (green, yellow, wilting, fallen) and **Open tree →**. Clicking a tree opens it.
- Empty state: "No trees yet" with **Plant your first project**.
- Animated background: sunlight, mist and fireflies.

### 2. Left sidebar (shown when the window is at least 1180px wide)
- Logo (back to the Grove) and the tagline.
- Nav: **The Grove**, **Add a source**, **Sources**, **Mood Mirror**, **People**.
- Project list with health dots and percentages; each opens its tree.
- **Time travel**: −1d, +1d, +3d and back to today, to watch leaves yellow, wilt and fall. **Reset demo data** restores the demo grove.
- Engine status: Gemini, ElevenLabs and Tiger Data, each shown as live or on its fallback.
- **+ New project**.

### 3. Header
- **+ Paste a transcript** (opens the ingest dialog, or New project if there are none). Gemini extracts, then you review each item (owner, date, workstream, keep or drop) before **Plant N on the tree**. The same text twice is refused; items already on the tree are skipped.
- Below 1180px wide, People, Mood Mirror and +1 day buttons appear here in place of the sidebar.
- **Viewing as** dropdown: whose briefing, owed list and voice agent you see. Saved in the browser.
- Live counts: active commitments, at risk, orphaned decisions.

### 4. Tree view (one project)
- Breadcrumb, project name, summary (active, at risk, fallen, bloomed) and owner avatars.
- Tabs:
  - **Tree view**: the tree, with leaves grouped into up to three workstream branches; hover to enlarge, click to open the commitment panel; legend with live counts; zoom **+ / − / FIT**.
  - **List**: every item in a table; click a row to open it.
  - **Sources**: the ingested transcripts, chats and docs, each with **Delete** (removes the source and its items).
  - **Timeline**: how deadlines slipped and the full event log.
- Empty state: "A bare trunk" with **Add a source**.

### 5. Commitment panel (right rail when an item is selected)
- Title, owner, due date (with the original struck through if it slipped), state, **slip risk %**, lifecycle, and the source quote it was extracted from.
- **Mark done** (or reopen), **Nudge**, **Edit owner / date** and **Delete**. Changes save through `/api/items/[id]` and are logged as events.
- A Mood Mirror note when the owner sounded strained while committing (+15% slip risk), with **Clear**.
- **Delete project** sits in the tree header.

### 6. Right rail when nothing is selected
- **Morning briefing**: what the viewer owes (overdue first) with a play button, waveform, timer and speed control. Each line opens its commitment; "N more this week" opens People; the seeds line opens the first unowned decision. Audio is ElevenLabs, or the browser voice without a key.
- **Mood Mirror** card: opens Mood Mirror.
- **Unowned decisions**: seeds for the open project. **Plant** one by picking a person or typing a new name.
- **Decisions**: the project's branch notes.
- **Follow-through**: each person's kept-on-time ratio.

### 7. Talk to Canopy (green orb bottom right, or press **V**)
- Speak (browser speech recognition) or type. Suggested prompts: "What do I owe?", "Push the pricing to Thursday", "Mark the budget done".
- Intents: what you owe, your briefing, move a deadline, mark done, reassign. Gemini picks the intent and the item; the app makes the change and writes the reply from what actually happened.
- Replies are spoken with ElevenLabs (or the browser voice). Changes refresh the tree immediately.
- The orb hides while the agent is open and while a commitment panel is open.

### 8. People
- One card per team member, most at-risk first: projects, open count, at risk, kept on time, and their next 5 open commitments (click to open).
- **View as** switches the whole app to that person.

### 9. Mood Mirror
- A private per-person report on how a meeting felt: tone per sentence with the exact words, causes of mood shifts, a score against the team average, next steps, a spoken recap, and the commitments that person took on.
- **Share as at risk** (the person's own choice) records the strained tone on those commitments, raising their slip risk on the tree. The report itself stays private.
- Two demo meetings and transcript uploads work in the browser. Recordings, the opt-in face layer and the spoken recap need the Python service in `mood-mirror/`.

### 10. Keyboard shortcuts
- `V`: open Talk to Canopy
- `Esc`: close Talk to Canopy, or deselect the current item

---

## Known gaps

| Gap | Notes |
|---|---|
| Thin navigation on narrow screens | Below 1180px the sidebar is replaced by People, Mood Mirror and +1 day buttons in the header; New project and Reset are only in the sidebar. Below 1000px the right rail is hidden |
| No search | There is no search box or ⌘K |
| No auth | "Viewing as" is a dropdown, not a login. Anyone can view as anyone |
| No nudges or notifications | Nothing is sent to an owner when a date moves or a leaf yellows |
| No contradiction detection | Conflicting decisions across sources are not flagged |
| Avatars are static | Owner avatars in the Tree view header don't open anything |
| Data on the host's disk | Without `DATABASE_URL`, data lives in `.data/` and is lost if the host wipes its disk |

## Backend status

| Feature | Status |
|---|---|
| Projects and sources | Built: `POST /api/projects`, `POST /api/ingest` (with a preview step), and delete for items, sources and projects |
| Demo reset | Built: `POST /api/reset` and the **Reset demo data** button |
| Extraction (decision, owner, deadline, workstream, source line) | Built: Gemini, with a rules fallback |
| Leaf states and slip risk | Built: derived from deadline, status and slips (`lib/leaf.ts`) |
| Edit, reassign, mark done | Built: `PATCH /api/items/[id]`, logged as events |
| History | Built: events in the JSON store, and a Tiger Data hypertable when `DATABASE_URL` is set |
| Morning briefing | Built: script plus ElevenLabs audio, cached per person per day |
| Voice agent | Built: `POST /api/voice` |
| Follow-through | Built: computed from done dates vs deadlines |
| Mood Mirror | Built: `/api/mood/*`, plus the Python service for recordings and the face layer |
| Auto-ingest (Slack, Zoom, calendar) | Not built |
| Nudges and notifications | Not built |
| Search | Not built |
| Auth and teams | Not built |
| Real-time updates | Not built; the UI refreshes after each change |

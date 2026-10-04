# Canopy - 

**Meetings end. Commitments should not.**

Canopy turns meeting talk into tracked action. Paste in a transcript, a chat thread, or a doc. Canopy pulls out every decision, who owns it, and when it is due, and grows each one into a leaf on the project's tree. Each person then gets a 60-second spoken briefing each morning on what they owe, and can talk back to change it.

[Canopy – Live Demo](https://getcanopy.work/)

## The problem

Most meetings produce decisions that nobody writes down well. Owners are vague, deadlines drift, and people find out they dropped something only when it is late. Notes exist, but nobody reads them.

## The idea

Canopy has two parts: **tracking** what people commit to, and **Mood Mirror**, a private view of how each person felt in the meeting where they committed.

Treat every project as a tree.

- The **trunk** is the project.
- **Branches** are workstreams.
- **Leaves** are action items, each with an owner and a date.

A leaf's color comes from its real deadline, so the tree stays honest:

| State | Rule |
| --- | --- |
| Green | Due more than 3 days out |
| Yellow | Due within 3 days |
| Wilting | Overdue by 1 to 2 days |
| Fallen | Overdue by 3 or more days (it drops to the ground but stays tracked) |
| Bloom | Marked done |

A decision that nobody owns yet is a **seed**. It shows in the "Unowned decisions" card until someone is planted as its owner.

## What you can do

| Screen | What it shows |
| --- | --- |
| **The Grove** | Every project as a tree, with its health percentage and leaf counts |
| **Add a source** | Paste text, Gemini extracts, then you **review** every item (fix owner, date, workstream, or untick it) before it is planted. Pasting the same text twice is refused, and items already on the tree are skipped |
| **Tree view** | One project's tree. Tabs for **List**, **Sources** (the ingested text, each with **Delete** to undo a bad paste) and **Timeline** (every event on every leaf) |
| **Commitment panel** | Click a leaf: owner, due date, slip risk, history, the source quote, plus **Mark done**, **Nudge**, **Edit owner / date** and **Delete** |
| **Morning briefing** | Card in the right rail: what you owe (overdue first), a play button, waveform and speed control. Voiced by ElevenLabs |
| **Talk to Canopy** | The green orb at the bottom right (or press **V**). Ask "What do I owe?", or say "Push the pricing to Thursday", "Mark the budget done", "Give the PO to Lena". Canopy makes the change and answers out loud |
| **People** | Everyone on the team, sorted by at-risk work: open commitments, follow-through, and **View as** to see the app as them |
| **Mood Mirror** | A private per-person report on how a meeting felt (see below). One click flags the leaves someone took on under strain, which raises their slip risk |
| **Time travel** | Sidebar buttons that move "today" forward or back, so you can watch leaves yellow, wilt and fall. **Reset demo data** restores the demo grove |
| **Viewing as** | Header dropdown that switches whose briefing, owed list and voice agent you see |

## How it works

1. **Ingest.** Paste a meeting transcript, chat thread, or doc into a project.
2. **Extract.** Gemini reads the text and returns structured items: decision or action, owner, deadline, workstream, and the source line it came from.
3. **Grow the tree.** Each owned action becomes a leaf. Ownerless items become seeds. Decisions attach as branch notes.
4. **Track over time.** Every change (created, reassigned, deadline moved, edited, done, reopened, overdue) is stored as a timestamped event in a Tiger Data hypertable.
5. **Brief.** Each morning Canopy writes a ~150-word script per person: overdue first, then today, then this week. ElevenLabs reads it aloud in about 60 seconds.
6. **Talk back.** The voice agent hears a request in the browser, Gemini picks the intent and the item, and the app runs the change itself. The spoken reply is written from what actually happened, so it never claims a change that did not occur.

## Mood Mirror

Canopy tracks what people owe. Mood Mirror covers how the meeting felt while they were agreeing to it. It turns a meeting into a **private report for each person**.

1. **Who said what.** ElevenLabs Scribe transcribes the recording and separates speakers, with Azure AI Speech as the fallback.
2. **Tone per sentence.** Azure OpenAI labels every sentence as happy, confident, confused, anxious, frustrated, sad, angry, or neutral. Each label shows the exact words behind it, so nothing is a black box.
3. **Feelings linked to causes.** It connects a mood shift to what triggered it, such as being cut off or having a question skipped.
4. **Score and next steps.** Each person gets a mood score compared with the team average, plus 2 to 3 concrete next steps tied to specific moments in the meeting, and a spoken recap.
5. **Linked commitments.** The report shows the leaves that person took on in the same meeting. **Share as at risk** is the person's own choice: it marks those leaves with the strained tone (for example "anxious"), each gets +15% slip risk and a note in its commitment panel saying the owner shared it, and the flag is logged as an event. The report itself stays private.

**Optional face layer (opt-in).** If a person turns it on, their own webcam video is read to flag moments where words and expression disagree, like saying "sure, that works" while looking anxious. It is off by default and never applies to anyone who has not opted in.

**Privacy rules**

- Each person sees only their own report.
- Face analysis is opt-in and runs only on that person's own video.
- Videos are deleted right after processing.

**Why it ties into Canopy.** A "yes" in a meeting is not always real agreement. If someone sounded anxious or confused when they took an action item, that leaf is more likely to wilt. Mood Mirror gives them a chance to say so early, instead of finding out on the due date.

Example report (per person, per meeting):

```json
{
  "person": "Priya",
  "mood_score": 62,
  "team_average": 71,
  "moments": [
    {
      "time": "14:32",
      "tone": "anxious",
      "words": "Sure, that works.",
      "cause": "Question about timeline was skipped just before",
      "face_mismatch": true
    }
  ],
  "next_steps": [
    "Follow up on the skipped timeline question with the project lead",
    "Confirm the Friday pricing deadline is realistic before Wednesday"
  ]
}
```

## Running it

```bash
npm install
cp .env.example .env.local   # add keys; every one is optional
npm run dev                  # http://localhost:3000
```

Every key is optional. Without them, extraction and the voice agent use built-in rules, speech uses the browser's own voice, history is kept in a local JSON file, and Mood Mirror labels tone with an offline lexicon.

| Variable | What it turns on |
| --- | --- |
| `GEMINI_API_KEY` | Gemini extraction and voice-agent understanding (`GEMINI_MODEL` defaults to `gemini-2.5-flash`) |
| `ELEVENLABS_API_KEY` | ElevenLabs voice for the briefing and the voice agent (`ELEVENLABS_VOICE_ID` is optional) |
| `DATABASE_URL` | Tiger Data (Timescale) connection string; every commitment event is also written to a hypertable |
| `AZURE_OPENAI_*` | Azure OpenAI tone labels and next steps for Mood Mirror (or `OPENAI_API_KEY`) |
| `MOOD_MIRROR_URL` | Where the Python Mood Mirror service runs (default `http://127.0.0.1:8000`) |
| `CANOPY_TODAY` | Pin "today" to a date for demos, e.g. `2026-10-09` |
| `CANOPY_TZ` | Timezone "today" is measured in (default `America/New_York`), so a UTC server does not flip the date at 8 pm |
| `CANOPY_DATA_DIR` | Where the JSON store and briefing audio live (default `.data/`; on Azure use `/home/data`) |
| `CANOPY_ALLOW_RESET` | Set to `false` to turn off **Reset demo data** on a deployment with real data |

The sidebar shows which engines are live (Gemini, ElevenLabs, Tiger Data) and which are on their fallback.

App data lives in `.data/` (git-ignored, or `CANOPY_DATA_DIR`). To load the demo grove, run `npm run seed` or click **Reset demo data** in the sidebar. The Timeline merges Tiger Data with the local log, so seeded history shows even when `DATABASE_URL` is set.

To put it online, follow [DEPLOY.md](DEPLOY.md) (Azure App Service, step by step).

**Mood Mirror service.** The demo meetings and transcript uploads work with nothing else running. Recordings, the face layer, and the spoken recap need the Python service:

```bash
cd mood-mirror && pip install -r requirements.txt && uvicorn app:app --port 8000
```

## Code map

| Where | What it does |
| --- | --- |
| `components/canopy/CanopyApp.tsx` | The app shell: sidebar, header, Grove, Tree view, right rail, screen switching |
| `components/canopy/trees.tsx` | Procedurally drawn SVG trees, leaves, and the animated background |
| `components/canopy/panels.tsx` | Right-rail cards: unowned decisions, branch notes, follow-through, the commitment panel |
| `components/canopy/views.tsx` | List, Sources and Timeline tabs, plus the ingest and new-project dialogs |
| `components/canopy/briefing.tsx` | The morning briefing card and the floating Talk to Canopy orb |
| `components/canopy/VoiceAgent.tsx` | The voice agent panel: listening, transcript, spoken replies |
| `components/canopy/people.tsx` | The People page |
| `components/canopy/mood/` | Mood Mirror: screen, in-browser analysis engine, face layer, spoken recap |
| `lib/extract.ts` | Gemini extraction (with a rules fallback) |
| `lib/voice.ts` | Voice agent intents: what you owe, briefing, move a date, mark done, reassign |
| `lib/briefing.ts`, `lib/tts.ts` | Briefing script and ElevenLabs audio, cached per person per day |
| `lib/store.ts`, `lib/tiger.ts`, `lib/history.ts` | JSON store, Tiger Data hypertable, history queries |
| `scripts/demo-data.mjs`, `scripts/seed.mjs` | The demo grove, used by `npm run seed` and **Reset demo data** |
| `lib/leaf.ts`, `lib/view.ts` | Leaf states, slip risk, tree layout, follow-through |
| `mood-mirror/` | Python service: Scribe or Azure Speech, the face model, ElevenLabs voice |

**API routes**

| Route | Purpose |
| --- | --- |
| `GET /api/state` | Everything the UI needs, plus which engines are live |
| `POST /api/projects` | Create a project |
| `POST /api/ingest` | Extract items from pasted text into a project |
| `POST /api/ingest` with `preview: true` | Extract only, for the review step; nothing is saved |
| `PATCH /api/items/[id]` | Edit text, owner or date, mark done or reopen, nudge, set or clear the Mood Mirror flag |
| `DELETE /api/items/[id]`, `/api/sources/[id]`, `/api/projects/[id]` | Delete an item, a source with its items, or a whole project |
| `POST /api/reset` | Restore the demo grove (dates relative to today) |
| `GET /api/history` | A project's events as of a date |
| `POST /api/briefing`, `GET /api/briefing/audio` | A person's briefing script and its audio |
| `POST /api/voice` | Run a spoken request and return the reply (and audio) |
| `/api/mood/*` | Mood Mirror: demo, analyze, face, brief, status |

## Tech stack

| Layer | Tool | Role |
| --- | --- | --- |
| Extraction | Gemini | Reads raw text, outputs decisions, owners, deadlines and source lines as JSON |
| Voice agent | Gemini + browser speech recognition | Understands spoken requests and picks the item and change |
| Voice | ElevenLabs | Speaks each person's briefing and the voice agent's replies |
| Hosting | Azure | App Service for the frontend and API |
| Speaker separation | ElevenLabs Scribe, Azure AI Speech | Transcribes recordings and separates who said what (Mood Mirror) |
| Tone labeling | Azure OpenAI | Labels the tone of each sentence and writes next steps (Mood Mirror) |
| Time-series store | Tiger Data | Logs every commitment event so we can query history and trends |
| App | Next.js 16, React 19, TypeScript | Tree visualization, views, and API routes |
| Mood Mirror service | Python, FastAPI | Recordings, face model, spoken recap |

## Data model

**Project**: id, name, created_at

**Person**: id, name, email

**Source**: id, project_id, kind (meeting, chat, doc), title, meeting_date, text, extracted

**ActionItem**: id, project_id, source_id, owner_id, type (action or decision), text, deadline, status (open or done), workstream, source_excerpt, created_at, done_at, mood_flag. Overdue is derived from the deadline, not stored.

**CommitmentEvent** (Tiger Data hypertable): time, action_item_id, project_id, event_type, old_value, new_value

**MoodReport** (private, readable only by its owner): person, mood_score, team_average, moments (time, tone, words, cause, face_mismatch), next_steps

## Gemini extraction contract

Input: raw text plus the list of known people in the project.

Output, one object per item:

```json
{
  "type": "action | decision",
  "text": "Send revised pricing to the client",
  "owner": "Priya",
  "deadline": "2026-10-09",
  "source_excerpt": "Priya, can you get the new pricing out by Friday?",
  "workstream": "Finance"
}
```

Rules: only return an owner if one is named or clearly implied. Leave `deadline` null instead of guessing. Resolve relative dates ("by Friday") against the meeting date.

## Morning briefing

Script shape, per person:

1. Greeting and the count of items due today
2. Overdue items first, then today, then this week
3. One closing line with the single most important thing

Target length is about 150 words, which reads out in roughly 60 seconds. Generated audio is cached per person per day.

## Sponsor and theme fit

- **Gemini**: the core extraction engine, and it understands voice-agent requests
- **ElevenLabs**: the voice briefing and the voice agent are main features, not add-ons, and Scribe separates speakers for Mood Mirror
- **Azure**: hosts the app, Azure OpenAI labels tone for Mood Mirror, and Azure AI Speech is its transcription fallback
- **Tiger Data**: commitments are time-series by nature, and the history view depends on it
- **ADP**: a workplace tool about people, deadlines, and accountability across a team
- **Theme**: the tree and its wilting leaves are the metaphor, and also the main UI

## Demo flow

0. Before you start: click **Reset demo data** so the grove is clean.
1. Click **+ Paste a transcript**, load the sample vendor sync, and extract.
2. Review what Gemini found, fix an owner, then **Plant** them and watch the tree grow. Click a leaf to show the source quote.
3. Use **Time travel +3d** to watch leaves yellow, wilt and fall.
4. Press play on the **Morning briefing**.
5. Click the green orb (or press **V**) and say "Push the security review to Thursday". The leaf changes and the slip is logged.
6. Open the **Timeline** tab to show how the deadline moved.
7. Open **People** and use **View as** to hear another person's briefing.
8. Open **Mood Mirror**: tone labels with the exact words, the cause of a mood shift, the score against the team average, and the next steps. Click **Share as at risk**, then open one of those leaves to show its raised slip risk.

## Future ideas

- Ingest automatically from Slack, Zoom and calendar invites
- Nudges by text or email while a leaf is still yellow
- A team-level health score across projects
- Canopy suggests sharing a strained "yes" as risk right after a meeting (still the person's choice)

## Status

Built: ingestion with a review step, Gemini extraction, the tree, list/sources/timeline views, manual edit and delete, the morning briefing, the voice agent, the People page, time travel, demo reset, Tiger Data history, and Mood Mirror with its link to slip risk. Recordings, the face layer and the spoken Mood Mirror recap need the Python service running.

## Team

Soumya Dubey, Abhishek Sairam Gaduputi, Ari-Da, and aliya4codee. Built at NJIT GirlHacks 2026, Oct 3 to 4.

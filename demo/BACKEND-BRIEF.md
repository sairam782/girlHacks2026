# Canopy — the backend, for presenting

## The one-sentence version

> "Canopy's backend turns unstructured conversation into structured commitments, and keeps every change to those commitments as a time-series event — so the tree you see is never stored, it is always derived."

---

## The idea to lead with: two stores, on purpose

Most task apps keep one row per task and overwrite it. Canopy keeps **two things**:

| | What it holds | Why |
| --- | --- | --- |
| **Entity store** | Projects, people, sources, commitments — the *current* state | What the screens read |
| **Tiger Data hypertable** | Every state change, forever, with a timestamp | What the history reads |

```
CREATE TABLE commitment_events (
  time TIMESTAMPTZ, action_item_id TEXT, project_id TEXT,
  event_type TEXT, old_value TEXT, new_value TEXT
);
SELECT create_hypertable('commitment_events', 'time');
```

Nine event types: `created · reassigned · deadline_moved · edited · done · reopened · overdue · nudged · mood_flagged`

> "A task manager tells you a deadline is Friday. Canopy tells you it was Monday, then Wednesday, then Friday, and who moved it each time. That is a time-series problem, which is why Tiger Data is in here and not just Postgres."

---

## The second idea: leaf colour is not stored

There is no `colour` column. The state is computed every read:

| State | Rule |
| --- | --- |
| Green | due in more than 3 days |
| Yellow | due within 3 days |
| Wilting | 1–2 days overdue |
| Fallen | 3+ days overdue |
| Bloomed | marked done |

```ts
leafState(item, asof)   // pure function, no writes
```

> "Because it is a pure function of the deadline and a date you pass in, **time travel is free**. The +3d button passes a different `asof`. The whole grove recolours and nothing is written to the database."

That is the best thing to say when someone asks how time travel works.

---

## Architecture, in four layers

```
  Browser
     │
     ▼
  app/api/*          16 route handlers — validate input, call the domain, return JSON
     │               thin by design; no business logic lives here
     ▼
  lib/*              the domain
     ├─ store.ts     persistence + the mutation queue
     ├─ extract.ts   Gemini → structured commitments
     ├─ voice.ts     speech → intent → action
     ├─ briefing.ts  per-person 150-word script
     ├─ leaf.ts      derived state (pure)
     ├─ view.ts      tree layout, health, follow-through
     ├─ history.ts   slip chains, green days
     └─ tiger.ts     the hypertable
     │
     ▼
  Storage            JSON entity store  +  Tiger Data (TimescaleDB)
     │
     ▼
  External           Gemini · ElevenLabs · Azure (via the Python Mood Mirror service)
```

---

## The four flows

### 1. Ingest — paste to tree

```
paste → POST /api/ingest {preview:true}
          → lib/extract.ts → Gemini 3.5 → [{text, owner, deadline, workstream, source_excerpt}]
          → returned to the browser, nothing saved
        ── person reviews, edits, unticks ──
      → POST /api/ingest {items:[...]}
          → re-validated server-side (never trust what came back)
          → store: create Source, create ActionItems, resolve people by name
          → log one `created` event per item → mirrored to Tiger Data
```

**Say this:** "The model never writes to the database. It proposes, a person approves, and the server re-validates what comes back before anything is saved."

Also worth mentioning: the same text pasted twice returns **409** instead of duplicating the tree, and within one ingest a commitment matching an open one by project + wording + owner is skipped.

### 2. Read — state to tree

```
GET /api/state → store
                 → leafState() per item, against today
                 → projectHealth, followThrough
                 → one JSON payload (~31KB)
```

Overdue is derived from the clock, so the first time an item is seen past its deadline the server logs one `overdue` event. It is idempotent — repeated reads do not duplicate it.

### 3. Voice — speech to action

```
POST /api/voice {said, personId, history[]}
   → build a snapshot of the real grove: every open commitment with owner,
     due date, state, slip count, risk %, plus project health and follow-through
   → Gemini picks ONE intent + which item ids it applies to
   → the app executes it and writes the confirmation itself
   → ElevenLabs speaks the reply
```

Eight intents: `list_owed · briefing · move_deadline · mark_done · reassign · nudge · add_commitment · answer`

**Say this:** "Gemini only chooses an intent and which ids it applies to. The app performs the action and writes the sentence you hear. So it is structurally impossible for the assistant to tell you it moved a deadline that it did not move. Ids are checked against real items — an invented one is dropped."

### 4. History — Tiger Data

```
GET /api/history?projectId=…
   → read events from the hypertable
   → merge with local, dedupe, drop events for deleted items
   → compute: slip chains (Sep 29 → Oct 3 → Oct 6), green days, reassignment count
```

---

## How each piece of the stack is used

| Tech | What it does here | Why this one |
| --- | --- | --- |
| **Gemini 3.5** | Two jobs: extracts commitments from raw text (`lib/extract.ts`), and picks the intent for the voice agent (`lib/voice.ts`) | Structured output with a response schema, so we get typed JSON back, not prose to parse |
| **Tiger Data (TimescaleDB)** | `commitment_events` hypertable — every state change, append-only | Commitment history *is* time-series. Hypertable partitioning and time-ordered queries come free |
| **ElevenLabs** | Morning briefing audio, voice-agent replies, and Scribe for speaker-separated transcription in Mood Mirror | A briefing nobody reads is not a briefing. Voice is the delivery mechanism, not a gimmick |
| **Azure OpenAI** | Labels the tone of every meeting turn and writes the per-person suggestions (Mood Mirror) | Every label must carry the exact words that justify it — enforced in the prompt and verified in code |
| **Azure AI Speech** | Speaker diarization fallback when ElevenLabs Scribe is not configured | Two transcription paths so the pipeline runs end to end on Azure |
| **Next.js route handlers** | The API — 16 endpoints | Same TypeScript types shared between server and browser, so leaf state cannot drift between them |
| **Python + FastAPI** | The Mood Mirror service: transcription, the face layer, the spoken recap | Lets us use the Speech SDK and a local vision model that have no good JS equivalent |
| **TensorFlow Lite** | Quantised expression model for the opt-in face layer, run locally | Runs on the person's own machine; the video is deleted the moment it is read |

---

## Four decisions worth defending

**1. Every AI call has a deterministic fallback.**
No Gemini key → a rules-based extractor. No ElevenLabs → the browser voice. No Azure → an offline lexicon. No Python service → a TypeScript port of the same analysis. The app never shows a blank screen because a third party is down or out of quota.

**2. The Mood Mirror engine exists twice, deliberately.**
Once in Python, once ported to TypeScript. The demo and transcript uploads run in-process with no Python and no keys; recordings and the face layer use the service. We diffed the two engines on the same meeting — every label, quote, moment and score matches.

**3. Writes are serialised.**
The entity store is read-modify-write, so every mutation goes through one queue. Tested with 12 concurrent writes: 12 events recorded, zero lost updates.

**4. Deleting really deletes.**
Removing a commitment, a source, or a project also clears the matching rows from the hypertable, so history never refers to items that no longer exist.

---

## Likely questions

**"Why not just Postgres?"**
> Current state is in a simple entity store. The history is append-only, always queried by time, and grows forever — that is what a hypertable is for. Tiger Data gives us time partitioning without us writing it.

**"How do you stop the model inventing commitments?"**
> Three ways. It returns a fixed JSON schema. A person reviews everything before it is saved, and the server re-validates what comes back. And every commitment keeps the exact source line it came from, so any leaf on the tree can be traced to the sentence that produced it.

**"What happens when Gemini is down?"**
> A regex-and-rules extractor takes over. It handles the common phrasings — "I'll do X by Friday", "by the 14th", "Monday the 12th" — attributes owners from the speaker, and infers the workstream by keyword. It is weaker, but the app keeps working. We tested the demo transcript on both and got the same nine commitments.

**"Is it secure / production ready?"**
> Be honest: no auth yet — every endpoint is open, which is right for a hackathon demo and the first thing to add. Input is validated, malformed bodies return 400, and the audio route is guarded against path traversal.

**"How does the slip-risk score work?"**
> A heuristic, not a model: a base from the leaf state, plus urgency, plus 14 points per deadline that already moved, plus a bump if Mood Mirror flagged that the yes was given under strain. Capped at 99.

---

## If you have 60 seconds for the backend

> "Three layers. Sixteen API endpoints that stay thin, a domain layer in TypeScript, and two stores — entities for the present, a Tiger Data hypertable for everything that ever changed.
>
> Gemini turns conversation into structured commitments, but it never writes to the database; it proposes, a person approves, and the server re-validates. ElevenLabs delivers the briefing. Azure OpenAI labels the emotional tone in Mood Mirror, and every label has to show the words behind it.
>
> The leaf colour you see isn't stored anywhere. It's a pure function of the deadline and the date you pass in — which is why time travel recolours the entire grove without a single write."

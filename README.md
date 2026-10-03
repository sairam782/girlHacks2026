# Canopy

**Meetings end. Commitments should not.**

Canopy turns meeting talk into tracked action. Paste in a transcript, a chat thread, or a doc. Canopy pulls out every decision, who owns it, and when it is due. Each person then gets a 60-second spoken briefing each morning on what they owe.

Prototype: https://claude.ai/artifact/LgxsKuyd6HsxiwAmxQcici

## The problem

Most meetings produce decisions that nobody writes down well. Owners are vague, deadlines drift, and people find out they dropped something only when it is late. Notes exist, but nobody reads them.

## The idea

Canopy has two parts: **tracking** what people commit to, and **Mood Mirror**, a private view of how each person felt in the meeting where they committed.

Treat every project as a tree.

- The **trunk** is the project.
- **Branches** are workstreams or meetings.
- **Leaves** are action items.

A healthy leaf is green. As its deadline nears it yellows. Once overdue, it wilts and falls. You can see the health of a whole project at a glance, and the tree stays honest because it is tied to real dates.

## How it works

1. **Ingest.** Paste meeting transcripts, chat threads, or docs into a project.
2. **Extract.** Gemini reads the text and returns structured items: decision, owner, deadline, and the source line it came from.
3. **Grow the tree.** Each action item becomes a leaf on the project's tree. Decisions attach as branch notes.
4. **Track over time.** Every leaf state change (created, reassigned, deadline moved, done, overdue) is stored as a timestamped event in Tiger Data.
5. **Brief.** Each morning, Canopy builds a short script per person: what is due today, what is overdue, what is coming this week. ElevenLabs reads it aloud in about 60 seconds.

## Features

- Transcript, chat, and doc ingestion in one paste box
- Decision, owner, and deadline extraction with a link back to the source text
- Per-project tree view with leaves that change color and wilt when overdue
- Per-person morning voice briefing (about 60 seconds)
- Commitment history: see how deadlines slipped, who reassigned what, and how often a project stays green
- Manual edit: fix an owner or date if the model got it wrong
- **Mood Mirror**: a private emotional-tone report per person for each recorded meeting (see below)

## Mood Mirror

Canopy tracks what people owe. Mood Mirror covers how the meeting felt while they were agreeing to it. It turns a recorded meeting into a **private report for each person**.

**How it works**

1. **Who said what.** Azure AI Speech transcribes the recording and separates speakers.
2. **Tone per sentence.** Azure OpenAI labels every sentence as one of: happy, confident, confused, anxious, frustrated, sad, angry, or neutral. Each label shows the exact words behind it, so nothing is a black box.
3. **Feelings linked to causes.** It connects a mood shift to what triggered it, such as being cut off or having a question skipped.
4. **Score and next steps.** Each person gets a mood score compared with the team average, plus 2 to 3 concrete next steps tied to specific moments in the meeting.

**Optional face layer (opt-in)**

If a person turns it on, their own webcam video is read on their laptop. It flags moments where words and expression disagree, like saying "sure, that works" while looking anxious. This is off by default and never applies to anyone who has not opted in.

**Privacy rules**

- Each person sees only their own report. Nobody sees another person's.
- Face analysis is opt-in and runs only on that person's own video.
- Videos are deleted right after processing.

**Why it ties into Canopy**

A "yes" in a meeting is not always real agreement. If someone sounded anxious or confused when they took an action item, that leaf is more likely to wilt. Mood Mirror gives the person a chance to say so early, instead of finding out on the due date.

**Report shape (per person, per meeting)**

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

## Tech stack

| Layer | Tool | Role |
| --- | --- | --- |
| Extraction | Gemini | Reads raw text, outputs decisions, owners, deadlines as JSON |
| Voice | ElevenLabs | Turns each person's briefing script into audio |
| Hosting | Azure | App service for the frontend and API |
| Speaker separation | Azure AI Speech | Transcribes recordings and separates who said what (Mood Mirror) |
| Tone labeling | Azure OpenAI | Labels the emotional tone of each sentence and writes next steps (Mood Mirror) |
| Time-series store | Tiger Data | Logs every commitment event so we can query history and trends |
| Frontend | Web app | Tree visualization and project views |

## Data model

**Project**: id, name, created_at

**Person**: id, name, email

**ActionItem**: id, project_id, owner_id, text, deadline, status (open, done, overdue), source_excerpt

**CommitmentEvent** (Tiger Data hypertable): time, action_item_id, event_type, old_value, new_value

**MoodReport** (private, readable only by its owner): id, meeting_id, person_id, mood_score, team_average, moments (tone, words, cause, face_mismatch), next_steps

Leaf state is derived from `status` and `deadline`:

| State | Rule |
| --- | --- |
| Green | Due more than 3 days out |
| Yellow | Due within 3 days |
| Wilting | Overdue by 1 to 2 days |
| Fallen | Overdue by 3 or more days |
| Gone (bloom) | Marked done |

## Gemini extraction contract

Input: raw text plus the list of known people in the project.

Output, one object per item:

```json
{
  "type": "action | decision",
  "text": "Send revised pricing to the client",
  "owner": "Priya",
  "deadline": "2026-10-09",
  "source_excerpt": "Priya, can you get the new pricing out by Friday?"
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

- **Gemini**: the core extraction engine
- **ElevenLabs**: the voice briefing is a main feature, not an add-on
- **Azure**: hosts the whole app, and Azure AI Speech plus Azure OpenAI power Mood Mirror
- **Tiger Data**: commitments are time-series by nature, and the history view depends on it
- **ADP**: a workplace tool about people, deadlines, and accountability across a team
- **Theme**: the tree and its wilting leaves are the metaphor, and also the main UI

## Demo flow

1. Paste a messy team meeting transcript.
2. Watch Gemini produce owners and deadlines, and the tree grow leaves.
3. Show an overdue leaf wilting.
4. Press play on one person's morning briefing.
5. Open the history view to show how a deadline moved over time.
6. Open one person's Mood Mirror report: tone labels with the exact words, the cause of a mood shift, the score against the team average, and the next steps.
7. Show the opt-in face layer catching a "sure, that works" said with an anxious look.

## Future ideas

- Calendar and Slack integration to ingest automatically
- Nudges by text or email before a leaf wilts
- Team-level health score across projects
- Voice reply to mark an item done or push a date

## Team

Built at NJIT GirlHacks 2026, Oct 3 to 4.
# Canopy: Frontend Overview

> "From conversations to kept promises."

Canopy tracks the commitments people make in meetings, chat, and docs ("I'll send the quote by Wednesday") and shows them as leaves on a tree. Each project is a tree, each workstream is a branch, and each commitment is a leaf colored by its health:

| Leaf color | Meaning |
|---|---|
| 🟢 Green | On track |
| 🟠 Amber | Slipping (missed a date or hedged) |
| 🔴 Red | Overdue |
| 🟤 Brown (on the ground) | Dropped silently; still tracked |
| 🌰 Seed | A decision made out loud that nobody owns yet |

The app is a single Next.js page (`app/page.tsx` → `components/canopy/CanopyApp.tsx`). **All data is hard-coded demo data** in `components/canopy/data.ts`. The whole app is a clickable prototype for one scenario: Jordan M. working on the "Q4 Vendor Migration" project.

## Code map

| File | What it does |
|---|---|
| `components/canopy/CanopyApp.tsx` | Main app: layout, screen switching, sidebar, header, Grove screen, Tree screen, voice overlay |
| `components/canopy/panels.tsx` | Right-rail cards: Ask Canopy, Unowned decisions, Follow-through, Commitment detail panel, Contradiction box |
| `components/canopy/trees.tsx` | SVG drawing: procedurally drawn trees, project tree, animated background, voice orb |
| `components/canopy/selection.ts` | Builds the detail-panel data (lifecycle, evidence, "why") for a selected leaf |
| `components/canopy/data.ts` | All mock data: leaves, evidence quotes, people, seeds, voice script |
| `components/canopy/geometry.ts` | Bezier/leaf-shape math and seeded random numbers, so trees look the same on every load |

---

## Features

### 1. The Grove (home screen)
- Greeting ("Good morning, Jordan.") and a summary line.
- Three project trees side by side: **Onboarding Revamp**, **Q4 Vendor Migration**, **Payroll API Launch**. Each tree's leaves match its commitment counts, and each shows a health % and green/amber/red/dropped counts.
- Animated background: sunlight, mist, fireflies, and roots that show dependencies between projects.
- Clicking the **Q4 Vendor Migration** tree opens its Tree view.

### 2. Left sidebar (shown when the window is at least 1180px wide)
- Canopy logo (goes back to the Grove).
- Nav: The Grove, My commitments, Meetings, People, Sources, Settings.
- Project list with health dots and percentages.
- **Demo tour** box: buttons that jump to the four demo steps (Grove → Tree view → Commitment → Voice).
- "Meetings, chat, docs synced" status indicator.
- "+ New project" button.

### 3. Header stats
- Active commitments (42), **at risk** count, **orphaned decisions** count, **contradiction** count.
- The at-risk and orphaned stats open the Tree view. The contradiction stat opens the "Send vendor quote" commitment.

### 4. Tree view (Q4 Vendor Migration)
- Breadcrumb back to the Grove, project title, summary line, and team avatars.
- A large tree with three branches (**Legal, Engineering, Finance**) and 16 commitment leaves. Leaves sway, and dropped leaves lie on the ground.
- At-risk leaves show label cards with owner, state, and risk %.
- Hover a leaf to enlarge it and show its label. Click a leaf to open the Commitment panel. Click empty space to deselect.
- Legend (on track, slipping, overdue, dropped, dependency) with live counts.
- Zoom controls: **+**, **−**, **FIT**.
- Faded neighboring project trees, with dependency notes ("waits on Legacy data export").
- "Vendor A or B? 1 contradiction" pill (opens the vendor quote commitment).

### 5. Commitment panel (right rail when a leaf is selected)
- Workstream, title, owner, who it's owed to, due date (with the original date struck through if it slipped), state badge, and **slip risk %** with a bar.
- A "why" explanation of the risk score.
- **Lifecycle** timeline (Committed → In progress → Slipped/Overdue/Dropped).
- **Evidence** cards: source (meeting, chat, or doc), timestamp, exact quote, and a detection tag ("Commitment made", "Hedge detected", "Slip detected", "Went quiet", …).
- **Contradiction** box (vendor quote leaf only): "Vendor A" from standup vs. "Vendor B" from chat.
- Action buttons: **Nudge [owner]**, **Reassign**, **Mark done**.

### 6. Right rail when nothing is selected
- **Ask Canopy**: shortcut to the voice agent, plus a "What you owe this week" list (Budget sign-off, Security review) that opens each commitment.
- **Unowned decisions**: three "seeds". Click **Plant**, pick an owner, and the seed becomes a planted leaf. The orphaned count in the header goes down.
- **Follow-through**: each person's kept-on-time ratio over 30 days, with a colored bar.

### 7. Voice agent ("Talk to Canopy", or press **V**)
- An overlay with an animated orb (states: listening, speaking, updated), a sound-wave animation, and a live typing transcript.
- Plays a **scripted** conversation: "What do I owe Priya?" → answer → "Push the security review to Thursday." → "Done."
- At the end, the Security review leaf **turns amber**, its due date moves Tue Oct 6 → Thu Oct 8, a "Slip noted" evidence card is added, the Engineering at-risk count updates, and a "Priya notified" chip appears.
- **Replay** button. **ESC** (key or button) or clicking outside closes it.

### 8. Keyboard shortcuts
- `V`: open the voice agent
- `Esc`: close the voice agent, or deselect the current leaf

### 9. Responsive behavior
- Sidebar hidden below 1180px wide. Search bar and right rail hidden below 1000px (the rail still appears when a leaf is selected).

---

## Front-end things that DON'T work (yet)

These look interactive but do nothing, or only do a placeholder action.

### Buttons that do nothing when clicked
| Element | Location | Notes |
|---|---|---|
| **+ New project** | Bottom of left sidebar | No `onClick` |
| **Meetings** nav item | Left sidebar | No handler |
| **People** nav item | Left sidebar | No handler |
| **Sources** nav item | Left sidebar | No handler |
| **Settings** nav item | Left sidebar | No handler |
| **Onboarding Revamp** / **Payroll API Launch** | Sidebar project list | Only Q4 Vendor Migration opens |
| **Onboarding Revamp** / **Payroll API Launch** trees | Grove screen | Show a pointer cursor and hover effect but don't open anything |
| **Reassign** | Commitment panel | No `onClick` |
| **Mark done** | Commitment panel | No `onClick` |
| **Ask Dana to resolve** | Contradiction box | No `onClick` |
| **Keep A** / **Switch to B** | Contradiction box | No `onClick` |

### Things that look clickable but aren't
| Element | Location | Notes |
|---|---|---|
| **Search bar** ("Search commitments, people, quotes") | Header | A styled `div`, not an input. You can't type in it |
| **⌘K** shortcut | Header search | Not wired up |
| **List**, **Sources**, **Timeline** tabs | Tree view | Plain text `span`s. Only "Tree view" exists |
| Team avatars and **+2** | Tree view header | Static |
| Faded neighbor trees (Onboarding/Payroll) | Tree view background | Not clickable |

### Placeholder behavior
| Element | What it does now | What's missing |
|---|---|---|
| **My commitments** nav | Opens the "Budget sign-off" leaf | No real "my commitments" list page |
| **Nudge [owner]** | Changes its label to "Nudged X with evidence" | Sends nothing |
| **Plant** (seeds) | Updates the card text and orphan count | No new leaf appears on the tree. Owner isn't saved |
| **Talk to Canopy** / voice | Plays a fixed script | No microphone, no speech recognition, no real AI |
| "at risk" / "orphaned" header stats | Open the tree view | No filtered list of the relevant items |

### Other gaps
- **Nothing persists.** Refreshing the page resets planted seeds, nudges, zoom, and voice edits.
- **Hard-coded values that won't update:** "42 active commitments", "Monday, October 5", "Good morning, Jordan.", "Three projects, forty-two promises", "Updated from Fri doc comment, 2h ago", "16 active · 3 dropped", "Affects 4 leaves", and the sync times on the Grove.
- The header "at risk" number is computed as `amber + red + 2`; the `+2` is a hard-coded fudge for the other projects.
- Only one project (Q4 Vendor Migration) has a detailed tree. The other two exist only as Grove thumbnails.
- No navigation on narrow screens: below 1180px the sidebar disappears and nothing replaces it (no hamburger menu).
- No login or user switching. The user is always "Jordan M."
- No empty, loading, or error states.

---

## Features that need a backend

| Feature | What the backend must do |
|---|---|
| **Ingest sources** (meetings, chat, docs) | Connect to tools like Zoom/Meet transcripts, Slack, Google Docs/Notion. Store messages, transcripts, and comments. Powers the "Meetings, chat, docs synced" indicator |
| **Commitment extraction** | Use an LLM/NLP to detect commitment statements ("I'll send X by Wed"), the owner, the due date, and who it's for |
| **Evidence & detection tags** | Link each commitment to source quotes. Detect hedges, slips, follow-ups with no reply, and "went quiet" (no mention for N days) |
| **Slip-risk scoring** | Compute the risk % and the "why" explanation from missed dates, hedging language, dependencies, and the owner's history |
| **Lifecycle tracking** | Record state changes over time (committed → in progress → slipped/overdue/done/dropped) |
| **Dropped-commitment detection** | Notice items removed from plans or abandoned without a decision |
| **Unowned decisions (seeds)** | Detect decisions with no owner. Save the owner when one is "planted" and create a real commitment |
| **Contradiction detection** | Find conflicting decisions across sources (Vendor A vs. B). Resolve them via "Keep A", "Switch to B", or "Ask Dana to resolve" |
| **Dependencies** | Store links between commitments and projects (the teal dependency dots and roots) |
| **Projects / the Grove** | CRUD for projects (**+ New project**), workstreams, and members. Compute health % |
| **Commitment actions** | **Mark done**, **Reassign**, edit due dates, all saved to a database |
| **Nudge** | Send a real message (Slack/email) to the owner with the evidence attached |
| **Notifications** | e.g. "Priya notified" when a due date moves |
| **Follow-through stats** | Each person's kept-on-time ratio over the last 30 days |
| **"What you owe" list** | Query open commitments owned by the current user, grouped by who they're owed to |
| **Voice agent** | Speech-to-text, an LLM that answers questions and takes actions (move dates, etc.), text-to-speech |
| **Search / ⌘K** | Full-text search across commitments, people, and quotes |
| **People / Meetings / Sources / Settings pages** | Need APIs for people directories, meeting lists, connected integrations, and user settings |
| **Auth & users** | Login, current-user identity (replace hard-coded "Jordan"), team membership, permissions |
| **Persistence** | Database so nothing resets on page refresh |
| **Real-time updates** | Push new commitments and state changes to the UI as sources sync (WebSocket/SSE or polling) |

### Suggested API shape (starting point)
The demo data in `data.ts` already defines the shapes the frontend expects (`Leaf`, `Evidence`, `GroveProject`, `SEEDS`, `PEOPLE`, `FALLEN`). A backend could start by returning those:

```
GET  /api/projects                     → GroveProject[]
GET  /api/projects/:id/commitments     → Leaf[] + FallenLeaf[]
GET  /api/commitments/:id/evidence     → Evidence[]
GET  /api/projects/:id/seeds           → Seed[]
POST /api/seeds/:id/plant              { owner }
POST /api/commitments/:id/nudge
POST /api/commitments/:id/done
POST /api/commitments/:id/reassign     { owner }
PATCH /api/commitments/:id             { due }
GET  /api/people/follow-through        → PEOPLE stats
GET  /api/me/owed                      → "What you owe this week"
POST /api/contradictions/:id/resolve   { choice }
POST /api/voice                        (audio/text in → reply + actions out)
GET  /api/search?q=
```

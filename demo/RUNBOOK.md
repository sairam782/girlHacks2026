# Canopy — demo runbook

Everything here was tested against the real app on 4 Oct 2026.

---

## 1. Five minutes before you present

| Do this | Why |
| --- | --- |
| Open **https://canopy-girlhacks.vercel.app** and leave the tab open | Wakes the server. Data lives in temporary storage, so a cold instance starts empty |
| Check you see **three trees**. If the screen says "Welcome to Canopy" → sidebar → **Reset demo data** → confirm | This is the only failure that looks bad on stage, and it takes five seconds to fix |
| Make the window **at least 1180px wide** | Below that the sidebar hides, and the Gemini / ElevenLabs / Tiger Data badges go with it |
| Check the three badges are **green**, not "fallback" | That is your proof the sponsor integrations are live |
| If you will show the face layer: `cd mood-mirror && uvicorn app:app --port 8000` and demo **locally**, not on the live URL | The Python service is not deployed |

**Budget:** Gemini free tier is **20 requests per day**. One paste = one request. Rehearse on a different model or accept the rules fallback, and keep the quota for the real run.

---

## 2. The five-minute demo

### Beat 1 — The Grove (30s)
Open the live link. Three trees, three health levels.

> "Every project is a tree. Every leaf is something a person promised out loud in a meeting. Green is on track, yellow is due soon, red is overdue, and the brown ones on the ground were dropped silently — still tracked."

Point at **Q4 Vendor Migration, 72%** next to **Onboarding Revamp, 90%**.

### Beat 2 — Morning briefing (30s)
Press **play** on the briefing card, top right.

> "Each person gets a sixty-second briefing every morning. This is ElevenLabs reading Jordan's real commitments — overdue first."

### Beat 3 — Open the tree, click a leaf (60s)
Click **Q4 Vendor Migration → Open tree**. Click a **red** leaf.

> "Here is the whole history. Who owns it, the original date struck through next to the new one, a slip-risk score, and the exact line from the meeting it came from."

Point at the **Lifecycle** strip: Committed → Overdue. Then press **Nudge**.

> "Nudging is recorded too. The next person to open this sees it was already chased, and when."

### Beat 4 — Time travel (20s)
Sidebar → **+3d**, twice.

> "This is the part people feel. Watch the yellow leaves wilt as the deadlines pass."

Click **0** to return to today. **Do not forget this** — the rest of the demo reads wrong from a future date.

### Beat 5 — Paste a live transcript (90s)
**+ New project** → name it `Portal Redesign` → **+ Paste a transcript** → paste the transcript in section 3 → **Extract commitments**.

> "This is Gemini reading an unstructured conversation."

When the review panel appears:

> "It never writes straight to the tree. You see what it found, fix anything wrong, untick what is not a real commitment. Note it resolved 'by the 14th' and 'next Monday' against the meeting date."

Click **Plant on the tree**. A new tree grows with three branches.

### Beat 6 — Mood Mirror (60s)
Sidebar → **Mood Mirror**.

> "Canopy tracks what you owe. Mood Mirror covers whether the yes was real."

Point at the mood score vs team average, then scroll to **Your moments** — the quotes with the evidence words highlighted.

> "Every label shows the exact words behind it. Nothing is a black box. And it reads words only — no face or voice analysis, which the EU AI Act bans in workplaces."

Scroll to **What Priya took on here** — the leaves she owns, with slip risk.

> "That is the whole thesis. A promise made under strain is the leaf most likely to wilt."

### Beat 7 — Close (20s)
> "Gemini understands the conversation. Tiger Data remembers every state change. ElevenLabs speaks. One tree shows a project. A forest shows an organisation."

---

## 3. The transcript to paste

Tested on **both** engines — Gemini and the no-key fallback — and both give the same clean result: 9 owned commitments, 3 each on Legal, Engineering and Finance, zero duplicates, every date resolved correctly.

```
Rosa: Thanks everyone. Decision: we are going with Vendor A across all regions.
Diego: I'll get the Vendor A contract redlined by the 14th.
Diego: I'll also countersign the data processing addendum by Tuesday.
Priya: I'll finish the legal compliance review by next Monday.
Sam: I'll load test the new API endpoints by the 20th.
Sam: I'll provision engineering sandbox access by Thursday.
Aiko: I'll run the SSO integration spike by October 16.
Lena: I'll raise the purchase order by the 16th.
Lena: I'll update the Q4 budget forecast by Friday.
Mei: I'll draft the invoice schedule by Wednesday.
Rosa: Someone needs to tell the current vendor we are not renewing.
```

Also at `demo/presentation-transcript.txt`.

What it produces:

| Branch | Commitments |
| --- | --- |
| **Legal** | Contract redline (14th) · Countersign addendum (Tue) · Compliance review (next Mon) |
| **Engineering** | Load test endpoints (20th) · Sandbox access (Thu) · SSO spike (Oct 16) |
| **Finance** | Purchase order (16th) · Q4 forecast (Fri) · Invoice schedule (Wed) |

Plus the Vendor A **decision** with no owner, and "tell the current vendor" as an unowned **seed**.

**Paste into a new project, not an existing one.** The tree draws exactly three branches; adding new workstreams to a project that already has three makes the smaller ones collapse into "Other" and the labels reshuffle mid-demo.

---

## 4. If something goes wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Welcome to Canopy", no trees | Server went cold, temporary storage wiped | Sidebar → **Reset demo data** → confirm. Five seconds |
| Extraction returns odd items | Gemini quota ran out, rules engine took over | Carry on — the fallback handles this transcript correctly. Untick anything odd in the review step, which is a feature, not an apology |
| "This text was already added" | You pasted the same transcript twice | Expected. Sources tab → **Delete** that source, or just move on |
| Sidebar and badges missing | Window under 1180px | Widen the window |
| Mood Mirror upload or face layer fails | Python service is not deployed | Demo that part locally on `localhost:3000` |
| Tree looks cramped or cut off | Zoom drifted | Click **FIT** on the tree |

---

## 5. Things to avoid

- **Do not leave time travel on.** Click **0** before the next beat.
- **Do not paste into Q4 Vendor Migration.** Use a new project.
- **Do not promise the face layer on the live URL.** It only runs locally.
- **Do not claim Azure OpenAI is labelling tone** unless the Mood Mirror pill reads "Tone · Azure OpenAI". Without the keys it says "offline lexicon", and the card's "Powered by Azure OpenAI" line is ahead of reality.

---

## 6. Numbers you can quote

- 3 projects, 51 commitments, 7 people, 6 sources
- Q4 Vendor Migration: 8 green, 5 yellow, 2 wilting, 3 fallen, 3 done, 3 unowned
- 57% of the last 7 days stayed green; 4 deadlines moved, one of them twice
- Tiger Data holds every state change as a timestamped row in a TimescaleDB hypertable

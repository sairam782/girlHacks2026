"""Per-person mood report: what each person felt, what happened right before, and what to do next."""
import json
import re
from collections import Counter, defaultdict

from emotions import EMOTIONS, VALENCE, chat_json, llm_client

DEFLECT = re.compile(r"^\s*(moving on|let's take that offline|let's park|park that|let's keep moving|"
                     r"not now|we'll come back|later)", re.I)


def mmss(sec: float) -> str:
    sec = int(round(sec))
    return f"{sec // 60}:{sec % 60:02d}"


OPEN_ENDINGS = {"and", "but", "because", "so", "or", "the", "a", "an", "to", "that", "which", "if", "of",
                "with", "for", "is", "was", "we", "i", "my", "our", "like", "um", "uh", "then", "when", "where"}


def short(text: str, n: int) -> str:
    return text if len(text) <= n else text[:n].rsplit(" ", 1)[0] + "…"


def tail(text: str, n: int) -> str:
    return text if len(text) <= n else text[-n:].split(" ", 1)[-1]


def flag_events(turns: list[dict]) -> list[dict]:
    """Facts anyone can check on the transcript: cut-offs and questions that got moved past."""
    for i, t in enumerate(turns):
        t["cut_off"] = False
        t["deflected_question"] = False
        nxt = turns[i + 1] if i + 1 < len(turns) else None
        if nxt and nxt["speaker"] != t["speaker"]:
            # Some transcribers (e.g. ElevenLabs Scribe) drop the final period of a turn, so a missing
            # period alone is not proof. Count a cut-off when the next person talks over them, or jumps
            # in instantly while the sentence is clearly mid-thought ("...because users drop off and").
            no_period = not re.search(r"[.!?…]\s*$", t["text"])
            talked_over = nxt["start"] < t["end"] - 0.05
            jumped_in = nxt["start"] < t["end"] + 0.25
            words = re.findall(r"[a-z']+", t["text"].lower())
            mid_thought = bool(words) and words[-1] in OPEN_ENDINGS
            trails_off = bool(re.search(r"(--|—|–|-|\.\.\.|…)\s*$", t["text"]))   # "so we could—"
            if (no_period and (talked_over or (jumped_in and mid_thought))) or (trails_off and jumped_in):
                t["cut_off"] = True
                t["cut_off_by"] = nxt["speaker"]
            if "?" in t["text"] and DEFLECT.search(nxt["text"]):
                t["deflected_question"] = True
    return turns


def summarize(turns: list[dict]) -> dict:
    by_person: dict[str, list[dict]] = defaultdict(list)
    for t in turns:
        by_person[t["speaker"]].append(t)
    total_time = sum(max(0.0, t["end"] - t["start"]) for t in turns) or 1.0

    people = {}
    for name, ts in by_person.items():
        counts = Counter(t["emotion"] for t in ts)
        mix = {e: round(counts.get(e, 0) / len(ts), 3) for e in EMOTIONS}
        score = 50 + 50 * sum(VALENCE[t["emotion"]] * max(t["intensity"], 0.5 if t["emotion"] != "neutral" else 0)
                              for t in ts) / len(ts)
        non_neutral = Counter({e: c for e, c in counts.items() if e != "neutral"})
        airtime = sum(max(0.0, t["end"] - t["start"]) for t in ts)
        people[name] = {
            "turns": len(ts),
            "words": sum(len(t["text"].split()) for t in ts),
            "airtime_sec": round(airtime, 1),
            "airtime_share": round(airtime / total_time, 3),
            "mood_score": round(max(0, min(100, score))),
            "dominant": non_neutral.most_common(1)[0][0] if non_neutral else "neutral",
            "mix": mix,
            "questions": sum("?" in t["text"] for t in ts),
            "cut_offs": sum(t["cut_off"] for t in ts),
            "deflected_questions": sum(t["deflected_question"] for t in ts),
            "interrupted_others": [mmss(x["start"]) for x in turns
                                   if x.get("cut_off") and x.get("cut_off_by") == name],
            "parked_questions": [mmss(turns[i - 1]["start"]) for i, x in enumerate(turns)
                                 if i > 0 and x["speaker"] == name and turns[i - 1]["deflected_question"]],
            "timeline": [{"id": t["id"], "t": t["start"], "emotion": t["emotion"],
                          "valence": round(VALENCE[t["emotion"]] * (t["intensity"] or 0.0), 2)}
                         for t in ts],
            "moments": [moment(t, turns) for t in ts
                        if t["emotion"] != "neutral" or t["cut_off"] or t["deflected_question"]],
        }

    n = len(people) or 1
    for p in people.values():
        p["equal_share"] = round(1 / n, 3)
    team = {
        "people": n,
        "duration_sec": round(max((t["end"] for t in turns), default=0), 1),
        "mood_score": round(sum(p["mood_score"] for p in people.values()) / n),
        "mix": {e: round(sum(p["mix"][e] for p in people.values()) / n, 3) for e in EMOTIONS},
        "equal_airtime_share": round(1 / n, 3),
    }
    return {"people": people, "team": team}


def moment(t: dict, turns: list[dict]) -> dict:
    """A feeling plus what happened just before it, so the person sees the cause, not just the mood."""
    idx = next(i for i, x in enumerate(turns) if x["id"] == t["id"])
    before = None
    for j in range(idx - 1, -1, -1):
        p = turns[j]
        if t["start"] - p["start"] > 120:
            break
        if t["emotion"] in ("frustrated", "angry", "sad", "anxious", "confused") \
                and p["speaker"] == t["speaker"] and (p["cut_off"] or p["deflected_question"]):
            before = ("You were cut off at " if p["cut_off"] else "Your question was moved past at ") + mmss(p["start"])
            break
    return {"id": t["id"], "t": t["start"], "time": mmss(t["start"]), "text": t["text"],
            "emotion": t["emotion"], "intensity": t["intensity"], "evidence": t.get("evidence", ""),
            "cut_off": t["cut_off"], "deflected_question": t["deflected_question"], "context": before,
            "events": t.get("events", [])}


# --------------------------------------------------------------- suggestions

def suggest_offline(p: dict) -> list[dict]:
    tips = []
    ms = p["moments"]

    def first(pred):
        return next((m for m in ms if pred(m)), None)

    def q(m):
        return f'"{m["evidence"]}"' if m.get("evidence") else f'"{short(m["text"], 60)}"'

    def question(text):
        qs = [x.strip() for x in re.findall(r"[^.!?]*\?", text)]
        return qs[-1] if qs else short(text, 80)

    m = first(lambda m: m["deflected_question"])
    if m:
        tips.append({"title": "Get your question answered", "at": m["t"],
                     "detail": f'At {m["time"]} you asked "{question(m["text"])}" and the meeting moved on. '
                               "Put it in the follow-up message and ask for a named owner and a date."})
    m = first(lambda m: m["cut_off"])
    if m:
        tips.append({"title": "Finish the point that got cut off", "at": m["t"],
                     "detail": f'You were cut off at {m["time"]} ("…{tail(m["text"], 50)}"). Open the next meeting '
                               "with it, or post it in writing today so it is on record as yours."})
    m = first(lambda m: m["emotion"] in ("angry", "frustrated"))
    if m:
        tips.append({"title": "Turn it into a clear request", "at": m["t"],
                     "detail": f'At {m["time"]} you said {q(m)}. Follow up with one specific ask: who owns it '
                               "and by when. Requests get action faster than complaints."})
    m = first(lambda m: m["emotion"] == "anxious")
    if m:
        tips.append({"title": "Pin down what's worrying you", "at": m["t"],
                     "detail": f'At {m["time"]} you flagged a worry ({q(m)}). Ask for one concrete safeguard: '
                               "a freeze date, a buffer day, or a scope cut."})
    m = first(lambda m: m["emotion"] == "confused")
    if m:
        tips.append({"title": "Ask for decisions in writing", "at": m["t"],
                     "detail": f'You were unsure at {m["time"]} ({q(m)}). Ask the organizer to post decisions, '
                               "owners and dates after the meeting so nothing depends on memory."})
    m = first(lambda m: m["emotion"] == "sad")
    if m:
        tips.append({"title": "Name what you want back", "at": m["t"],
                     "detail": f'At {m["time"]} you sounded let down ({q(m)}). Propose when it could return, '
                               "for example a slot in next sprint's plan."})
    if p["parked_questions"]:
        tips.append({"title": "Close the loops you parked", "at": None,
                     "detail": f'You moved past {len(p["parked_questions"])} question(s) from others '
                               f'(at {", ".join(p["parked_questions"])}). Answer them in the follow-up '
                               "so people know they were heard."})
    if p["interrupted_others"]:
        tips.append({"title": "Let the last point land", "at": None,
                     "detail": f'Someone was cut off while you started talking at {", ".join(p["interrupted_others"])}. '
                               'Next time, ask "Were you finished?" before moving on.'})
    if p["airtime_share"] > 1.6 * p["equal_share"]:
        tips.append({"title": "Leave room for others", "at": None,
                     "detail": f'You spoke {round(p["airtime_share"] * 100)}% of the time (an even split is '
                               f'{round(p["equal_share"] * 100)}%). Try asking the quietest person first next time.'})
    elif p["airtime_share"] < 0.6 * p["equal_share"]:
        tips.append({"title": "Get your point in early", "at": None,
                     "detail": f'You spoke {round(p["airtime_share"] * 100)}% of the time. Raise your top point '
                               "in the first five minutes, before the agenda fills up."})
    if not tips:
        m = first(lambda m: m["emotion"] in ("happy", "confident"))
        tips.append({"title": "Keep doing what worked", "at": m["t"] if m else None,
                     "detail": (f'Your strongest moment was at {m["time"]} ({q(m)}). ' if m else "")
                               + "Steady, constructive tone. Share credit for the wins in the follow-up."})
    return tips[:3]


SUGGEST_SYSTEM = """You coach one person privately after a work meeting.
You get their own stats and moments (feeling + exact quote + what happened right before).
Write 2-3 suggestions. Each must be a concrete action they can take, tied to a moment and its timestamp.
Never tell them to "be happier", never diagnose, never comment on personality or other people's character.
Plain, warm, short (max 35 words each).
Return JSON: {"suggestions": [{"title": <max 6 words>, "detail": <text>, "at": <seconds or null>}]}"""


def suggest_llm(name: str, p: dict, team: dict, client, model) -> list[dict]:
    payload = {k: p[k] for k in ("mood_score", "dominant", "airtime_share", "questions", "cut_offs",
                                 "deflected_questions", "interrupted_others", "parked_questions", "mix")}
    payload["team_mood_score"] = team["mood_score"]
    payload["equal_airtime_share"] = team["equal_airtime_share"]
    payload["moments"] = [{k: m[k] for k in ("time", "t", "emotion", "evidence", "text", "context",
                                             "cut_off", "deflected_question")} for m in p["moments"]]
    data = chat_json(client, model, SUGGEST_SYSTEM, f"Person: {name}\n{json.dumps(payload)}")
    tips = [s for s in data.get("suggestions", []) if s.get("title") and s.get("detail")]
    if not tips:
        raise ValueError("empty suggestions")
    return tips[:3]


def add_suggestions(report: dict, engine: str = "auto") -> str:
    client, model, name = (None, None, "offline") if engine == "offline" else llm_client()
    used = "offline"
    for person, p in report["people"].items():
        if client is not None:
            try:
                p["suggestions"] = suggest_llm(person, p, report["team"], client, model)
                used = name
                continue
            except Exception as e:
                print(f"[insights] LLM suggestions failed for {person}, using rules: {e}")
        p["suggestions"] = suggest_offline(p)
    return used

"""Label the emotional tone of each meeting turn from its WORDS (not voice or face).

Two engines:
  * LLM (Azure OpenAI, or plain OpenAI) -> best quality, any label set
  * offline lexicon -> no keys needed, good enough for a demo and used as a fallback
"""
import json
import os
import re

# Order matters: it matches the chart palette order (see static/index.html).
EMOTIONS = ["neutral", "frustrated", "happy", "confused", "anxious", "confident", "sad", "angry"]

# How each label pulls the mood score (-1 .. +1).
VALENCE = {"happy": 0.8, "confident": 0.6, "neutral": 0.0, "confused": -0.3,
           "anxious": -0.5, "frustrated": -0.6, "sad": -0.7, "angry": -0.9}


# ---------------------------------------------------------------- LLM engine

def llm_client():
    """Return (client, model_name, engine_label) or (None, None, 'offline')."""
    try:
        from openai import AzureOpenAI, OpenAI
    except ImportError:
        return None, None, "offline"
    if os.getenv("AZURE_OPENAI_ENDPOINT") and os.getenv("AZURE_OPENAI_KEY") and os.getenv("AZURE_OPENAI_DEPLOYMENT"):
        client = AzureOpenAI(
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_key=os.environ["AZURE_OPENAI_KEY"],
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21"),
        )
        return client, os.environ["AZURE_OPENAI_DEPLOYMENT"], "azure-openai"
    if os.getenv("OPENAI_API_KEY"):
        return OpenAI(), os.getenv("OPENAI_MODEL", "gpt-4o-mini"), "openai"
    return None, None, "offline"


_NO_TEMPERATURE: set[str] = set()


def chat_json(client, model, system: str, user: str) -> dict:
    """One JSON-mode chat call. Retries without temperature for models that reject it."""
    kwargs = dict(model=model, response_format={"type": "json_object"},
                  messages=[{"role": "system", "content": system},
                            {"role": "user", "content": user}])
    if model in _NO_TEMPERATURE:
        resp = client.chat.completions.create(**kwargs)
    else:
        try:
            resp = client.chat.completions.create(temperature=0.2, **kwargs)
        except Exception as e:  # some reasoning models only accept the default temperature
            if "temperature" not in str(e).lower():
                raise
            _NO_TEMPERATURE.add(model)
            resp = client.chat.completions.create(**kwargs)
    return json.loads(resp.choices[0].message.content)


LABEL_SYSTEM = f"""You label the emotional tone of turns in a work meeting transcript.
Judge only from the words each person says (no guessing from names, roles or gender).
Bracketed sounds like [laughter] or [sigh] were heard during the turn; use them as context.
Use the surrounding turns as context: "Fair." after being challenged reads differently than after praise.
Allowed labels: {", ".join(EMOTIONS)}. Use "neutral" when nothing stands out; do not over-label.
"confident" = assured, taking ownership. "frustrated" = blocked or repeating themselves.
Return JSON: {{"labels": [{{"id": <turn id>, "emotion": <label>, "intensity": <0.0-1.0>,
"evidence": <the 1-8 words copied exactly from that turn that show the tone, or "">}}]}}
Return one entry for every turn id you are given."""


def label_llm(turns: list[dict], client, model, chunk: int = 30) -> list[dict]:
    out: dict[int, dict] = {}
    for i in range(0, len(turns), chunk):
        ctx = turns[max(0, i - 3):i]          # a little context from the previous chunk
        part = turns[i:i + chunk]
        lines = [f"(context) {t['speaker']}: {t['text']}" for t in ctx]
        lines += [f"[{t['id']}] {t['speaker']} @{t['start']:.0f}s: {t['text']}"
                  + (f" [{', '.join(t['events'])}]" if t.get("events") else "") for t in part]
        data = chat_json(client, model, LABEL_SYSTEM, "\n".join(lines))
        for item in data.get("labels", []):
            try:
                out[int(item["id"])] = item
            except (KeyError, TypeError, ValueError):
                continue
    labeled = []
    for t in turns:
        item = out.get(t["id"])
        if not item or item.get("emotion") not in EMOTIONS:
            labeled.append(label_one_offline(t))      # fill gaps with the offline engine
            continue
        ev = str(item.get("evidence") or "")
        if ev and ev.lower() not in t["text"].lower():
            ev = ""                                  # never show evidence that isn't in the turn
        labeled.append({**t, "emotion": item["emotion"],
                        "intensity": round(min(1.0, max(0.0, float(item.get("intensity", 0.5)))), 2),
                        "evidence": ev})
    return labeled


# ------------------------------------------------------------ offline engine

LEXICON = {
    "angry": [r"unacceptable", r"ridiculous", r"furious", r"who dropped", r"\bangry\b", r"fed up", r"this is a joke"],
    "frustrated": [r"frustrat\w*", r"keeps? getting", r"twice now", r"again and again", r"annoy\w*",
                   r"like i said", r"still waiting", r"for the third time"],
    "anxious": [r"worried", r"nervous", r"anxious", r"not sure we can", r"what if", r"scared",
                r"concerned", r"even tighter", r"stress\w*"],
    "confused": [r"confus\w*", r"\blost\b", r"don't follow", r"don't understand", r"which deadline",
                 r"unclear", r"not sure what", r"wait, sorry", r"what do you mean"],
    "sad": [r"disappoint\w*", r"\bsad\b", r"bummed", r"let down", r"unfortunately", r"miss (it|that)"],
    "happy": [r"\bgreat\b", r"thrilled", r"\blove\b", r"awesome", r"fantastic", r"\bhappy\b", r"\bglad\b",
              r"thank you", r"helps", r"feel better", r"perfect", r"excited", r"going well"],
    "confident": [r"confident", r"i can own", r"i'll have", r"\bready\b", r"i already", r"\bsure\b",
                  r"definitely", r"i've got (it|this)"],
}
# When two labels tie, the earlier one wins (negative states are rarer, so surface them).
PRIORITY = ["angry", "frustrated", "anxious", "confused", "sad", "happy", "confident"]


def label_one_offline(t: dict) -> dict:
    text = t["text"].lower()
    best, best_hits, evidence = "neutral", 0, ""
    for emo in PRIORITY:
        hits = [m.group(0) for p in LEXICON[emo] for m in re.finditer(p, text)]
        if len(hits) > best_hits:
            best, best_hits = emo, len(hits)
            # copy the evidence with the speaker's original casing
            idx = text.find(hits[0])
            evidence = t["text"][idx: idx + len(hits[0])]
    if best == "neutral" and any("laugh" in e for e in t.get("events", [])):
        best, best_hits, evidence = "happy", 1, ""
    intensity = 0.0 if best == "neutral" else min(1.0, 0.45 + 0.2 * best_hits + 0.1 * t["text"].count("!"))
    return {**t, "emotion": best, "intensity": round(intensity, 2), "evidence": evidence}


def label_turns(turns: list[dict], engine: str = "auto") -> tuple[list[dict], str]:
    """Returns (labeled turns, engine actually used)."""
    if engine != "offline":
        client, model, name = llm_client()
        if client is not None:
            try:
                return label_llm(turns, client, model), name
            except Exception as e:
                print(f"[emotions] LLM labeling failed, using offline engine: {e}")
    return [label_one_offline(t) for t in turns], "offline"

"""ElevenLabs: speech-to-text (Scribe, with speaker separation and audio events) and the spoken voice brief."""
import os
import re
import tempfile

import httpx

API = "https://api.elevenlabs.io/v1"
DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb"  # "George", a premade voice; override with ELEVENLABS_VOICE_ID

# Swappable in tests
def _client(timeout: float = 300.0) -> httpx.Client:
    return httpx.Client(timeout=timeout)


def configured() -> bool:
    return bool(os.getenv("ELEVENLABS_API_KEY"))


def _headers() -> dict:
    return {"xi-api-key": os.environ["ELEVENLABS_API_KEY"]}


def _error(r: httpx.Response) -> str:
    try:
        d = r.json().get("detail", r.text)
        return d.get("message", str(d)) if isinstance(d, dict) else str(d)
    except Exception:
        return r.text[:300]


# ------------------------------------------------------------- speech to text

def _compress(src: str) -> str | None:
    """Video or big WAV -> small mono MP3, so the upload is fast on hackathon Wi-Fi.

    Returns None if conversion isn't possible (no ffmpeg, odd codec); the original file is sent instead.
    """
    from transcribe import NO_AUDIO, has_audio, run_ffmpeg
    if has_audio(src) is False:
        raise RuntimeError(NO_AUDIO)
    out = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False).name
    try:
        run_ffmpeg(["-i", src, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", out])
        return out
    except RuntimeError as e:
        print(f"[voice] compression skipped, uploading original: {e}")
        if os.path.exists(out):
            os.unlink(out)
        return None


def transcribe(path: str, language: str = "en-US", num_speakers: int | None = None) -> list[dict]:
    """Return turns: {"speaker", "start", "end", "text", "events": ["laughter", ...]}."""
    mp3 = _compress(path)
    upload, upload_name = (mp3, "meeting.mp3") if mp3 else (path, os.path.basename(path))
    data = {"model_id": os.getenv("ELEVENLABS_STT_MODEL", "scribe_v2"), "diarize": "true",
            "tag_audio_events": "true", "timestamps_granularity": "word",
            "language_code": language.split("-")[0]}
    if num_speakers:
        data["num_speakers"] = str(num_speakers)
    try:
        with open(upload, "rb") as f, _client() as c:
            r = c.post(f"{API}/speech-to-text", headers=_headers(), data=data,
                       files={"file": (upload_name, f, "audio/mpeg" if mp3 else "application/octet-stream")})
    finally:
        if mp3:
            os.unlink(mp3)
    if r.status_code != 200:
        raise RuntimeError(f"ElevenLabs speech-to-text error {r.status_code}: {_error(r)}")
    turns = words_to_turns(r.json().get("words", []))
    if not turns:
        raise RuntimeError("ElevenLabs returned no speech. Check the language setting and that voices are audible.")
    return turns


def _speaker_name(sid: str | None) -> str:
    m = re.search(r"(\d+)$", sid or "")
    return f"Speaker {int(m.group(1)) + 1}" if m else (sid or "Unknown")


def words_to_turns(words: list[dict], max_gap: float = 1.2) -> list[dict]:
    """Group word timestamps into speaker turns; keep (laughter)-style events on the turn."""
    turns: list[dict] = []
    for w in words:
        kind = w.get("type", "word")
        if kind == "spacing":
            continue
        spk = _speaker_name(w.get("speaker_id"))
        start, end = float(w.get("start", 0)), float(w.get("end", 0))
        if kind == "audio_event":
            label = w.get("text", "").strip("()[] ").lower()
            target = turns[-1] if turns and turns[-1]["speaker"] == spk else None
            if target is None:  # an event on its own still belongs to someone
                turns.append({"speaker": spk, "start": start, "end": end, "text": "", "events": [label]})
            else:
                target["events"].append(label)
                target["end"] = max(target["end"], end)
            continue
        last = turns[-1] if turns else None
        if last and last["speaker"] == spk and start - last["end"] <= max_gap:
            last["text"] = (last["text"] + " " + w["text"]).strip()
            last["end"] = end
        else:
            turns.append({"speaker": spk, "start": start, "end": end, "text": w["text"], "events": []})
    for t in turns:
        t["text"] = re.sub(r"\s+([,.!?;:])", r"\1", t["text"]).strip()
        t["start"], t["end"] = round(t["start"], 2), round(t["end"], 2)
    # an event-only turn with no words gets folded into that speaker's previous turn
    out: list[dict] = []
    for t in turns:
        if t["text"]:
            out.append(t)
            continue
        prev = next((o for o in reversed(out) if o["speaker"] == t["speaker"]), None)
        if prev is not None and t["start"] - prev["end"] < 15:   # e.g. a sigh right after someone else spoke
            prev["events"] += t["events"]
    return out


# ------------------------------------------------------------- text to speech

def tts(text: str) -> bytes:
    voice = os.getenv("ELEVENLABS_VOICE_ID", DEFAULT_VOICE)
    body = {"text": text, "model_id": os.getenv("ELEVENLABS_TTS_MODEL", "eleven_multilingual_v2"),
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}
    with _client(60.0) as c:
        r = c.post(f"{API}/text-to-speech/{voice}", params={"output_format": "mp3_44100_64"},
                   headers=_headers(), json=body)
        if r.status_code in (400, 404) and "voice" in _error(r).lower() and "ELEVENLABS_VOICE_ID" not in os.environ:
            # default voice not in this account: use the first voice the account has
            v = c.get(f"{API}/voices", headers=_headers())
            voices = v.json().get("voices", []) if v.status_code == 200 else []
            if voices:
                r = c.post(f"{API}/text-to-speech/{voices[0]['voice_id']}",
                           params={"output_format": "mp3_44100_64"}, headers=_headers(), json=body)
    if r.status_code != 200:
        raise RuntimeError(f"ElevenLabs text-to-speech error {r.status_code}: {_error(r)}")
    return r.content


def brief_script(name: str, person: dict, team: dict, title: str) -> str:
    """A ~30 second private recap, written to be heard (short sentences, no lists)."""
    score, avg = person["mood_score"], team["mood_score"]
    rel = "about the same as" if abs(score - avg) <= 4 else ("above" if score > avg else "below")
    parts = [f"Hi {name}. Here's your private recap of {title}.",
             f"Your mood score was {score}, {rel} the team average of {avg}."]
    if person["dominant"] != "neutral":
        parts.append(f"You came across mostly {person['dominant']}.")
    face = person.get("face")
    said_mismatch = bool(face and face.get("mismatches"))
    if said_mismatch:
        m = face["mismatches"][0]
        parts.append(f"One thing stood out. At {m['time']}, your words sounded {m['said']}, "
                     f"but you looked {m['looked']}.")
    tips = [t for t in person.get("suggestions", []) if not (said_mismatch and "real yes" in t["title"])][:2]
    if tips:
        parts.append("Here's what to try next." if len(tips) > 1 else "One thing to try next.")
        first = re.sub(r"\s*\([^)]*\)", "", re.split(r"(?<=[.!?])\s", tips[0]["detail"])[0])  # drop quotes in brackets
        parts.append(f"{tips[0]['title']}. {first}")
        if len(tips) > 1:
            parts.append(f"And, {tips[1]['title'][0].lower() + tips[1]['title'][1:]}.")
    parts.append("Only you can hear this. Good luck in the next one.")
    return " ".join(parts)

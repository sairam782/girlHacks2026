"""Read meeting transcripts exported by Zoom, Teams, Google Meet, Otter, etc.

Supported: .json (our format), .vtt, .srt, .txt, .docx
Output turns: {"speaker", "start", "end", "text"}. When a file has no timestamps, times are
estimated from word count (about 2.5 words per second) so the timeline still works.
"""
import json
import re
import zipfile
from io import BytesIO
from pathlib import Path

TRANSCRIPT_EXT = {".json", ".vtt", ".srt", ".txt", ".docx"}
WORDS_PER_SEC = 2.5

_TS = r"(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?"
CUE_RE = re.compile(rf"^\s*{_TS}\s*-->\s*{_TS}")
# "Priya: text", "Priya Sharma (She/Her): text", "[00:01:23] Priya: text", "00:01:23 Priya: text"
LINE_RE = re.compile(rf"^\s*(?:\[?{_TS}\]?\s*[-–]?\s*)?([A-Z][\w .'’()/&-]{{0,60}}?)\s*:\s+(.+)$")
# Otter / Teams style header line: "Priya Sharma  0:42" or "Priya Sharma   00:01:05"
HEADER_RE = re.compile(rf"^\s*([A-Z][\w .'’()/&-]{{0,60}}?)\s{{1,}}{_TS}\s*$")
VTT_VOICE = re.compile(r"<v(?:\.[^ >]*)?\s+([^>]+)>(.*?)(?:</v>|$)", re.S)


def _secs(h, m, s, ms) -> float:
    return int(h or 0) * 3600 + int(m) * 60 + int(s) + (int((ms or "0").ljust(3, "0")[:3]) / 1000)


def _clean_name(name: str) -> str:
    name = re.sub(r"\s*\((?:she|he|they)[^)]*\)\s*", " ", name, flags=re.I)  # drop pronoun tags
    return re.sub(r"\s+", " ", name).strip()


def _estimate_times(turns: list[dict]) -> list[dict]:
    t = 0.0
    for turn in turns:
        dur = max(1.0, len(turn["text"].split()) / WORDS_PER_SEC)
        turn["start"], turn["end"] = round(t, 2), round(t + dur, 2)
        t += dur + 0.2   # tight gap so "...and" / "..." endings can still read as cut-offs
    return turns


def _merge(turns: list[dict], max_gap: float = 1.0) -> list[dict]:
    """Join consecutive caption chunks from the same person into one turn."""
    out: list[dict] = []
    for t in turns:
        if out and out[-1]["speaker"] == t["speaker"] and t["start"] - out[-1]["end"] <= max_gap:
            out[-1]["text"] += " " + t["text"]
            out[-1]["end"] = max(out[-1]["end"], t["end"])
        else:
            out.append(dict(t))
    return out


def _split_speaker(text: str, last: str) -> tuple[str, str]:
    m = re.match(r"^([A-Z][\w .'’()/&-]{0,60}?)\s*:\s+(.+)$", text, re.S)
    return (_clean_name(m.group(1)), m.group(2).strip()) if m else (last, text)


def parse_captions(text: str) -> list[dict]:
    """WebVTT or SRT: timestamped cues; speaker from <v Name> or a 'Name: ' prefix."""
    lines = text.replace("\r", "").split("\n")
    turns, i, last = [], 0, "Speaker 1"
    while i < len(lines):
        m = CUE_RE.match(lines[i])
        if not m:
            i += 1
            continue
        start, end = _secs(*m.groups()[0:4]), _secs(*m.groups()[4:8])
        body = []
        i += 1
        while i < len(lines) and lines[i].strip():
            body.append(lines[i].strip())
            i += 1
        cue = " ".join(body)
        voices = VTT_VOICE.findall(cue)
        if voices:
            for name, said in voices:
                said = re.sub(r"<[^>]+>", "", said).strip()
                if said:
                    last = _clean_name(name)
                    turns.append({"speaker": last, "start": start, "end": end, "text": said})
            continue
        cue = re.sub(r"<[^>]+>", "", cue).strip()
        if cue:
            last, said = _split_speaker(cue, last)
            turns.append({"speaker": last, "start": start, "end": end, "text": said})
    return _merge(turns)


def parse_plain(text: str) -> list[dict]:
    """'Name: text' lines (optionally timestamped), or 'Name  0:42' header lines followed by text."""
    turns, cur, timed = [], None, False
    for raw in text.replace("\r", "").split("\n"):
        line = raw.strip()
        if not line:
            continue
        h = HEADER_RE.match(line)
        if h:
            cur = {"speaker": _clean_name(h.group(1)), "start": _secs(*h.groups()[1:5]), "end": None, "text": ""}
            turns.append(cur)
            timed = True
            continue
        m = LINE_RE.match(line)
        if m and not (cur and cur["text"] == "" and HEADER_RE.match(line)):
            g = m.groups()
            start = _secs(*g[0:4]) if g[1] is not None else None
            timed = timed or start is not None
            cur = {"speaker": _clean_name(g[4]), "start": start, "end": None, "text": g[5].strip()}
            turns.append(cur)
        elif cur is not None:
            cur["text"] = (cur["text"] + " " + line).strip()   # continuation line
    turns = [t for t in turns if t["text"]]
    if not turns:
        return []
    if timed and all(t["start"] is not None for t in turns):
        for a, b in zip(turns, turns[1:] + [None]):
            est = a["start"] + max(1.0, len(a["text"].split()) / WORDS_PER_SEC)
            a["end"] = round(min(est, b["start"]) if b else est, 2)
        return turns
    return _estimate_times(turns)


def docx_text(raw: bytes) -> str:
    """Plain text from a .docx without extra dependencies (one line per paragraph)."""
    with zipfile.ZipFile(BytesIO(raw)) as z:
        xml = z.read("word/document.xml").decode("utf8", "ignore")
    xml = re.sub(r"<w:tab/>", "\t", xml)
    xml = re.sub(r"<w:br/>", "\n", xml)
    paras = re.findall(r"<w:p[ >].*?</w:p>", xml, re.S)
    lines = ["".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, re.S)) for p in paras]
    unescape = {"&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'"}
    return "\n".join(re.sub("|".join(unescape), lambda m: unescape[m.group(0)], l) for l in lines)


def parse_transcript(filename: str, raw: bytes) -> tuple[list[dict], str]:
    """Return (turns, title). Raises ValueError with a readable message if nothing usable is found."""
    ext = Path(filename).suffix.lower()
    title = Path(filename).stem.replace("_", " ").strip() or "Uploaded transcript"
    if ext == ".json":
        data = json.loads(raw)
        if isinstance(data, list):
            return data, title
        return data["turns"], data.get("title", title)
    if ext == ".docx":
        text = docx_text(raw)
    else:
        text = raw.decode("utf-8-sig", errors="replace")
    turns = parse_captions(text) if "-->" in text else []
    if not turns:
        turns = parse_plain(text)
    if not turns:
        raise ValueError("No 'Speaker: what they said' lines or timestamped captions found in this file.")
    return turns, title

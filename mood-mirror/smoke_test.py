"""End-to-end smoke test against a RUNNING server.

    uvicorn app:app --port 8000        # in one terminal
    python smoke_test.py                # in another (or: python smoke_test.py http://localhost:8000)

Uses real ElevenLabs / Azure calls when keys are set in .env; otherwise those checks are skipped.
Generates its own test files (transcripts, a face video, and, on a Mac, a spoken 2-person meeting).
"""
import io
import json
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
ROOT = Path(__file__).parent
TMP = Path(tempfile.mkdtemp(prefix="mm_smoke_"))
results: list[tuple[str, str, str]] = []
c = httpx.Client(base_url=BASE, timeout=180)


def check(name: str):
    def wrap(fn):
        t = time.time()
        try:
            note = fn() or ""
            results.append(("PASS", name, f"{note} ({time.time() - t:.1f}s)"))
        except Skip as s:
            results.append(("SKIP", name, str(s)))
        except Exception as e:
            results.append(("FAIL", name, f"{type(e).__name__}: {e}"[:300]))
        return fn
    return wrap


class Skip(Exception):
    pass


def ok(r: httpx.Response) -> dict:
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
    return r.json()


def err(r: httpx.Response, code: int, must_contain: str) -> str:
    assert r.status_code == code, f"expected {code}, got {r.status_code}: {r.text[:150]}"
    detail = r.json().get("detail", "")
    assert must_contain.lower() in detail.lower(), f"message was: {detail[:150]}"
    return detail[:70] + "…"


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


# ------------------------------------------------------------------ fixtures
VTT = """WEBVTT

1
00:00:00.000 --> 00:00:04.200
Priya: I think we should move the survey earlier because users drop off and

2
00:00:04.000 --> 00:00:07.500
Mark: Right, let's park that. Sam, status?

3
00:00:07.800 --> 00:00:12.000
Sam: Honestly I'm worried. We have twelve open bugs and the deadline is Friday.

4
00:00:12.300 --> 00:00:16.000
Priya: Can we decide who owns the payment bug?

5
00:00:16.200 --> 00:00:18.000
Mark: Moving on.

6
00:00:18.300 --> 00:00:22.000
Sam: Okay, sure, that works for me.
"""
TEAMS_VTT = """WEBVTT

x/1-0
00:00:01.000 --> 00:00:04.000
<v Jordan Kim>Wait, sorry, which deadline? I'm a little lost.</v>

x/2-0
00:00:04.300 --> 00:00:06.000
<v Mark Lee (He/Him)>It's this Friday. Great work everyone.</v>
"""
SRT = "1\n00:00:00,000 --> 00:00:03,000\nPriya: I'm confident it's small.\n\n2\n00:00:03,300 --> 00:00:05,000\nMark: Awesome, let's do it.\n"
TXT = "Mark: Great work last week, I'm thrilled.\nPriya: I've raised this twice now. It's frustrating.\nSam: So I was thinking we could--\nMark: Next topic.\n"


def make_docx() -> bytes:
    paras = ["Transcript", "Priya Sharma   0:03", "I think the survey should come first.", "Mark Lee   0:09", "Fair. Great call."]
    body = "".join(f'<w:p><w:r><w:t xml:space="preserve">{p}</w:t></w:r></w:p>' for p in paras)
    xml = ('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
           f"<w:body>{body}</w:body></w:document>")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", xml)
    return buf.getvalue()


def face_video(with_audio: bool) -> Path:
    out = TMP / ("face_audio.mp4" if with_audio else "face_silent.mp4")
    img = ROOT / "sample" / "face_test.jpg"
    args = ["-loop", "1", "-t", "20", "-i", str(img)]
    if with_audio:
        args += ["-f", "lavfi", "-t", "20", "-i", "sine=frequency=300"]
    args += ["-vf", "scale=440:560,format=yuv420p", "-r", "15"]
    args += (["-c:a", "aac", "-shortest"] if with_audio else ["-an"])
    ffmpeg(*args, str(out))
    return out


def spoken_meeting() -> Path:
    """Two Mac voices act out a short meeting with one question that gets moved past."""
    if not shutil.which("say"):
        raise Skip("needs macOS 'say' to generate speech")
    lines = [("Samantha", "Great news everyone, the beta numbers look really good."),
             ("Daniel", "Honestly I'm worried. We still have twelve open bugs and the deadline is Friday."),
             ("Samantha", "Can we decide who owns the payment bug?"),
             ("Daniel", "Let's take that offline. Moving on.")]
    parts = []
    for i, (v, text) in enumerate(lines):
        p = TMP / f"line{i}.aiff"
        subprocess.run(["say", "-v", v, "-o", str(p), text], check=True)
        parts.append(p)
    out = TMP / "meeting.wav"
    inputs = sum((["-i", str(p)] for p in parts), [])
    ffmpeg(*inputs, "-filter_complex", f"{''.join(f'[{i}]' for i in range(len(parts)))}concat=n={len(parts)}:v=0:a=1", str(out))
    return out


# --------------------------------------------------------------------- tests
state: dict = {}


@check("Server up, status")
def _():
    s = ok(c.get("/api/status"))
    state["status"] = s
    return f"speech={s['speech']} llm={s['llm']} voice={s['voice']}"


@check("Dashboard page loads with all controls")
def _():
    r = c.get("/")
    assert r.status_code == 200
    for el in ["txFile", "mediaFile", "analyzeBtn", "demoBtn", "briefBtn", "faceBtn", "person"]:
        assert f'id="{el}"' in r.text, f"missing #{el}"
    return "7 controls present"


@check("Demo: 4 people, cut-off, parked question, face mismatch")
def _():
    d = ok(c.get("/api/demo"))
    state["demo"] = d
    assert set(d["people"]) == {"Mark", "Priya", "Sam", "Jordan"}
    assert [t["speaker"] for t in d["turns"] if t["cut_off"]] == ["Priya"]
    assert d["people"]["Jordan"]["deflected_questions"] == 1
    mm = d["people"]["Sam"]["face"]["mismatches"]
    assert mm and mm[0]["time"] == "2:47", mm
    for name, p in d["people"].items():
        assert p["suggestions"], f"{name} has no suggestions"
    return f"team mood {d['team']['mood_score']}, Sam mismatch at {mm[0]['time']}"


@check("Voice brief (demo, Sam)")
def _():
    b = ok(c.post("/api/brief", data={"analysis_id": state["demo"]["id"], "speaker": "Sam"}))
    assert "2:47" in b["script"], "mismatch missing from the brief"
    if not b["audio"]:
        return "script only (no ElevenLabs key; browser voice fallback)"
    a = c.get(b["url"])
    assert a.status_code == 200 and a.headers["content-type"] == "audio/mpeg" and len(a.content) > 5000, len(a.content)
    (TMP / "brief_sam.mp3").write_bytes(a.content)
    return f"ElevenLabs audio {len(a.content) // 1024} KB"


for fname, content, expect in [("zoom.vtt", VTT, {"Priya", "Mark", "Sam"}),
                               ("teams.vtt", TEAMS_VTT, {"Jordan Kim", "Mark Lee"}),
                               ("meet.srt", SRT, {"Priya", "Mark"}),
                               ("notes.txt", TXT, {"Mark", "Priya", "Sam"}),
                               ("teams.docx", None, {"Priya Sharma", "Mark Lee"})]:
    @check(f"Transcript only: {fname}")
    def _(fname=fname, content=content, expect=expect):
        raw = make_docx() if content is None else content.encode()
        d = ok(c.post("/api/analyze", files={"transcript": (fname, raw)}))
        assert set(d["people"]) == expect, set(d["people"])
        cut = [t["speaker"] for t in d["turns"] if t["cut_off"]]
        if fname == "zoom.vtt":
            assert cut == ["Priya"], cut
            assert d["people"]["Priya"]["deflected_questions"] == 1
            state["zoom"] = d
        if fname == "notes.txt":
            assert cut == ["Sam"], cut
        return f"{len(d['turns'])} turns, names {sorted(d['people'])}, cut-offs {cut}"


@check("Transcript + video: face layer from the meeting video")
def _():
    vid = face_video(with_audio=False)
    d = ok(c.post("/api/analyze", files={"transcript": ("zoom.vtt", VTT.encode()), "media": ("meeting.mp4", vid.read_bytes())}))
    assert d["has_meeting_video"] and d["source"] == "transcript file + video", d["source"]
    f = ok(c.post("/api/face", data={"analysis_id": d["id"], "speaker": "Sam", "consent": "true", "use_meeting_video": "true"}))
    face = f["person"]["face"]
    assert face["face_rate"] > 0.8, face["face_rate"]
    assert face["per_turn"], "no per-turn face labels"
    top = max(face["mix"], key=face["mix"].get)
    state["face_analysis"] = d["id"]
    return f"face seen in {round(face['face_rate'] * 100)}% of frames, mostly '{top}'"


@check("Face video upload for one person")
def _():
    vid = face_video(with_audio=False)
    f = ok(c.post("/api/face", data={"analysis_id": state["zoom"]["id"], "speaker": "Priya", "consent": "true", "offset": "0"},
                  files={"file": ("me.mp4", vid.read_bytes())}))
    return f"face_rate {f['person']['face']['face_rate']}"


@check("Recording only: real transcription with speakers")
def _():
    if not state["status"]["speech"]:
        raise Skip("no ElevenLabs/Azure key")
    wav = spoken_meeting()
    d = ok(c.post("/api/analyze", files={"media": ("meeting.wav", wav.read_bytes())}))
    assert len(d["people"]) >= 2, list(d["people"])
    lines = [f"{t['speaker']}: {t['text'][:40]}" for t in d["turns"]]
    state["recording"] = d
    return f"{len(d['people'])} speakers, {len(d['turns'])} turns via {d['source']} | " + " / ".join(lines[:4])


@check("Recording: voice brief for a real speaker")
def _():
    d = state.get("recording")
    if not d:
        raise Skip("recording test skipped")
    spk = next(iter(d["people"]))
    b = ok(c.post("/api/brief", data={"analysis_id": d["id"], "speaker": spk, "name": "Alex"}))
    assert b["script"].startswith("Hi Alex.")
    return "audio" if b["audio"] else "script only"


@check("Video with sound, transcribed")
def _():
    if not state["status"]["speech"]:
        raise Skip("no ElevenLabs/Azure key")
    r = c.post("/api/analyze", files={"media": ("talk.mp4", face_video(with_audio=True).read_bytes())})
    # a sine tone has no words: a clean "no speech" error is the correct outcome
    if r.status_code == 200:
        return f"accepted ({len(r.json()['turns'])} turns)"
    return "clean error: " + err(r, 500, "no speech")


@check("Error: video with no audio track")
def _():
    if not state["status"]["speech"]:
        raise Skip("no transcriber key")
    return err(c.post("/api/analyze", files={"media": ("silent.mp4", face_video(False).read_bytes())}), 400, "no audio track")


@check("Error: nothing uploaded")
def _():
    return err(c.post("/api/analyze"), 400, "upload a transcript")


@check("Error: unreadable transcript")
def _():
    return err(c.post("/api/analyze", files={"transcript": ("x.txt", b"hello there no speakers here")}), 400, "could not read")


@check("Error: wrong transcript type")
def _():
    return err(c.post("/api/analyze", files={"transcript": ("x.pdf", b"%PDF-1.4")}), 400, "transcript must be")


@check("Error: face without consent")
def _():
    return err(c.post("/api/face", data={"analysis_id": state["demo"]["id"], "speaker": "Sam"}), 400, "consent")


@check("Error: brief for unknown analysis")
def _():
    return err(c.post("/api/brief", data={"analysis_id": "nope", "speaker": "Sam"}), 404, "expired")


# -------------------------------------------------------------------- report
w = max(len(n) for _, n, _ in results)
print(f"\nMood Mirror smoke test against {BASE}\n")
for status, name, note in results:
    print(f"  {status:4}  {name.ljust(w)}  {note}")
fails = sum(s == "FAIL" for s, _, _ in results)
skips = sum(s == "SKIP" for s, _, _ in results)
print(f"\n{len(results) - fails - skips} passed, {fails} failed, {skips} skipped. Test files in {TMP}")
sys.exit(1 if fails else 0)

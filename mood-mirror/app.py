"""Mood Mirror: recorded meeting in, private per-person mood report out.

Run:  uvicorn app:app --reload --port 8000   then open http://localhost:8000
"""
import json
import os
import shutil
import tempfile
import uuid
import zipfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).parent


def load_env():
    """Tiny .env loader so there is no extra dependency."""
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()

from emotions import EMOTIONS, label_turns, llm_client  # noqa: E402
from insights import add_suggestions, flag_events, summarize  # noqa: E402
from transcribe import speech_configured, transcribe_azure  # noqa: E402
import voice  # noqa: E402
from transcripts import TRANSCRIPT_EXT, parse_transcript  # noqa: E402

AUDIO_EXT = {".wav", ".mp3", ".m4a", ".mp4", ".mov", ".webm", ".ogg", ".flac", ".aac"}
VIDEO_EXT = {".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"}

# Recent analyses live in memory only (nothing written to a database). The meeting video, if any,
# is kept just long enough to run the face layer on it, and only the latest one.
ANALYSES: dict[str, dict] = {}
MEETING_VIDEO: dict[str, str] = {}


def remember(result: dict, video_path: str | None = None) -> dict:
    result["id"] = uuid.uuid4().hex[:12]
    ANALYSES[result["id"]] = result
    while len(ANALYSES) > 20:
        ANALYSES.pop(next(iter(ANALYSES)))
    for old in list(MEETING_VIDEO.values()):
        if os.path.exists(old):
            os.unlink(old)
    MEETING_VIDEO.clear()
    if video_path:
        MEETING_VIDEO[result["id"]] = video_path
    result["has_meeting_video"] = bool(video_path)
    return result

app = FastAPI(title="Mood Mirror")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


@app.get("/")
def index():
    return FileResponse(ROOT / "static" / "index.html")


@app.get("/api/status")
def status():
    _, _, engine = llm_client()
    return {"speech": transcriber(), "llm": engine, "voice": voice.configured(), "emotions": EMOTIONS}


def transcriber() -> str | None:
    """ElevenLabs Scribe if its key is set (or TRANSCRIBER=elevenlabs), else Azure Speech, else none."""
    pref = os.getenv("TRANSCRIBER", "").lower()
    if pref == "azure" and speech_configured():
        return "azure"
    if voice.configured():
        return "elevenlabs"
    return "azure" if speech_configured() else None


def analyze_turns(turns: list[dict], title: str, source: str, engine: str) -> dict:
    turns = [{"id": i, "speaker": str(t["speaker"]), "start": float(t["start"]),
              "end": float(t["end"]), "text": str(t["text"]).strip(), "events": list(t.get("events", []))}
             for i, t in enumerate(sorted(turns, key=lambda t: float(t["start"])))
             if str(t.get("text", "")).strip()]
    if not turns:
        raise HTTPException(400, "No speech found in this meeting.")
    turns = flag_events(turns)
    turns, label_engine = label_turns(turns, engine)
    report = summarize(turns)
    tip_engine = add_suggestions(report, engine)
    return {"title": title, "source": source, "engine": {"labels": label_engine, "suggestions": tip_engine},
            "emotions": EMOTIONS, "turns": turns, **report}


def parse_transcript_json(raw: bytes) -> tuple[list[dict], str]:
    data = json.loads(raw)
    if isinstance(data, list):
        return data, "Uploaded transcript"
    return data["turns"], data.get("title", "Uploaded transcript")


@app.get("/api/demo")
def demo(engine: str = Query("auto", pattern="^(auto|offline)$"), face: bool = True):
    turns, title = parse_transcript_json((ROOT / "sample" / "demo_meeting.json").read_bytes())
    result = remember(analyze_turns(turns, title, "demo transcript", engine))
    if face:  # simulated face layer for one person, clearly labeled as such in the UI
        sim = json.loads((ROOT / "sample" / "demo_face_sam.json").read_text())
        from video import attach_face
        attach_face(result, sim["speaker"], sim, 0.0, source="simulated demo data")
    return result


@app.post("/api/analyze")
async def analyze(file: UploadFile | None = File(None), transcript: UploadFile | None = File(None),
                  media: UploadFile | None = File(None), language: str = "en-US", num_speakers: int | None = None,
                  engine: str = Query("auto", pattern="^(auto|offline)$")):
    """Upload a transcript, a video/audio recording, or both.

    Both: the transcript gives the words and real names (no transcription needed) and a video is kept
    for the face layer. `file` is the older single-upload field and is routed by its extension.
    """
    if file is not None and file.filename:
        if Path(file.filename).suffix.lower() in TRANSCRIPT_EXT:
            transcript = transcript or file
        else:
            media = media or file
    transcript = transcript if transcript is not None and transcript.filename else None
    media = media if media is not None and media.filename else None
    if transcript is None and media is None:
        raise HTTPException(400, "Upload a transcript, a video or audio recording, or both.")

    if transcript is not None and Path(transcript.filename).suffix.lower() not in TRANSCRIPT_EXT:
        raise HTTPException(400, "Transcript must be .txt, .vtt, .srt, .docx or .json.")
    media_path, media_ext = None, None
    if media is not None:
        media_ext = Path(media.filename).suffix.lower()
        if media_ext not in AUDIO_EXT | VIDEO_EXT:
            raise HTTPException(400, f"Unsupported video/audio type {media_ext}.")
        tmp = tempfile.NamedTemporaryFile(suffix=media_ext, delete=False)
        shutil.copyfileobj(media.file, tmp)
        tmp.close()
        media_path = tmp.name

    def drop_media():
        if media_path and os.path.exists(media_path):
            os.unlink(media_path)

    if transcript is not None:
        try:
            turns, title = parse_transcript(transcript.filename, await transcript.read())
        except (ValueError, KeyError, UnicodeDecodeError, zipfile.BadZipFile) as e:
            drop_media()
            raise HTTPException(400, f"Could not read the transcript: {e}")
        keep = media_path if media_ext in VIDEO_EXT else None
        if not keep:
            drop_media()
        source = "transcript file" + (" + video" if keep else "")
        return remember(analyze_turns(turns, title, source, engine), keep)

    engine_name = transcriber()
    if engine_name is None:
        drop_media()
        raise HTTPException(400, "Audio needs ELEVENLABS_API_KEY (or Azure Speech keys) in .env. "
                                 "Without keys, upload a transcript file or run the demo.")
    try:
        turns = (voice.transcribe(media_path, language, num_speakers) if engine_name == "elevenlabs"
                 else transcribe_azure(media_path, language))
    except Exception as e:
        drop_media()
        raise HTTPException(400 if "no audio track" in str(e) else 500, f"Transcription failed: {e}")
    keep = media_path if media_ext in VIDEO_EXT else None
    if not keep:
        drop_media()
    source = "audio (ElevenLabs Scribe)" if engine_name == "elevenlabs" else "audio (Azure Speech)"
    return remember(analyze_turns(turns, Path(media.filename).stem, source, engine), keep)


@app.post("/api/face")
async def face(analysis_id: str = Form(...), speaker: str = Form(...), consent: bool = Form(False),
               offset: float = Form(0.0), use_meeting_video: bool = Form(False),
               file: UploadFile | None = File(None)):
    """Add facial cues for ONE person from their own webcam video (opt-in)."""
    if not consent:
        raise HTTPException(400, "Face analysis needs the person's consent (tick the box).")
    result = ANALYSES.get(analysis_id)
    if result is None:
        raise HTTPException(404, "That analysis expired. Run the meeting analysis again.")
    if speaker not in result["people"]:
        raise HTTPException(400, f"Unknown speaker {speaker}.")
    from video import analyze_video, attach_face

    if use_meeting_video:
        path = MEETING_VIDEO.get(analysis_id)
        if not path or not os.path.exists(path):
            raise HTTPException(400, "No meeting video available. Upload the person's video instead.")
        cleanup = None
    else:
        if file is None:
            raise HTTPException(400, "Upload a video file.")
        ext = Path(file.filename or "").suffix.lower()
        if ext not in VIDEO_EXT:
            raise HTTPException(400, f"Unsupported video type {ext}.")
        tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
        shutil.copyfileobj(file.file, tmp)
        tmp.close()
        path = cleanup = tmp.name
    try:
        vid = analyze_video(path)
    except RuntimeError as e:
        raise HTTPException(400, str(e))
    finally:
        if cleanup:
            os.unlink(cleanup)  # the uploaded video is deleted right after processing
    person = attach_face(result, speaker, vid, offset, source="your video")
    return {"speaker": speaker, "person": person}


BRIEF_CACHE: dict[tuple, bytes] = {}


@app.post("/api/brief")
def brief(analysis_id: str = Form(...), speaker: str = Form(...), name: str = Form("")):
    """Private spoken recap for one person. Audio from ElevenLabs; script only if no key is set."""
    result = ANALYSES.get(analysis_id)
    if result is None or speaker not in result["people"]:
        raise HTTPException(404, "That analysis expired. Run the meeting analysis again.")
    script = voice.brief_script(name.strip() or speaker, result["people"][speaker], result["team"], result["title"])
    if not voice.configured():
        return {"script": script, "audio": False}
    key = (analysis_id, speaker, script)
    if key not in BRIEF_CACHE:
        try:
            BRIEF_CACHE[key] = voice.tts(script)
        except Exception as e:
            raise HTTPException(502, str(e))
        while len(BRIEF_CACHE) > 30:
            BRIEF_CACHE.pop(next(iter(BRIEF_CACHE)))
    from urllib.parse import urlencode
    return {"script": script, "audio": True,
            "url": "/api/brief/audio?" + urlencode({"analysis_id": analysis_id, "speaker": speaker, "n": len(BRIEF_CACHE)})}


@app.get("/api/brief/audio")
def brief_audio(analysis_id: str, speaker: str):
    for (aid, spk, _), audio in reversed(list(BRIEF_CACHE.items())):
        if aid == analysis_id and spk == speaker:
            return Response(audio, media_type="audio/mpeg")
    raise HTTPException(404, "Generate the brief first.")

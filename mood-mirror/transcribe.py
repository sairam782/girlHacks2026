"""Audio/video file -> diarized transcript turns using Azure AI Speech.

Each turn: {"speaker": str, "start": float sec, "end": float sec, "text": str}
"""
import os
import subprocess
import tempfile
import threading


NO_AUDIO = ("This file has no audio track, so there is nothing to transcribe. Record with the microphone on, "
            "or upload the meeting audio. (A face-only video goes in 'Add face video' after the meeting is analyzed.)")


def has_audio(path: str) -> bool | None:
    """True/False if ffprobe can tell, None if ffprobe is missing or can't read the file."""
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                            "-of", "csv=p=0", path], capture_output=True, text=True, timeout=30)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if r.returncode != 0:
        return None
    return bool(r.stdout.strip())


def run_ffmpeg(args: list[str]) -> None:
    """Run ffmpeg and raise a readable error (its own message, not just an exit code)."""
    try:
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], capture_output=True, text=True)
    except FileNotFoundError:
        raise RuntimeError("ffmpeg is not installed. On a Mac: brew install ffmpeg")
    if r.returncode != 0:
        msg = (r.stderr or "").strip().splitlines()
        raise RuntimeError("Could not read the audio: " + (msg[-1] if msg else f"ffmpeg exit {r.returncode}"))


def to_wav16k(src_path: str) -> str:
    """Convert any audio or video file to 16 kHz mono 16-bit WAV (what Azure Speech wants)."""
    if has_audio(src_path) is False:
        raise RuntimeError(NO_AUDIO)
    out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    run_ffmpeg(["-i", src_path, "-vn", "-ac", "1", "-ar", "16000", "-sample_fmt", "s16", out])
    return out


def wav_duration(path: str) -> float:
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                            "-of", "default=nw=1:nk=1", path],
                           capture_output=True, text=True, check=True)
        return float(r.stdout.strip())
    except Exception:
        return 0.0


def speech_configured() -> bool:
    return bool(os.getenv("AZURE_SPEECH_KEY") and os.getenv("AZURE_SPEECH_REGION"))


def transcribe_azure(src_path: str, language: str = "en-US") -> list[dict]:
    import azure.cognitiveservices.speech as speechsdk

    wav = to_wav16k(src_path)
    duration = wav_duration(wav)

    speech_config = speechsdk.SpeechConfig(
        subscription=os.environ["AZURE_SPEECH_KEY"],
        region=os.environ["AZURE_SPEECH_REGION"],
    )
    speech_config.speech_recognition_language = language
    audio_config = speechsdk.audio.AudioConfig(filename=wav)
    transcriber = speechsdk.transcription.ConversationTranscriber(
        speech_config=speech_config, audio_config=audio_config)

    turns: list[dict] = []
    errors: list[str] = []
    done = threading.Event()

    def on_transcribed(evt):
        r = evt.result
        if r.reason == speechsdk.ResultReason.RecognizedSpeech and r.text.strip():
            start = r.offset / 1e7  # offsets are in 100 ns ticks
            turns.append({
                "speaker": r.speaker_id if r.speaker_id and r.speaker_id != "Unknown" else "Unknown",
                "start": round(start, 2),
                "end": round(start + r.duration / 1e7, 2),
                "text": r.text.strip(),
            })

    def on_canceled(evt):
        d = evt.cancellation_details if hasattr(evt, "cancellation_details") else None
        if d is not None and d.reason == speechsdk.CancellationReason.Error:
            errors.append(f"{d.error_code}: {d.error_details}")
        done.set()

    transcriber.transcribed.connect(on_transcribed)
    transcriber.canceled.connect(on_canceled)
    transcriber.session_stopped.connect(lambda evt: done.set())

    transcriber.start_transcribing_async().get()
    done.wait(timeout=max(180, duration * 2 + 60))
    transcriber.stop_transcribing_async().get()

    try:
        os.remove(wav)
    except OSError:
        pass

    if not turns:
        detail = "; ".join(errors) if errors else "no speech recognized"
        raise RuntimeError(f"Azure Speech returned no text ({detail}). Check AZURE_SPEECH_KEY / "
                           "AZURE_SPEECH_REGION, the language setting, and that voices are audible.")
    return merge_turns(sorted(turns, key=lambda t: t["start"]))


def merge_turns(turns: list[dict], max_gap: float = 0.8, max_len: float = 30.0) -> list[dict]:
    """Join back-to-back segments from the same speaker so each turn reads as one thought."""
    merged: list[dict] = []
    for t in turns:
        if (merged and merged[-1]["speaker"] == t["speaker"]
                and t["start"] - merged[-1]["end"] <= max_gap
                and t["end"] - merged[-1]["start"] <= max_len):
            merged[-1]["end"] = t["end"]
            merged[-1]["text"] += " " + t["text"]
        else:
            merged.append(dict(t))
    return merged

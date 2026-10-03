# Mood Mirror

A recorded meeting goes in. Each person gets a **private** report: how the meeting felt for them, what happened right before each feeling, and 2 to 3 concrete things to do next.

## Run it (2 minutes)

```bash
python3.12 -m venv .venv && source .venv/bin/activate   # Python 3.11 to 3.13
pip install -r requirements.txt        # also needs ffmpeg on your PATH
cp .env.example .env                   # optional: add Azure keys
uvicorn app:app --reload --port 8000
```

Open http://localhost:8000 and click **Run demo meeting**. That works with no keys at all.

Check your keys before the demo: `python check_azure.py path/to/meeting.wav` (checks ElevenLabs, Azure OpenAI, and transcription)

## Inputs

Upload a **transcript file**, a **video or audio file**, or **both**:

| You upload | What happens |
|---|---|
| Transcript only | Words and real names come from the file. No keys needed. |
| Video or audio only | ElevenLabs Scribe (or Azure Speech) transcribes it and separates speakers. |
| Transcript + video | Words and names from the transcript (no transcription), and the video is kept for the face layer ("Use the meeting video"). |

Transcript formats (`transcripts.py`): Zoom and Teams `.vtt` (including `<v Name>` captions), `.srt`, Teams `.docx`, plain `.txt` with `Name: text` lines (timestamps optional) or Otter-style `Name  0:42` headers, and our `.json`. Files without timestamps get estimated times. A line ending in `--` or `...` right before someone else speaks counts as a cut-off.

## How it works

1. **Recording to transcript.** `voice.py` sends the audio to **ElevenLabs Scribe** (`scribe_v2`), which separates speakers and tags sounds like laughter or sighs. Azure AI Speech (`transcribe.py`) is the fallback. Speakers come back as "Speaker 1, 2…"; rename them in the UI. Pass `?num_speakers=4` to help it.
2. **Facts.** `insights.flag_events` marks moments anyone can verify: a person **cut off** mid-sentence (overlap + unfinished sentence) and a **question moved past** ("moving on", "let's take that offline").
3. **Feelings from words.** `emotions.py` labels every turn as one of: neutral, frustrated, happy, confused, anxious, confident, sad, angry, with the exact words that show it. Azure OpenAI if configured, offline lexicon otherwise (and as a fallback).
4. **Per-person report.** Mood score (0 to 100) vs team average, emotion mix, airtime vs even split, a timeline, and each feeling linked to its cause ("frustrated at 0:55, you were cut off at 0:08").
5. **Suggestions.** Actions tied to timestamps, never "be happier". The person who interrupts or parks questions gets told too.
6. **Face layer (optional, opt-in).** `video.py` reads one person's own webcam video at 2 frames/sec: OpenCV face detector, then a 93 KB expression model (bundled in `models/`, runs on CPU, no download). Expressions are averaged per transcript turn and compared with the words:
   * **Words vs face mismatch:** "Okay, sure, that works for me" (words: confident) while looking anxious → "Check if that was a real yes."
   * **Reactions:** strong expressions while someone else was talking.
   * Shown as a dashed line on the timeline, a "Your face" bar, a Face column, and an agreement score.

7. **Voice brief (ElevenLabs).** "Play my voice brief" reads each person a private 30-second recap in an ElevenLabs voice: their score vs the team, main tone, any words-vs-face mismatch, and the top next steps. Without a key, the browser's built-in voice reads it so the demo still works.

## ElevenLabs: what you need

* An API key from elevenlabs.io (Profile, API keys) in `.env` as `ELEVENLABS_API_KEY`. The key needs Speech to Text and Text to Speech enabled.
* That's it. Transcription switches to Scribe automatically, and the voice brief turns on.
* Optional: pick a voice in the ElevenLabs Voice Library and set `ELEVENLABS_VOICE_ID`. If the default voice isn't in your account, the app uses your first available voice.
* Run `python check_azure.py meeting.wav` to confirm: it writes `voice_check.mp3` and prints the speakers it heard.

## Face layer: what you need

* **A video of one person's face**, ideally their own webcam recording of the meeting (like their Zoom tile). Face the camera, even front lighting, no strong backlight.
* **Which speaker they are** (pick them in "Viewing as", then **Add face video**).
* **Start time:** if the video starts later than the meeting recording, enter the offset in seconds. If the meeting recording itself is a video with one face visible, tick **Use the meeting video** (offset 0).
* **Consent tick box.** The video is deleted right after processing; frames are never saved.
* Speed: about 10 seconds per minute of video on a laptop CPU.
* Face models only know 7 basic expressions, so there is no "confident" from faces, and "surprise" is shown as "confused" (approximate).
* The demo's face data for Sam is **simulated** and labeled as such in the UI. Upload a real video to replace it.

## Design choices to mention in the pitch

* **Words are the main signal.** More accurate for confused and anxious, and works on audio-only recordings. No voice-tone emotion AI.
* **Faces are a supporting cue, never the main signal.** Opt-in per person, own video only, processed locally, never stored. The words-vs-face mismatch is shown privately to that person as a question, not a verdict.
* **Be upfront about regulation.** The EU AI Act bans workplace emotion recognition from biometric signals such as faces, so for EU deployments the face layer is switched off and the product runs on words only.
* **Private by default.** The UI shows one person's view at a time; others appear only inside the team average.
* **Explainable.** Every label shows the words behind it. Labels describe the words used, not a diagnosis.

## Files

| File | What it does |
|---|---|
| `app.py` | FastAPI server: `/api/demo`, `/api/analyze` (`transcript` and/or `media` files), `/api/face` (one person's video), `/api/brief` (voice brief), `/api/status` |
| `transcripts.py` | Reads Zoom / Teams / Meet / Otter transcript files (.vtt, .srt, .txt, .docx, .json) |
| `voice.py` | ElevenLabs Scribe transcription (speakers + audio events) and the spoken voice brief |
| `transcribe.py` | ffmpeg conversion + Azure Speech diarization (fallback) |
| `emotions.py` | Emotion labels (Azure OpenAI / OpenAI / offline) |
| `insights.py` | Cut-offs, parked questions, per-person stats, suggestions |
| `video.py` | Face detection + expression model, words-vs-face mismatches, reactions |
| `models/` | Bundled expression model (MIT, see MODEL_SOURCE.txt) |
| `static/index.html` | The dashboard (no build step) |
| `sample/demo_meeting.json` | 3-minute scripted meeting; also a script your team can act out and record |
| `sample/demo_face_sam.json` | Simulated face samples for the offline demo |

Transcript JSON format: `{"title": "...", "turns": [{"speaker": "A", "start": 0.0, "end": 4.2, "text": "..."}]}`

## Recording tips

Use one laptop mic in a quiet corner, speakers about equal distance, and avoid talking over each other except for the one planted interruption. Read `sample/demo_meeting.json` as your script so the live result matches the demo.

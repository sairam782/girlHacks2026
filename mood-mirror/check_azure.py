"""Quick key check before the demo:   python check_azure.py [path/to/meeting.wav]

Pings the emotion LLM and ElevenLabs voice, and (if you pass a file) runs speaker-separated transcription.
"""
import sys
import time

import app  # loads .env
import voice
from emotions import chat_json, llm_client
from transcribe import transcribe_azure

client, model, engine = llm_client()
print(f"Emotion engine: {engine}")
if client:
    t = time.time()
    reply = chat_json(client, model, 'Reply with JSON {"ok": true}.', "ping")
    print(f"  LLM reply {reply} in {time.time() - t:.1f}s")

print(f"ElevenLabs voice: {voice.configured()}")
if voice.configured():
    t = time.time()
    audio = voice.tts("Mood Mirror is ready.")
    open("voice_check.mp3", "wb").write(audio)
    print(f"  {len(audio)} bytes of speech in {time.time() - t:.1f}s -> voice_check.mp3 (play it)")

engine_name = app.transcriber()
print(f"Transcriber: {engine_name}")
if len(sys.argv) > 1 and engine_name:
    t = time.time()
    lang = sys.argv[2] if len(sys.argv) > 2 else "en-US"
    turns = voice.transcribe(sys.argv[1], lang) if engine_name == "elevenlabs" else transcribe_azure(sys.argv[1], lang)
    print(f"  {len(turns)} turns, {len({x['speaker'] for x in turns})} speakers, {time.time() - t:.0f}s")
    for x in turns[:8]:
        ev = f"  [{', '.join(x['events'])}]" if x.get("events") else ""
        print(f"  {x['start']:6.1f}s {x['speaker']}: {x['text'][:80]}{ev}")

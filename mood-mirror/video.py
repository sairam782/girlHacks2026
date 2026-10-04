"""Facial cues from ONE person's own webcam video, lined up with the meeting transcript.

Pipeline: sample ~2 frames/sec -> OpenCV face detector -> largest face -> tiny expression
model (mini-Xception trained on FER-2013, bundled in models/, 93 KB, runs on CPU) -> map
to the app's emotion labels -> average per transcript turn.

Frames are processed in memory and never written to disk.
"""
from pathlib import Path

import numpy as np

from emotions import EMOTIONS, VALENCE

MODEL_PATH = Path(__file__).parent / "models" / "fer_emotion_quantized.tflite"
FER_LABELS = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]
# Face models only know 7 basic expressions. Map them onto our labels (approximate on purpose).
FER_TO_APP = {"angry": "angry", "disgust": "frustrated", "fear": "anxious", "happy": "happy",
              "sad": "sad", "surprise": "confused", "neutral": "neutral"}
NEGATIVE = {"angry", "frustrated", "anxious", "sad"}

_interp = None
_cascade = None


def _load():
    """Lazy-load the face detector and expression model once."""
    global _interp, _cascade
    if _interp is None:
        try:
            from ai_edge_litert.interpreter import Interpreter
        except ImportError:  # fall back to full TensorFlow if LiteRT has no wheel for this platform
            from tensorflow.lite import Interpreter  # type: ignore
        _interp = Interpreter(model_path=str(MODEL_PATH))
        _interp.allocate_tensors()
    if _cascade is None:
        import cv2
        _cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    return _interp, _cascade


def classify_face(gray_face) -> dict:
    """64x64 grayscale face crop -> probabilities over our emotion labels."""
    import cv2
    interp, _ = _load()
    x = cv2.resize(gray_face, (64, 64)).astype(np.float32) / 255.0
    x = (x - 0.5) * 2.0
    interp.set_tensor(interp.get_input_details()[0]["index"], x[None, :, :, None])
    interp.invoke()
    raw = interp.get_tensor(interp.get_output_details()[0]["index"])[0]
    probs = {e: 0.0 for e in EMOTIONS}
    for lab, p in zip(FER_LABELS, raw):
        probs[FER_TO_APP[lab]] += float(p)
    return probs


def analyze_video(path: str, sample_fps: float = 2.0) -> dict:
    """Return per-sample facial expression probabilities for the largest face in each frame."""
    import cv2
    _, cascade = _load()
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise RuntimeError("Could not open the video file.")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    step = max(1, int(round(fps / sample_fps)))
    samples, idx = [], 0
    while True:
        if not cap.grab():
            break
        if idx % step == 0:
            ok, frame = cap.retrieve()
            if not ok:
                break
            t = idx / fps
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            scale = 640.0 / gray.shape[1] if gray.shape[1] > 640 else 1.0
            small = cv2.resize(gray, None, fx=scale, fy=scale) if scale < 1 else gray
            small = cv2.equalizeHist(small)
            faces = cascade.detectMultiScale(small, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
            if len(faces):
                x, y, w, h = (int(v / scale) for v in max(faces, key=lambda f: f[2] * f[3]))
                pad = int(0.1 * w)   # a little margin around the face, like the model's training crops
                crop = gray[max(0, y - pad): y + h + pad, max(0, x - pad): x + w + pad]
                samples.append({"t": round(t, 2), "probs": classify_face(crop)})
            else:
                samples.append({"t": round(t, 2), "probs": None})
        idx += 1
    cap.release()
    if not samples:
        raise RuntimeError("No frames could be read from the video.")
    found = [s for s in samples if s["probs"]]
    if len(found) < max(3, 0.1 * len(samples)):
        raise RuntimeError("A face was visible in too few frames. Face the camera with good, even light.")
    return {"samples": samples, "duration": round(idx / fps, 1), "face_rate": round(len(found) / len(samples), 2)}


def _top(probs: dict) -> tuple[str, float]:
    e = max(probs, key=probs.get)
    return e, probs[e]


def _valence(probs: dict) -> float:
    return round(sum(p * VALENCE[e] for e, p in probs.items()), 3)


def attach_face(report: dict, speaker: str, video: dict, offset: float = 0.0, source: str = "video") -> dict:
    """Line video samples up with the transcript and add a `face` block to that person.

    offset = meeting time (sec) at which the video starts. 0 if the video IS the meeting recording.
    """
    p = report["people"][speaker]
    samples = [{"t": round(s["t"] + offset, 2), "probs": s["probs"]} for s in video["samples"]]
    found = [s for s in samples if s["probs"]]

    # Overall mix of expressions, from frames where a face was visible
    mix = {e: 0.0 for e in EMOTIONS}
    for s in found:
        mix[_top(s["probs"])[0]] += 1
    mix = {e: round(c / len(found), 3) for e, c in mix.items()}

    # Smoothed valence line for the timeline (moving average over ~3 samples)
    vals = [_valence(s["probs"]) for s in found]
    smooth = [round(float(np.mean(vals[max(0, i - 1): i + 2])), 3) for i in range(len(vals))]
    line = [{"t": s["t"], "valence": v} for s, v in zip(found, smooth)]

    # Average the face over each transcript turn (own turns AND while others talk)
    per_turn = {}
    for t in report["turns"]:
        win = [s["probs"] for s in found if t["start"] <= s["t"] <= t["end"]]
        if len(win) < 2:
            continue
        avg = {e: float(np.mean([w[e] for w in win])) for e in EMOTIONS}
        emo, conf = _top(avg)
        per_turn[t["id"]] = {"emotion": emo, "conf": round(conf, 2), "valence": _valence(avg)}

    own = [t for t in report["turns"] if t["speaker"] == speaker and t["id"] in per_turn]
    mismatches, agree = [], 0
    for t in own:
        f = per_turn[t["id"]]
        text_pos = t["emotion"] in ("happy", "confident")
        face_neg = f["emotion"] in NEGATIVE and f["conf"] >= 0.45
        if text_pos and face_neg:
            mismatches.append({"id": t["id"], "t": t["start"], "time": _mmss(t["start"]), "text": t["text"],
                               "said": t["emotion"], "looked": f["emotion"], "conf": f["conf"]})
        elif (VALENCE[t["emotion"]] >= 0) == (f["valence"] >= -0.1):
            agree += 1

    # Strong reactions while someone else was talking
    reactions = []
    for t in report["turns"]:
        f = per_turn.get(t["id"])
        if t["speaker"] != speaker and f and f["emotion"] in NEGATIVE and f["conf"] >= 0.5:
            reactions.append({"id": t["id"], "t": t["start"], "time": _mmss(t["start"]), "speaker": t["speaker"],
                              "text": t["text"], "looked": f["emotion"], "conf": f["conf"]})
    reactions = sorted(reactions, key=lambda r: -r["conf"])[:3]

    p["face"] = {
        "source": source,
        "face_rate": video["face_rate"],
        "mix": mix,
        "line": line,
        "per_turn": {str(k): v for k, v in per_turn.items()},
        "mismatches": mismatches,
        "reactions": sorted(reactions, key=lambda r: r["t"]),
        "agreement": round(agree / len(own), 2) if own else None,
    }
    add_face_tips(p)
    return p


def add_face_tips(p: dict) -> None:
    f = p["face"]
    tips = []
    if f["mismatches"]:
        m = f["mismatches"][0]
        tips.append({"title": "Check if that was a real yes", "at": m["t"],
                     "detail": f'At {m["time"]} your words sounded {m["said"]} ("{_short(m["text"])}") but you '
                               f'looked {m["looked"]}. If you have doubts, say so in the follow-up while it is easy to change.'})
    elif f["reactions"]:
        r = f["reactions"][0]
        tips.append({"title": "Say what you held back", "at": r["t"],
                     "detail": f'You looked {r["looked"]} at {r["time"]} while someone else was talking '
                               "but didn't speak. If it matters, add one line about it to the follow-up."})
    p["suggestions"] = (tips + [s for s in p.get("suggestions", []) if s["title"] not in {x["title"] for x in tips}])[:3]


def _mmss(sec: float) -> str:
    sec = int(round(sec))
    return f"{sec // 60}:{sec % 60:02d}"


def _short(text: str, n: int = 60) -> str:
    return text if len(text) <= n else text[:n].rsplit(" ", 1)[0] + "…"

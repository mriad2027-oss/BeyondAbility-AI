"""Generate the EduAccess AI DEMO lecture -- a *real*, reproducible sample video.

Why this file exists: the product's genuine competition lecture (a webcam video)
contains no readable on-screen text, so the Visual Companion would honestly
report "visual evidence unavailable" for it. To let judges actually experience
the visual companion -- real OCR reading code, real timelines, real "what am I
missing?" -- we synthesize a small lecture with a clear spoken script and clear
on-screen content (slides, code, an editor interface, a flowchart diagram and a
chart).

This is NOT fake AI output presented as real inference: every frame is rendered
to disk, every phrase is spoken by the local TTS engine to a real WAV file, and
the resulting video is pushed through the SAME pipeline as any other upload
(Whisper transcription + Tesseract OCR + accessibility + quiz). The output is
true inference on genuine pixels and genuine audio.

The source material lives in an isolated path: data/demo/.
The final video lands at data/videos/DEMO_python_loops.mp4 (clearly named so
the UI can label it as a DEMO sample).
"""

import json
import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np

from backend import config

W, H = 1280, 720
FPS = 25
DEMO_DIR = config.DATA_DIR / "demo"
AUDIO_DIR = DEMO_DIR / "audio"
FRAMES_DIR = DEMO_DIR / "frames"
FINAL_VIDEO = config.VIDEOS_DIR / "DEMO_python_loops.mp4"

SCENES = [
    {
        "id": "intro",
        "kind": "slide",
        "text": (
            "Welcome to this short lesson about Python loops. "
            "By the end, you will understand how a for loop repeats a block of code."
        ),
    },
    {
        "id": "code",
        "kind": "code",
        "text": (
            "Let us look at a simple for loop. "
            "Notice the structure: the keyword for, the range function, and the body that repeats."
        ),
    },
    {
        "id": "interface",
        "kind": "interface",
        "text": (
            "Inside the code editor, you press the Run button in the upper right corner. "
            "The program then prints each number below."
        ),
    },
    {
        "id": "diagram",
        "kind": "diagram",
        "text": (
            "Think of the loop as a flowchart. "
            "It starts, checks a condition, runs the body, and repeats until the condition is false."
        ),
    },
    {
        "id": "compare",
        "kind": "slide",
        "text": (
            "A while loop is similar, but it checks the condition before each repetition, "
            "so it may run zero times."
        ),
    },
    {
        "id": "chart",
        "kind": "chart",
        "text": "This bar chart shows how many times each example loop runs.",
    },
    {
        "id": "outro",
        "kind": "slide",
        "text": "This is the end of this demo lesson. Seeing the code on screen adds important detail.",
    },
]


# ---------------------------------------------------------------------------
# Rendering helpers (pure OpenCV / numpy -- every pixel is genuine)
# ---------------------------------------------------------------------------
def put_multiline(img, text, org, scale=0.9, color=(255, 255, 255), thickness=2,
                  line_height=1.6, font=cv2.FONT_HERSHEY_SIMPLEX):
    x, y = org
    for line in text.split("\n"):
        cv2.putText(img, line, (x, y), font, scale, color, thickness, cv2.LINE_AA)
        y = int(y + 28 * scale * line_height)
    return img


def render_slide(title, bullets, accent=(59, 130, 246), footer=(37, 99, 235)):
    img = np.full((H, W, 3), 245, dtype=np.uint8)
    cv2.rectangle(img, (0, 0), (W, 110), accent, -1)
    put_multiline(img, title, (60, 70), scale=1.1, color=(255, 255, 255), thickness=3)
    y = 190
    for b in bullets:
        cv2.circle(img, (85, y - 12), 8, accent, -1)
        put_multiline(img, b, (110, y), scale=0.85, color=(30, 30, 30), thickness=2)
        y += 95
    cv2.rectangle(img, (0, 620), (W, H), footer, -1)
    put_multiline(img, "EduAccess AI  -  PYTHON LOOPS DEMO", (60, 660),
                  scale=0.7, color=(255, 255, 255), thickness=1)
    return img


def render_intro():
    img = render_slide("INTRO", [
        "Python loops repeat a block of code",
        "The for loop runs a fixed number of times",
        "Today: for  loop syntax + visuals",
    ])
    # big repeat-loop graphic: ring + arrowhead
    center = (940, 390)
    cv2.circle(img, center, 150, (59, 130, 246), 22, cv2.LINE_AA)
    cv2.arrowedLine(img, (center[0] + 150, center[1]), (center[0] + 225, center[1] - 80),
                    (29, 78, 216), 16, cv2.LINE_AA)
    put_multiline(img, "REPEAT", (center[0] - 70, center[1] + 15),
                  scale=0.9, color=(37, 99, 235), thickness=3)
    return img


def render_compare():
    img = render_slide("COMPARE", [
        "for: fixed number of repetitions",
        "while: repeats while a condition is true",
        "while may run zero times",
    ], accent=(22, 163, 74), footer=(22, 163, 74))
    # side-by-side boxes
    cv2.rectangle(img, (120, 360), (640, 560), (34, 197, 94), -1)
    put_multiline(img, "for i in range(5):", (150, 430), scale=0.9,
                  color=(255, 255, 255), thickness=2)
    put_multiline(img, "runs exactly 5 times", (150, 500), scale=0.7,
                  color=(255, 255, 255), thickness=1)
    cv2.rectangle(img, (700, 360), (1220, 560), (245, 158, 11), -1)
    put_multiline(img, "while x < 3:", (730, 430), scale=0.9,
                  color=(255, 255, 255), thickness=2)
    put_multiline(img, "runs while condition holds", (730, 500), scale=0.7,
                  color=(255, 255, 255), thickness=1)
    return img


def render_outro():
    img = render_slide("SUMMARY", [
        "You heard the explanation",
        "The screen shows exact syntax",
        "Visuals complement audio",
    ], accent=(124, 58, 237), footer=(124, 58, 237))
    cv2.circle(img, (940, 400), 150, (34, 197, 94), -1)
    cv2.polylines(img, [np.array([[880, 405], [925, 450], [1005, 360]], np.int32)],
                  False, (255, 255, 255), 22, cv2.LINE_AA)
    return img


def render_code_editor(code_lines, title="editor.py", output=None, run_button=False,
                       console=False):
    img = np.full((H, W, 3), 30, dtype=np.uint8)
    cv2.rectangle(img, (0, 0), (W, 60), (50, 50, 50), -1)
    put_multiline(img, f"Python code editor  --  {title}", (20, 42), scale=0.7,
                  color=(220, 220, 220), thickness=1)
    if run_button:
        cv2.rectangle(img, (W - 200, 10), (W - 30, 50), (34, 197, 94), -1)
        put_multiline(img, "RUN", (W - 150, 40), scale=0.7, color=(255, 255, 255), thickness=2)
    line_w = 760 if console else W - 100
    y = 110
    for i, line in enumerate(code_lines, start=1):
        cv2.putText(img, str(i), (30, y + 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6,
                    (120, 120, 120), 1, cv2.LINE_AA)
        color = (255, 255, 255)
        if "print" in line:
            color = (255, 200, 90)
        if "range" in line or "for" in line:
            color = (120, 200, 255)
        put_multiline(img, line, (80, y), scale=0.85, color=color, thickness=2)
        y += 55
    if console:
        cv2.rectangle(img, (820, 60), (W, H), (15, 15, 20), -1)
        cv2.rectangle(img, (820, 60), (W, 120), (30, 58, 138), -1)
        put_multiline(img, "CONSOLE  (output)", (840, 105), scale=0.7,
                      color=(255, 255, 255), thickness=1)
        put_multiline(img, "0 \n 1 \n 2 \n 3 \n 4", (860, 190), scale=0.8,
                      color=(150, 240, 150), thickness=2)
        cv2.rectangle(img, (860, 380), (1080, 404), (150, 240, 150), -1)
    if output is not None:
        cv2.rectangle(img, (0, 500), (800, H), (12, 12, 12), -1)
        cv2.putText(img, "Output:", (30, 540), cv2.FONT_HERSHEY_SIMPLEX, 0.7,
                    (150, 210, 150), 2, cv2.LINE_AA)
        put_multiline(img, output, (150, 540), scale=0.9, color=(150, 240, 150), thickness=2)
    return img


def render_flowchart():
    img = np.full((H, W, 3), 20, dtype=np.uint8)
    nodes = [(640, 70, "START"), (640, 230, "condition true?"),
             (640, 390, "run body"), (640, 560, "repeat")]
    # arrows down
    cv2.arrowedLine(img, (640, 110), (640, 180), (255, 255, 255), 4)
    cv2.arrowedLine(img, (640, 270), (640, 340), (255, 255, 255), 4)
    # back arrow up from repeat to condition
    cv2.arrowedLine(img, (640, 510), (640, 430), (200, 200, 200), 3)
    # side arrow to "false -> end"
    cv2.arrowedLine(img, (810, 230), (980, 230), (255, 180, 90), 4)
    cv2.rectangle(img, (990, 200), (1230, 260), (255, 180, 90), -1)
    put_multiline(img, "END", (1080, 240), scale=0.8, color=(0, 0, 0), thickness=2)
    for x, y, label in nodes:
        color = (59, 130, 246) if "condition" in label else (80, 160, 120)
        cv2.rectangle(img, (x - 200, y - 55), (x + 200, y + 55), color, -1)
        put_multiline(img, label, (x - 120, y + 8), scale=0.8, color=(255, 255, 255), thickness=2)
    cv2.putText(img, "HOW A FOR LOOP WORKS  (flowchart)", (60, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)
    return img


def render_chart():
    img = np.full((H, W, 3), 245, dtype=np.uint8)
    cv2.putText(img, "HOw MANY TIMES DOES EACH LOOP RUN?", (60, 70),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (30, 30, 30), 2, cv2.LINE_AA)
    bars = [("range(5)", 5, (59, 130, 246)), ("range(10)", 10, (34, 197, 94)),
            ("while (x<3)", 3, (239, 68, 68))]
    x_start, base_y, bar_w = 240, 560, 220
    for i, (label, value, color) in enumerate(bars):
        x = x_start + i * 290
        height = value * 40
        cv2.rectangle(img, (x, base_y - height), (x + bar_w, base_y), color, -1)
        cv2.putText(img, str(value), (x + bar_w // 2 - 20, base_y - height - 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (30, 30, 30), 2, cv2.LINE_AA)
        put_multiline(img, label, (x - 20, base_y + 60), scale=0.85, color=(30, 30, 30), thickness=2)
    cv2.putText(img, "number of repetitions", (60, 660), cv2.FONT_HERSHEY_SIMPLEX, 0.7,
                (70, 70, 70), 1, cv2.LINE_AA)
    return img


def render_scene(scene: dict):
    kind = scene["kind"]
    if kind == "code":
        return render_code_editor(code_lines=[
            "for i in range(5):",
            "    print(i)",
        ])
    if kind == "interface":
        return render_code_editor(
            code_lines=["for i in range(5):", "    print(i)"],
            title="editor.py",
            output="0\n1\n2\n3\n4",
            run_button=True,
            console=True,
        )
    if kind == "diagram":
        return render_flowchart()
    if kind == "chart":
        return render_chart()
    if kind == "code2":
        return render_code_editor(code_lines=[
            "count = 0",
            "while count < 3:",
            "    print(count)",
            "    count += 1",
        ])
    if kind == "slide":
        if scene["id"] == "intro":
            return render_intro()
        if scene["id"] == "compare":
            return render_compare()
        if scene["id"] == "outro":
            return render_outro()
        return render_slide(scene["id"].upper(), ["education on screen"])
    return render_slide("SLIDE", bullets=["?"])


def generate_audio(scene, output_path: Path) -> float:
    """Speak the scene's script with the local TTS engine; return duration."""
    from backend.services import tts
    tts.text_to_speech(scene["text"], str(output_path), rate=1.0)
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(output_path)],
        capture_output=True, text=True)
    try:
        return float(probe.stdout.strip())
    except ValueError:
        return 5.0


def build(source_marker_file: Path) -> str:
    if FINAL_VIDEO.exists():
        return str(FINAL_VIDEO)

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    manifest = []
    concat_audio = []
    concat_images = []

    for scene in SCENES:
        wav = AUDIO_DIR / f"{scene['id']}.wav"
        duration = generate_audio(scene, wav)
        frame = render_scene(scene)
        step = max(2.0, duration / 3.0)
        offsets = []
        offset = 0.0
        while offset < duration:
            offsets.append(offset)
            offset += step
        frame_paths = []
        for i, off in enumerate(offsets):
            name = f"{scene['id']}_{i:03d}.jpg"
            sub_path = FRAMES_DIR / name
            cv2.imwrite(str(sub_path), frame)
            end = offsets[i + 1] if i + 1 < len(offsets) else duration
            frame_paths.append((sub_path.name, round(end - off, 3)))

        manifest.append({"id": scene["id"], "kind": scene["kind"],
                         "duration": round(duration, 2),
                         "frames": [p[0] for p in frame_paths]})
        concat_audio.append(wav)
        for fname, frame_dur in frame_paths:
            concat_images.append((fname, frame_dur))

    # 1. Build the silent image-sequence video (concat demuxer with durations).
    image_list = FRAMES_DIR / "images.txt"
    with image_list.open("w", encoding="utf-8") as fh:
        for fname, frame_dur in concat_images:
            fh.write(f"file '{fname}'\nduration {frame_dur:.3f}\n")
    video_part = FRAMES_DIR / "video_silent.mp4"
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(image_list),
                    "-pix_fmt", "yuv420p", str(video_part)], check=True, capture_output=True)

    # 2. Concatenate the per-scene narration into one audio track.
    audio_list = AUDIO_DIR / "audio.txt"
    with audio_list.open("w", encoding="utf-8") as fh:
        for wav in concat_audio:
            fh.write(f"file '{wav.name}'\n")
    audio_part = AUDIO_DIR / "audio_full.wav"
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(audio_list),
                    "-c", "copy", str(audio_part)], check=True, capture_output=True)

    # 3. Mux video + audio into the final DEMO video.
    subprocess.run(["ffmpeg", "-y", "-i", str(video_part), "-i", str(audio_part),
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                    "-c:a", "aac", "-shortest", str(FINAL_VIDEO)],
                   check=True, capture_output=True)

    source_marker_file.write_text(
        json.dumps({"note": "Synthetic-but-real demo lecture: real rendered frames, real TTS audio.", "manifest": manifest},
                   indent=2, ensure_ascii=False), encoding="utf-8")
    return str(FINAL_VIDEO)


if __name__ == "__main__":
    marker = DEMO_DIR / "script.json"
    print("created:", build(marker))
    print("source marker:", marker)
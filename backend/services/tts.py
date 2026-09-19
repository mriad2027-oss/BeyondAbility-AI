"""
Text-to-speech service.

Default: pyttsx3 -- 100% offline, no API key, works out of the box (uses
espeak on Linux, SAPI5 on Windows, NSSpeechSynthesizer on macOS).

Optional: set TTS_PROVIDER=openai + OPENAI_API_KEY in .env for much more
natural-sounding voices.
"""

import shutil
import subprocess
from pathlib import Path

from backend import config


import re

def normalize_for_speech(text: str, language: str = "en") -> str:
    """Normalize code and math operators to natural spoken representation."""
    if not text:
        return text
    
    if language == "ar":
        text = re.sub(r'>=', ' أكبر من أو يساوي ', text)
        text = re.sub(r'<=', ' أصغر من أو يساوي ', text)
        text = re.sub(r'==', ' يساوي ', text)
        text = re.sub(r'!=', ' لا يساوي ', text)
        text = re.sub(r'=', ' يساوي ', text)
        text = re.sub(r'\+', ' زائد ', text)
        text = re.sub(r'-', ' ناقص ', text)
        text = re.sub(r'\*', ' ضرب ', text)
        text = re.sub(r'/', ' مقسوماً على ', text)
    else:
        text = re.sub(r'>=', ' is greater than or equal to ', text)
        text = re.sub(r'<=', ' is less than or equal to ', text)
        text = re.sub(r'==', ' equals ', text)
        text = re.sub(r'!=', ' is not equal to ', text)
        text = re.sub(r'=', ' equals ', text)
        text = re.sub(r'\+', ' plus ', text)
        text = re.sub(r'-', ' minus ', text)
        text = re.sub(r'\*', ' times ', text)
        text = re.sub(r'/', ' divided by ', text)
        
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _speak_with_espeak_cli(text: str, output_path: str, rate: float = 1.0, voice_id: str | None = None) -> str:
    binary = shutil.which("espeak-ng") or shutil.which("espeak")
    if not binary:
        raise RuntimeError("espeak-ng/espeak not found on PATH")

    speed = int(175 * rate)
    cmd = [binary, "-w", output_path, "-s", str(speed)]
    
    is_arabic = any('\u0600' <= c <= '\u06FF' for c in text)
    if voice_id:
        cmd.extend(["-v", voice_id])
    elif is_arabic:
        cmd.extend(["-v", "ar"])
    else:
        cmd.extend(["-v", "en"])
        
    cmd.append(text)

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"{binary} failed: {result.stderr}")
    return output_path


def _speak_with_pyttsx3(text: str, output_path: str, rate: float = 1.0, voice_id: str | None = None) -> str:
    import pyttsx3

    engine = pyttsx3.init()
    try:
        default_rate = engine.getProperty('rate') or 200
        engine.setProperty('rate', int(default_rate * rate))
    except Exception:
        pass

    if voice_id:
        try:
            engine.setProperty('voice', voice_id)
        except Exception:
            pass
    else:
        try:
            voices = engine.getProperty('voices')
            is_arabic = any('\u0600' <= c <= '\u06FF' for c in text)
            for v in voices:
                v_lang = str(v.languages).lower() if hasattr(v, 'languages') else ""
                v_name = str(v.name).lower()
                if is_arabic and ('ar' in v_lang or 'arabic' in v_name):
                    engine.setProperty('voice', v.id)
                    break
                elif not is_arabic and ('en' in v_lang or 'english' in v_name):
                    engine.setProperty('voice', v.id)
                    # continue searching
        except Exception:
            pass

    engine.save_to_file(text, output_path)
    engine.runAndWait()
    engine.stop()
    del engine
    return output_path


def _speak_with_openai(text: str, output_path: str, rate: float = 1.0, voice: str = "alloy") -> str:
    from openai import OpenAI

    client = OpenAI(api_key=config.OPENAI_API_KEY)
    speed = max(0.25, min(4.0, rate))
    
    with client.audio.speech.with_streaming_response.create(
        model="tts-1",
        voice=voice,
        input=text,
        speed=speed,
    ) as response:
        response.stream_to_file(output_path)
    return output_path


def text_to_speech(text: str, output_path: str, rate: float = 1.0, voice: str | None = None) -> str:
    output_path = str(Path(output_path))
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    is_arabic = any('\u0600' <= c <= '\u06FF' for c in text)
    normalized = normalize_for_speech(text, "ar" if is_arabic else "en")

    provider = config.TTS_PROVIDER
    if provider == "openai" and config.OPENAI_API_KEY:
        try:
            return _speak_with_openai(normalized, output_path, rate=rate, voice=voice or "alloy")
        except Exception:
            pass  # fall through to offline engine

    if shutil.which("espeak-ng") or shutil.which("espeak"):
        try:
            return _speak_with_espeak_cli(normalized, output_path, rate=rate, voice_id=voice)
        except Exception:
            pass

    return _speak_with_pyttsx3(normalized, output_path, rate=rate, voice_id=voice)


def mix_narration_audio(events: list[dict], video_duration: float, output_path: str, rate: float = 1.0) -> str:
    """
    Generate individual narration segment audio files and mix them into a single timeline WAV file.
    Uses ffmpeg with adelay and amix.
    """
    output_path = str(Path(output_path))
    output_dir = Path(output_path).parent
    
    narration_events = [e for e in events if e.get("should_describe") and e.get("description")]
    if not narration_events:
        # If no events to describe, generate a silent track of total duration
        cmd_silent = [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", "anullsrc=r=16000:cl=mono",
            "-t", str(max(1.0, video_duration)),
            output_path
        ]
        subprocess.run(cmd_silent, capture_output=True)
        return output_path

    job_id = Path(output_path).name.split("_")[0]
    
    # 1. Create a silent base track
    silent_path = output_dir / f"{job_id}_silent_base.wav"
    cmd_silent = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", "anullsrc=r=16000:cl=mono",
        "-t", str(video_duration),
        str(silent_path)
    ]
    subprocess.run(cmd_silent, capture_output=True)

    inputs = [str(silent_path)]
    filter_parts = []
    mix_inputs = ["[0:a]"]

    # 2. Generate individual WAV files and compute delays
    for i, ev in enumerate(narration_events):
        segment_id = ev.get("segment_id", f"seg_{i+1:03d}")
        seg_audio_path = output_dir / f"{job_id}_narration_{segment_id}.wav"
        
        # Speak segment
        text_to_speech(ev["description"], str(seg_audio_path), rate=rate)
        
        inputs.append(str(seg_audio_path))
        delay_ms = int(max(0.0, float(ev.get("play_start", 0.0))) * 1000)
        
        # Use adelay (both channels for standard mono/stereo compatibility)
        filter_parts.append(f"[{i+1}:a]adelay={delay_ms}|{delay_ms}[a{i+1}]")
        mix_inputs.append(f"[a{i+1}]")
        
        # Cache segment audio path in event
        ev["narration_audio_path"] = str(seg_audio_path)

    # 3. Build filter complex to mix them
    filter_complex = ";".join(filter_parts)
    if filter_parts:
        filter_complex += ";"
    filter_complex += f"{''.join(mix_inputs)}amix=inputs={len(mix_inputs)}:duration=longest:dropout_transition=0[out]"

    cmd_mix = ["ffmpeg", "-y"]
    for inp in inputs:
        cmd_mix.extend(["-i", inp])
    cmd_mix.extend([
        "-filter_complex", filter_complex,
        "-map", "[out]",
        output_path
    ])

    res = subprocess.run(cmd_mix, capture_output=True, text=True)
    
    # Cleanup silent base
    if silent_path.exists():
        try:
            silent_path.unlink()
        except OSError:
            pass

    if res.returncode != 0:
        # Robust fallback: generate full text narration as a single continuous track
        full_text = "  ".join(e["description"] for e in narration_events)
        text_to_speech(full_text, output_path, rate=rate)

    return output_path

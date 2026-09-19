"""
Vision service: turns a video frame (screenshot of slide/code/whiteboard)
into a text description of the educationally-important content.

Three backends, chosen automatically based on what API keys you have set
(or force one with VISION_PROVIDER in .env):

  - "openai"    : GPT-4o-mini vision call (needs OPENAI_API_KEY)
  - "anthropic" : Claude vision call (needs ANTHROPIC_API_KEY)
  - "ocr"       : 100% offline fallback using Tesseract OCR. Reads any text
                  visible on screen (great for slides/code) and reports
                  "no significant on-screen text" for pure webcam frames.
"""

import base64
import json
from pathlib import Path

from backend import config

_OCR_INITIALISED = False


def _init_ocr() -> None:
    """Point pytesseract at a discovered tesseract binary (once)."""
    global _OCR_INITIALISED
    if _OCR_INITIALISED:
        return
    import pytesseract
    binary = config.find_tesseract()
    if binary and Path(binary).exists():
        pytesseract.pytesseract.tesseract_cmd = binary
    _OCR_INITIALISED = True

VISION_PROMPT = (
    "You are an intelligent visual companion for a blind or visually impaired student.\n"
    "The student can already hear the original video audio.\n"
    "Analyze the provided visual content and transcript context.\n"
    "Your task is NOT to repeat what the speaker says.\n"
    "Identify important visual information that is not available through audio.\n"
    "Analyze:\n"
    "- people, positions, actions, objects, spatial relationships\n"
    "- text, code, diagrams, charts, tables, interfaces, slides, demonstrations, scene changes\n\n"
    "For educational content, explain the visual information necessary to understand what the teacher is showing.\n"
    "Describe meaningful visual events, not individual frames.\n"
    "Never invent information.\n"
    "If text is unreadable, say so.\n"
    "If an interpretation is uncertain, explicitly state uncertainty.\n"
    "Output natural Arabic suitable for text-to-speech.\n"
    "Keep the description concise but sufficiently informative (2-4 sentences).\n"
    "The final description should answer: 'What would a blind student want to know if they could see this part of the video?'\n\n"
    "You MUST respond ONLY with a raw JSON object containing the following keys (no markdown formatting, no explanation outside the JSON):\n"
    "{\n"
    '  "type": "slide" | "code" | "diagram" | "chart" | "table" | "whiteboard" | "interface" | "person" | "demonstration" | "scene" | "other",\n'
    '  "description": "your description in Arabic",\n'
    '  "confidence": float (between 0.0 and 1.0)\n'
    "}"
)


def _pick_provider() -> str:
    if config.VISION_PROVIDER != "auto":
        return config.VISION_PROVIDER
    if config.OPENAI_API_KEY:
        return "openai"
    if config.ANTHROPIC_API_KEY:
        return "anthropic"
    return "ocr"


def clean_json_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    return json.loads(text)


def classify_ocr_text(text: str) -> str:
    text_lower = text.lower()
    if not text.strip() or "no readable on-screen text" in text_lower:
        return "scene"
    
    # 1. Flowchart / Diagram
    if "flowchart" in text_lower or (
        ("start" in text_lower and "end" in text_lower)
        and any(w in text_lower for w in ("true", "false", "condition", "decision", "yes", "no", "repeat"))
    ):
        return "flowchart"
    if "diagram" in text_lower or ("start" in text_lower and "end" in text_lower):
        return "diagram"

    # 2. Chart / Graph
    if any(w in text_lower for w in ("chart", "graph", "histogram", "bar chart", "plot", "repetitions")):
        return "chart"
    if "how many" in text_lower and any(c.isdigit() for c in text_lower):
        return "chart"

    # 3. Code & Code Editor
    code_keywords = [
        "def ", "class ", "import ", "print(", "print (", "for ", "while ",
        "return ", "public static void", "std::", "#include", "range(",
        "if ", "elif ", "else:", "try:", "catch", "lambda ", "console.log",
        "=>", "let ", "const ", "var ", "count =", "int ", "float "
    ]
    code_hits = [kw for kw in code_keywords if kw in text_lower]
    if len(code_hits) >= 2 or any(kw in text_lower for kw in ("print(", "print (", "def ", "for i in", "while ")):
        return "code"

    # 4. Table
    if "table" in text_lower or ("column" in text_lower and "row" in text_lower) or ("|" in text and "-" in text):
        return "table"

    # 5. UI / Interactive Demo
    if any(w in text_lower for w in ("editor.py", "console", "run button", "terminal", "output:", "interface", "click run")):
        return "ui"

    # 6. Formula / Math
    if any(sym in text for sym in ("\\sum", "\\int", "f(x)", "E=mc^2", "dx/dt", "√", "≈", "≠", "≤", "≥")):
        return "formula"

    # Default to slide if readable text is present
    return "slide"


def detect_code_language(text: str) -> str:
    """Heuristic, keyword-based language hint for recognised code blocks."""
    lowered = text.lower()
    if any(kw in lowered for kw in ("def ", "print(", "import ", "range(", "elif ", "lambda ", "self.", "count =")):
        return "python"
    if any(kw in lowered for kw in ("public static void", "system.out", "import java", "class .*\\{", "int main(")):
        return "java"
    if any(kw in lowered for kw in ("#include", "std::", "int main(", "printf(")):
        return "c/c++"
    if any(kw in lowered for kw in ("function ", "const ", "let ", "=>", "console.log", "document.")):
        return "javascript"
    if any(kw in lowered for kw in ("select ", "from ", "where ", "insert into", "create table")):
        return "sql"
    return "unknown"


def organize_ocr_text(text: str) -> dict:
    """Turn raw OCR text into an honest educational structure (Feature #6).

    Only information the OCR could actually read is reported -- nothing is
    invented, extra-polished, or inferred beyond the visible characters.
    """
    lines = [line.strip() for line in (text or "").splitlines() if line.strip()]
    if not lines:
        return {"unreadable": True}
    kind = classify_ocr_text(text)
    if kind == "code":
        return {
            "content_kind": "code",
            "visual_type": "code",
            "language": detect_code_language(text),
            "visible_code": lines[:12],
            "line_count": len(lines),
            "code_snippet": "\n".join(lines[:8]),
        }
    if kind == "slide":
        title = lines[0]
        points = lines[1:]
        return {
            "content_kind": "slide",
            "visual_type": "slide",
            "title": title,
            "visible_points": points[:10],
            "point_count": len(points),
        }
    if kind in ("diagram", "flowchart"):
        return {
            "content_kind": kind,
            "visual_type": kind,
            "title": lines[0] if lines else "",
            "visible_nodes": lines[:8],
        }
    if kind == "chart":
        return {
            "content_kind": "chart",
            "visual_type": "chart",
            "title": lines[0] if lines else "",
            "visible_labels": lines[1:8],
        }
    if kind == "table":
        return {
            "content_kind": "table",
            "visual_type": "table",
            "visible_rows": lines[:8],
        }
    if kind == "ui":
        return {
            "content_kind": "ui",
            "visual_type": "ui",
            "visible_controls": lines[:8],
        }
    return {
        "content_kind": "text",
        "visual_type": kind,
        "text_snippet": " ".join(lines)[:240],
    }


def _describe_with_ocr(image_path: str) -> dict:
    import pytesseract
    from PIL import Image

    _init_ocr()
    try:
        text = pytesseract.image_to_string(Image.open(image_path)).strip()
        if not text:
            desc = "OCR-only output: No readable on-screen text was detected in this frame."
            vtype = "scene"
            cleaned = ""
        else:
            cleaned = "\n".join(line for line in text.splitlines() if line.strip())
            desc = f"OCR-only output: On-screen text detected:\n{cleaned}"
            vtype = classify_ocr_text(cleaned)
        
        result = {
            "description": desc,
            "type": vtype,
            "confidence": 0.7 if cleaned else 0.0,
            "ocr_text": cleaned,
            "unreadable": not bool(cleaned),
            "educational": organize_ocr_text(cleaned),
        }
        return result
    except Exception as e:
        raise RuntimeError(f"Tesseract OCR failed: {e}")


def _describe_with_openai(image_path: str, transcript_context: str = "") -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=config.OPENAI_API_KEY)
    model = config.VISION_MODEL or config.DEFAULT_OPENAI_VISION_MODEL

    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    user_text = VISION_PROMPT
    if transcript_context:
        user_text += f"\n\nTranscript context during this event:\n\"{transcript_context}\""

    response = client.chat.completions.create(
        model=model,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": user_text},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            ],
        }],
        max_tokens=400,
    )
    raw_response = response.choices[0].message.content.strip()
    
    try:
        data = clean_json_response(raw_response)
        return {
            "description": data.get("description", raw_response).strip(),
            "type": data.get("type", "other").strip(),
            "confidence": float(data.get("confidence", 0.9))
        }
    except Exception:
        return {
            "description": raw_response,
            "type": "other",
            "confidence": 0.8
        }


def _describe_with_anthropic(image_path: str, transcript_context: str = "") -> dict:
    import anthropic

    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    model = config.VISION_MODEL or config.DEFAULT_ANTHROPIC_MODEL

    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    user_text = VISION_PROMPT
    if transcript_context:
        user_text += f"\n\nTranscript context during this event:\n\"{transcript_context}\""

    message = client.messages.create(
        model=model,
        max_tokens=400,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
                {"type": "text", "text": user_text},
            ],
        }],
    )
    raw_response = "".join(block.text for block in message.content if block.type == "text").strip()
    
    try:
        data = clean_json_response(raw_response)
        return {
            "description": data.get("description", raw_response).strip(),
            "type": data.get("type", "other").strip(),
            "confidence": float(data.get("confidence", 0.9))
        }
    except Exception:
        return {
            "description": raw_response,
            "type": "other",
            "confidence": 0.8
        }


def describe_frame(image_path: str, transcript_context: str = "") -> dict:
    """Describe a single frame using the resolved provider, with OCR as a safety net."""
    image_path = str(Path(image_path))
    provider = _pick_provider()

    try:
        if provider == "openai":
            return _describe_with_openai(image_path, transcript_context)
        if provider == "anthropic":
            return _describe_with_anthropic(image_path, transcript_context)
        return _describe_with_ocr(image_path)
    except Exception as e:
        try:
            return _describe_with_ocr(image_path)
        except Exception as ocr_err:
            return {
                "description": f"Unavailable visual analysis: (Visual description unavailable for this frame: {e}. OCR fallback also failed: {ocr_err})",
                "type": "other",
                "confidence": 0.0
            }


def describe_frames(frames: list[dict]) -> list[dict]:
    """Describe a list of {"path":..., "timestamp":...} frame dicts in place."""
    described = []
    for frame in frames:
        res = describe_frame(frame["path"])
        described.append({
            **frame,
            "description": res["description"],
            "type": res.get("type", "other"),
            "confidence": res.get("confidence", 0.8)
        })
    return described

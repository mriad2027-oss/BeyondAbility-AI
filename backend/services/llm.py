"""
LLM service: combines transcript + visual descriptions into a clean
accessibility narration, and generates adaptive feedback from quiz results.

Falls back to a deterministic, template-based generator (no API key needed)
so the pipeline always produces *something* usable. Set OPENAI_API_KEY or
ANTHROPIC_API_KEY (and LLM_PROVIDER) in .env for much higher-quality output.
"""

from backend import config

ACCESSIBILITY_SYSTEM_PROMPT = (
    "You are an advanced multimodal AI assistant specialized in Video Understanding "
    "and Audio Description for blind and visually impaired users.\n"
    "Your task is NOT to simply describe individual video frames. You must "
    "understand the entire video as a continuous scene, combine visual information "
    "with the spoken audio, and generate meaningful descriptions that help a blind "
    "user understand what is visually happening.\n\n"
    "Follow these core principles:\n"
    "1. Understand the spoken content first: Identify what the speaker is talking "
    "about and important information already communicated through speech. Do NOT repeat "
    "information that the user can already hear unless it is necessary to connect the "
    "audio with the visual scene.\n"
    "2. Understand the visual content: Analyze visual details (people, postures, gestures, "
    "objects, on-screen text, code, diagrams, slides, etc.) and understand multiple "
    "consecutive frames together as one continuous visual event.\n"
    "3. Connect audio + vision: Compare what is being said with what is visually "
    "happening. Complement the audio, do not duplicate it. For example, explain the "
    "visual information a blind user cannot obtain from the audio alone (such as "
    "highlighted code, buttons, or specific parts of a diagram being discussed).\n"
    "4. Describe visual information that matters: Prioritize details helping the user "
    "build a mental picture (people, objects, settings, interfaces, screens).\n"
    "5. Avoid unnecessary descriptions: Do NOT describe minor background elements, "
    "repetitive visual info, or elements already fully explained by the speaker.\n"
    "6. Temporal understanding: Track changes over time. Use the provided narration history "
    "to ensure narrative continuity and log progression logically.\n"
    "7. Explain rather than merely identify: Explain what a blind person would want "
    "to know rather than just listing objects (e.g. 'a man sitting at a desk typing "
    "on a laptop with a code editor open' rather than 'a man and a laptop').\n"
    "8. Handle educational videos intelligently: Describe relevant code, diagrams, "
    "formulas, slides, interfaces, and visual changes (highlighting, clicking, scrolling, "
    "typing, drawing).\n"
    "9. Handle scenes with no speech: Provide richer visual descriptions when there is "
    "little or no speech.\n"
    "10. Confidence and uncertainty: Never invent visual information. Use phrases "
    "like 'It appears that...', 'The object seems to be...', 'The text is partially "
    "visible...' if something is unclear.\n"
    "11. Output style: Natural, clear, concise but informative, easy to understand when "
    "heard through text-to-speech, and chronologically ordered.\n"
    "12. Final principle: Audio tells the user what is being said. Your job is to "
    "tell the user what they cannot see. Always ask yourself: 'What important visual "
    "information is missing from the audio?' Then describe that information accurately "
    "and naturally."
)

FEEDBACK_SYSTEM_PROMPT = (
    "You are a supportive tutor. Given a lesson topic and a student's quiz "
    "results (which questions were correct/wrong, with the question text), "
    "identify the concepts the student is struggling with and give a short, "
    "encouraging, actionable learning recommendation (2-4 sentences)."
)


def _pick_provider() -> str:
    if config.LLM_PROVIDER != "auto":
        return config.LLM_PROVIDER
    if config.OPENAI_API_KEY:
        return "openai"
    if config.ANTHROPIC_API_KEY:
        return "anthropic"
    return "template"


def _call_openai(system_prompt: str, user_prompt: str) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=config.OPENAI_API_KEY)
    model = config.LLM_MODEL or config.DEFAULT_OPENAI_TEXT_MODEL
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=400,
    )
    return response.choices[0].message.content.strip()


def _call_anthropic(system_prompt: str, user_prompt: str) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    model = config.LLM_MODEL or config.DEFAULT_ANTHROPIC_MODEL
    message = client.messages.create(
        model=model,
        max_tokens=400,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return "".join(block.text for block in message.content if block.type == "text").strip()


def _call_llm(system_prompt: str, user_prompt: str, fallback: str) -> str:
    provider = _pick_provider()
    try:
        if provider == "openai":
            return _call_openai(system_prompt, user_prompt)
        if provider == "anthropic":
            return _call_anthropic(system_prompt, user_prompt)
        return fallback
    except Exception:
        return fallback


def call_llm(system_prompt: str, user_prompt: str, fallback: str) -> str:
    """Public wrapper to query the configured LLM provider."""
    return _call_llm(system_prompt, user_prompt, fallback)


def generate_accessibility_description(transcript_text: str, visual_text: str, history: list[dict] = None, prev_visual_text: str = None) -> str:
    """Combine a transcript segment + visual description into one narration, with context of history."""
    if history is None:
        history = []

    history_text = ""
    if history:
        history_text = "Recently generated narration history:\n"
        for item in history:
            history_text += (
                f"- Spoken: \"{item.get('transcript', '')}\"\n"
                f"  Narration description: \"{item.get('description', '')}\"\n"
            )
        history_text += "\n"

    user_prompt = (
        f"{history_text}"
        f"Current teacher transcript:\n{transcript_text}\n\n"
        f"Current visual information:\n{visual_text}\n\n"
    )
    if prev_visual_text and visual_text == prev_visual_text:
        user_prompt += "Note: The visual content is identical to the previous segment. Do not repeat the same visual details. Focus only on the spoken transcript.\n\n"

    user_prompt += "Create a clear explanation for a visually impaired student."
    fallback = _template_accessibility_description(transcript_text, visual_text, prev_visual_text)
    return _call_llm(ACCESSIBILITY_SYSTEM_PROMPT, user_prompt, fallback)


def generate_personalized_description(event: dict, transcript_text: str, mode: str, previous_desc: str = "", next_desc: str = "") -> str:
    """
    Generate a personalized description of a visual event that complements speech,
    tailored to the student's accessibility mode.
    """
    from backend.services.accessibility import normalize_mode
    mode = normalize_mode(mode)
    
    system_prompt = (
        "You are an expert educational accessibility assistant. Your goal is to generate a personalized "
        "description for a visual event that complements what the teacher is saying, tailored to the student's accessibility needs.\n\n"
        "Accessibility Needs:\n"
        "- 'blind': Focus on spatial relationships, visual actions, detailed code, diagrams, charts, tables, text on screen, and interface controls. Describe what they miss.\n"
        "- 'low_vision': Focus on layout, structure, text on screen, visual highlights, contrast-relevant details, and zoom-worthy regions.\n"
        "- 'cognitive_support': Use simple vocabulary, shorter sentences, clear structure, and put important concepts first while reducing unnecessary detail.\n"
        "- 'deaf' / 'hard_of_hearing': Focus on visual demonstrations, actions, and sound-independent context that adds value to captions.\n\n"
        "Rules:\n"
        "1. DO NOT repeat the transcript (what the teacher says) unnecessarily. Only complement it.\n"
        "2. Be concise: 1 to 3 sentences maximum.\n"
        "3. Language: Match the language of the transcript/description (English or Arabic).\n"
        "4. Provenance & Hallucination Protection: Never invent information. If confidence is low or info is unclear, use expressions like 'It appears that...', 'The visual information is unclear...', or 'The text is partially visible...'.\n"
        "5. Return only the description text, with no extra framing or markdown backticks."
    )
    
    event_desc = event.get("description", "")
    event_type = event.get("type", "other")
    confidence = event.get("confidence", 1.0)
    
    user_prompt = (
        f"Accessibility Mode: {mode}\n"
        f"Visual Event Type: {event_type}\n"
        f"Original Visual Description: {event_desc}\n"
        f"Teacher Transcript: {transcript_text}\n"
        f"Previous Description: {previous_desc}\n"
        f"Next Description: {next_desc}\n"
        f"Visual Confidence: {confidence}\n\n"
        "Generate the personalized description matching the student's accessibility mode."
    )
    
    # Fallback to the deterministic template or safe description logic
    from backend.services.accessibility import _safe_description
    fallback = _safe_description(event, mode, previous_desc)
    
    return _call_llm(system_prompt, user_prompt, fallback)


def _template_accessibility_description(transcript_text: str, visual_text: str, prev_visual_text: str = None) -> str:
    transcript_text = transcript_text.strip() or "(no speech detected in this segment)"
    visual_text = visual_text.strip() or "(no significant on-screen content)"
    if prev_visual_text and visual_text == prev_visual_text:
        return transcript_text
    return f"{transcript_text} Meanwhile, on screen: {visual_text}"


def generate_quiz_feedback(lesson_title: str, results: list[dict]) -> str:
    """
    results: [{"question": str, "correct": bool}, ...]
    """
    lines = [
        f"Question: {r['question']} -> {'Correct' if r['correct'] else 'Wrong'}"
        for r in results
    ]
    user_prompt = f"Lesson: {lesson_title}\n\nQuiz Results:\n" + "\n".join(lines)
    fallback = _template_quiz_feedback(results)
    return _call_llm(FEEDBACK_SYSTEM_PROMPT, user_prompt, fallback)


def _template_quiz_feedback(results: list[dict]) -> str:
    wrong = [r["question"] for r in results if not r["correct"]]
    total = len(results)
    correct = total - len(wrong)
    score = round((correct / total) * 100, 1) if total else 0.0

    if not wrong:
        return f"Great work! You scored {score}% and answered every question correctly."

    weak_list = "; ".join(wrong)
    return (
        f"You scored {score}% ({correct}/{total}). "
        f"You may want to review these topics: {weak_list}. "
        "Try re-watching the related part of the lesson and retake the quiz."
    )

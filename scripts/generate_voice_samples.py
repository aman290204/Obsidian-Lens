"""
generate_voice_samples.py
────────────────────────────────────────────────────────────────────────────────
Generates real speech samples for all persona x language combinations.
Uses Google TTS (gTTS) for synthesis and the bundled ffmpeg for MP3->WAV.

Each file says "Hello! I am Obsidian Lens Assistant" in the matching language.

Usage:
    python scripts/generate_voice_samples.py

Requires:
    pip install gtts
    (ffmpeg is resolved from the already-installed npm package)
"""

import os, sys, subprocess, tempfile
from gtts import gTTS

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
OUTPUT_ROOT = os.path.join(SCRIPT_DIR, '..', 'public', 'audio-samples')

# Bundled ffmpeg path (installed via @ffmpeg-installer/ffmpeg npm package)
FFMPEG_PATH = os.path.join(
    SCRIPT_DIR, '..', 'node_modules', '@ffmpeg-installer',
    'win32-x64', 'ffmpeg.exe'
)
# Fallback to system ffmpeg if the npm package path doesn't exist
if not os.path.exists(FFMPEG_PATH):
    FFMPEG_PATH = 'ffmpeg'

PERSONAS = ['ethan', 'maya', 'kenji', 'clara', 'arjun', 'priya']

# TTS text per language — "Hello! I am Obsidian Lens Assistant" natively
LANGUAGE_CONFIG = {
    'english':    ('en',  "Hello! I am Obsidian Lens Assistant. I will help you create amazing AI videos."),
    'hinglish':   ('hi',  "Namaste! Main hun Obsidian Lens Assistant. Main aapke liye kamaal ke AI videos banaunga."),
    'tanglish':   ('ta',  "Vanakkam! Naan Obsidian Lens Assistant. Ungalukku amazing AI videos pannuven."),
    'tenglish':   ('te',  "Namaskaram! Nenu Obsidian Lens Assistant. Meeru kosam amazing AI videos chestanu."),
    'manglish':   ('ml',  "Namaskaram! Ente peru Obsidian Lens Assistant. Ningalku amazing AI videos undakkum."),
    'kanglish':   ('kn',  "Namaskara! Naanu Obsidian Lens Assistant. Nimage amazing AI videos maaduttene."),
    'benglish':   ('bn',  "Namaskar! Ami Obsidian Lens Assistant. Apnar jonno amazing AI videos toiri korbo."),
    'marathlish': ('mr',  "Namaskar! Mi Obsidian Lens Assistant aahe. Tumhala amazing AI videos banaveen."),
    'gujlish':    ('gu',  "Namaskar! Hu Obsidian Lens Assistant chu. Tamara mate amazing AI videos banavis."),
    'urdu':       ('ur',  "Assalamu alaikum! Main hun Obsidian Lens Assistant. Aapke liye behtareen AI videos banaunga."),
    'odia':       ('hi',  "Namaskar! Mun Obsidian Lens Assistant. Aapanka paain amazing AI videos toiari kariba."),
}


def mp3_to_wav(mp3_path: str, wav_path: str):
    """Convert MP3 to 16-bit mono WAV using the bundled ffmpeg."""
    cmd = [
        FFMPEG_PATH,
        '-y',              # overwrite without asking
        '-i', mp3_path,
        '-ar', '22050',   # 22 kHz sample rate
        '-ac', '1',        # mono
        '-acodec', 'pcm_s16le',  # 16-bit PCM
        wav_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr[-400:]}")


def generate(persona: str, lang_key: str, lang_code: str, text: str) -> bool:
    out_dir = os.path.join(OUTPUT_ROOT, persona)
    os.makedirs(out_dir, exist_ok=True)
    wav_path = os.path.join(out_dir, f'{lang_key}.wav')

    try:
        # Step 1: Generate MP3 via gTTS to a temp file
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
            tmp_mp3 = tmp.name

        tts = gTTS(text=text, lang=lang_code, slow=False)
        tts.save(tmp_mp3)

        # Step 2: Convert MP3 -> WAV
        mp3_to_wav(tmp_mp3, wav_path)

        os.unlink(tmp_mp3)
        size_kb = os.path.getsize(wav_path) // 1024
        print(f"  OK  {persona}/{lang_key}.wav  ({size_kb} KB)")
        return True

    except Exception as e:
        print(f"  FAIL  {persona}/{lang_key}: {e}")
        # Clean up tmp if it exists
        try:
            os.unlink(tmp_mp3)
        except Exception:
            pass
        return False


def main():
    print(f"FFmpeg: {FFMPEG_PATH}")
    print(f"Output: {os.path.abspath(OUTPUT_ROOT)}\n")

    total = len(PERSONAS) * len(LANGUAGE_CONFIG)
    done  = 0
    failed = []

    for persona in PERSONAS:
        print(f"-- {persona.upper()} --")
        for lang_key, (lang_code, text) in LANGUAGE_CONFIG.items():
            ok = generate(persona, lang_key, lang_code, text)
            if ok:
                done += 1
            else:
                failed.append(f"{persona}/{lang_key}")

    print(f"\nDone: {done}/{total} generated.")
    if failed:
        print(f"Failed ({len(failed)}): {', '.join(failed)}")
    else:
        print("All samples generated successfully!")


if __name__ == '__main__':
    main()

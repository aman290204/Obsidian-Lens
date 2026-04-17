"""
differentiate_persona_voices.py
────────────────────────────────────────────────────────────────────────────────
Applies ffmpeg pitch + speed filters to make each persona sound distinct.
Uses the already-generated audio files as source, creating persona variants.

Voice character design:
  ethan  — Deep professional male  (pitch -15%, normal speed)
  maya   — Clear female voice      (pitch +20%, slightly faster)
  kenji  — Low calm male           (pitch -22%, slightly slower)
  clara  — Energetic female        (pitch +28%, faster)
  arjun  — Warm Indian male        (pitch -8%, slightly slower)
  priya  — Warm Indian female      (pitch +15%, normal speed)

Strategy:
  - Ethan is treated as the "base" voice (already generated, no transform)
  - All other personas are derived from ethan by pitch/speed transform
  - This way every persona × language combination is unique

Usage:
    python scripts/differentiate_persona_voices.py

Requires:
    Already generated audio via generate_voice_samples.py
    (ffmpeg is resolved from @ffmpeg-installer npm package)
"""

import os, subprocess, shutil

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
AUDIO_ROOT  = os.path.join(SCRIPT_DIR, '..', 'public', 'audio-samples')
FFMPEG      = os.path.join(SCRIPT_DIR, '..', 'node_modules', '@ffmpeg-installer',
                           'win32-x64', 'ffmpeg.exe')
if not os.path.exists(FFMPEG):
    FFMPEG = 'ffmpeg'

LANGUAGES = [
    'english', 'hinglish', 'tanglish', 'tenglish', 'manglish',
    'kanglish', 'benglish', 'marathlish', 'gujlish', 'urdu', 'odia',
]

# Each persona: (pitch_multiplier, tempo_multiplier)
# pitch >1.0 = higher, <1.0 = lower
# tempo >1.0 = faster, <1.0 = slower
PERSONA_VOICE = {
    'ethan':  (0.85, 1.0),   # Deep professional male
    'maya':   (1.20, 1.0),   # Clear female — higher pitch
    'kenji':  (0.78, 1.0),   # Low calm male — deepest pitch
    'clara':  (1.30, 1.0),   # Energetic female — highest pitch
    'arjun':  (0.92, 1.0),   # Warm Indian male — slightly lower
    'priya':  (1.15, 1.0),   # Warm Indian female — higher pitch
}

# Ethan is the "source" persona — all others derive from ethan
SOURCE_PERSONA = 'ethan'


def apply_voice(src: str, dst: str, pitch: float, tempo: float):
    """
    Apply pitch shift + tempo change using ffmpeg audio filters.
    Writes to a temp file first to avoid ffmpeg's in-place write restriction.
    """
    import tempfile
    base_rate = 22050
    af = (
        f"asetrate={int(base_rate * pitch)},"
        f"aresample={base_rate},"
        f"atempo={tempo:.4f}"
    )
    # Use a temp file to avoid ffmpeg "same as input" error
    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.wav')
    os.close(tmp_fd)
    try:
        cmd = [
            FFMPEG, '-y', '-i', src,
            '-af', af,
            '-ar', str(base_rate),
            '-ac', '1',
            '-acodec', 'pcm_s16le',
            tmp_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg error: {result.stderr[-300:]}")
        shutil.move(tmp_path, dst)
    except Exception:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        raise


def main():
    print(f"FFmpeg : {FFMPEG}")
    print(f"Audio  : {os.path.abspath(AUDIO_ROOT)}\n")

    total, done, failed = 0, 0, []

    for persona, (pitch, tempo) in PERSONA_VOICE.items():
        print(f"-- {persona.upper()} (pitch={pitch:.2f}x, tempo={tempo:.2f}x) --")
        for lang in LANGUAGES:
            src = os.path.join(AUDIO_ROOT, SOURCE_PERSONA, f'{lang}.wav')
            dst = os.path.join(AUDIO_ROOT, persona, f'{lang}.wav')
            total += 1

            if not os.path.exists(src):
                print(f"  SKIP  {lang} (source missing)")
                failed.append(f"{persona}/{lang}")
                continue

            try:
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                apply_voice(src, dst, pitch, tempo)
                size_kb = os.path.getsize(dst) // 1024
                print(f"  OK  {persona}/{lang}.wav  ({size_kb} KB)")
                done += 1
            except Exception as e:
                print(f"  FAIL  {persona}/{lang}: {e}")
                failed.append(f"{persona}/{lang}")

    print(f"\nDone: {done}/{total}")
    if failed:
        print(f"Failed: {', '.join(failed)}")
    else:
        print("All persona voices differentiated!")


if __name__ == '__main__':
    main()

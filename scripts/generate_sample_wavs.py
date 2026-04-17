"""
generate_sample_wavs.py
────────────────────────────────────────────────────────────────────────────────
Generates valid WAV audio samples for each persona × language combination.

Each file is a short sine-tone (~2.5 seconds) at a unique frequency so you
can tell them apart by ear. The browser's <Audio> API plays them flawlessly.

Usage:
    python scripts/generate_sample_wavs.py

Requires: Python 3.6+  (uses only stdlib — wave, math, struct)
"""

import wave, math, struct, os, itertools

# ── Config ────────────────────────────────────────────────────────────────────
SAMPLE_RATE  = 22050      # Hz
DURATION_SEC = 2.5        # seconds per file
AMPLITUDE    = 12000      # 0–32767, keep well below max to avoid clipping
OUTPUT_ROOT  = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio-samples')

PERSONAS = ['ethan', 'maya', 'kenji', 'clara', 'arjun', 'priya']
LANGUAGES = [
    'english', 'hinglish', 'tanglish', 'tenglish',
    'manglish', 'kanglish', 'benglish', 'marathlish',
    'gujlish', 'urdu', 'odia',
]

# Each persona gets its own base frequency so you can hear the difference
PERSONA_FREQ = {
    'ethan':  440.0,   # A4
    'maya':   494.0,   # B4
    'kenji':  523.0,   # C5
    'clara':  587.0,   # D5
    'arjun':  659.0,   # E5
    'priya':  698.0,   # F5
}
# Each language adds a small offset so every file is unique
LANG_OFFSET = {lang: i * 8 for i, lang in enumerate(LANGUAGES)}


def make_sine_wav(path: str, freq: float):
    """Write a valid 16-bit mono WAV with a pure sine tone at `freq` Hz."""
    num_frames = int(SAMPLE_RATE * DURATION_SEC)
    with wave.open(path, 'w') as wf:
        wf.setnchannels(1)          # mono
        wf.setsampwidth(2)          # 16-bit
        wf.setframerate(SAMPLE_RATE)
        for i in range(num_frames):
            # Gentle fade-in / fade-out over first & last 0.1 s
            fade = min(i, num_frames - i, int(SAMPLE_RATE * 0.1)) / (SAMPLE_RATE * 0.1)
            fade = min(fade, 1.0)
            sample = int(AMPLITUDE * fade * math.sin(2 * math.pi * freq * i / SAMPLE_RATE))
            wf.writeframesraw(struct.pack('<h', sample))
    print(f'  OK  {os.path.relpath(path)}  ({freq:.0f} Hz)')


def main():
    total = len(PERSONAS) * len(LANGUAGES)
    done  = 0
    for persona, lang in itertools.product(PERSONAS, LANGUAGES):
        folder = os.path.join(OUTPUT_ROOT, persona)
        os.makedirs(folder, exist_ok=True)
        path  = os.path.join(folder, f'{lang}.wav')
        freq  = PERSONA_FREQ[persona] + LANG_OFFSET[lang]
        make_sine_wav(path, freq)
        done += 1

    print(f'\nDone! Generated {done}/{total} WAV files in {os.path.abspath(OUTPUT_ROOT)}')


if __name__ == '__main__':
    main()

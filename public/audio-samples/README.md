# Audio Samples for Demo Preview

This directory contains sample audio files for each persona/language combination.

## Structure

```
audio-samples/
├── ethan/
│   ├── english.mp3
│   ├── hinglish.mp3
│   ├── tanglish.mp3
│   ├── tenglish.mp3
│   ├── manglish.mp3
│   ├── kanglish.mp3
│   ├── benglish.mp3
│   ├── marathlish.mp3
│   ├── gujlish.mp3
│   ├── urdu.mp3
│   └── odia.mp3
├── maya/ (same structure)
├── kenji/ (same structure)
├── clara/ (same structure)
├── arjun/ (same structure)
└── priya/ (same structure)
```

## Audio Requirements

- Format: MP3 (Web-compatible)
- Sample Rate: 44.1 kHz or 48 kHz
- Bitrate: 128-192 kbps
- Duration: 3-5 seconds
- Content: Short phrase demonstrating the persona's voice in that language
- Volume: Normalized to -3 dB peak

## Purpose

These are **preview samples only** - frontend-only feature to let users hear what each persona sounds like before generating a video. NOT part of the NVIDIA worker pipeline.

## Placeholder

Until real samples are added, the system will use browser console warnings when previews are attempted.

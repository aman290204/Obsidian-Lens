/**
 * Sample Audio Mapping for Demo Playback
 * --------------------------------------
 * These are static frontend samples to preview avatar voices.
 * NOT part of the NVIDIA worker pipeline.
 */

export const SAMPLE_AUDIO: Record<string, Record<string, string>> = {
  // Ethan (Male Pro)
  ethan: {
    english: '/audio-samples/ethan/english.wav',
    hinglish: '/audio-samples/ethan/hinglish.wav',
    tanglish: '/audio-samples/ethan/tamil.wav',
    tenglish: '/audio-samples/ethan/telugu.wav',
    manglish: '/audio-samples/ethan/malayalam.wav',
    kanglish: '/audio-samples/ethan/kannada.wav',
    benglish: '/audio-samples/ethan/bengali.wav',
    marathlish: '/audio-samples/ethan/marathi.wav',
    gujlish: '/audio-samples/ethan/gujarati.wav',
    urdu: '/audio-samples/ethan/urdu.wav',
    odia: '/audio-samples/ethan/odia.wav',
  },

  // Maya (Female)
  maya: {
    english: '/audio-samples/maya/english.wav',
    hinglish: '/audio-samples/maya/hinglish.wav',
    tanglish: '/audio-samples/maya/tamil.wav',
    tenglish: '/audio-samples/maya/telugu.wav',
    manglish: '/audio-samples/maya/malayalam.wav',
    kanglish: '/audio-samples/maya/kannada.wav',
    benglish: '/audio-samples/maya/bengali.wav',
    marathlish: '/audio-samples/maya/marathi.wav',
    gujlish: '/audio-samples/maya/gujarati.wav',
    urdu: '/audio-samples/maya/urdu.wav',
    odia: '/audio-samples/maya/odia.wav',
  },

  // Kenji (Male)
  kenji: {
    english: '/audio-samples/kenji/english.wav',
    hinglish: '/audio-samples/kenji/hinglish.wav',
    tanglish: '/audio-samples/kenji/tamil.wav',
    tenglish: '/audio-samples/kenji/telugu.wav',
    manglish: '/audio-samples/kenji/malayalam.wav',
    kanglish: '/audio-samples/kenji/kannada.wav',
    benglish: '/audio-samples/kenji/bengali.wav',
    marathlish: '/audio-samples/kenji/marathi.wav',
    gujlish: '/audio-samples/kenji/gujarati.wav',
    urdu: '/audio-samples/kenji/urdu.wav',
    odia: '/audio-samples/kenji/odia.wav',
  },

  // Clara (Female)
  clara: {
    english: '/audio-samples/clara/english.wav',
    hinglish: '/audio-samples/clara/hinglish.wav',
    tanglish: '/audio-samples/clara/tamil.wav',
    tenglish: '/audio-samples/clara/telugu.wav',
    manglish: '/audio-samples/clara/malayalam.wav',
    kanglish: '/audio-samples/clara/kannada.wav',
    benglish: '/audio-samples/clara/bengali.wav',
    marathlish: '/audio-samples/clara/marathi.wav',
    gujlish: '/audio-samples/clara/gujarati.wav',
    urdu: '/audio-samples/clara/urdu.wav',
    odia: '/audio-samples/clara/odia.wav',
  },

  // Arjun (Male Indian)
  arjun: {
    english: '/audio-samples/arjun/english.wav',
    hinglish: '/audio-samples/arjun/hinglish.wav',
    tanglish: '/audio-samples/arjun/tamil.wav',
    tenglish: '/audio-samples/arjun/telugu.wav',
    manglish: '/audio-samples/arjun/malayalam.wav',
    kanglish: '/audio-samples/arjun/kannada.wav',
    benglish: '/audio-samples/arjun/bengali.wav',
    marathlish: '/audio-samples/arjun/marathi.wav',
    gujlish: '/audio-samples/arjun/gujarati.wav',
    urdu: '/audio-samples/arjun/urdu.wav',
    odia: '/audio-samples/arjun/odia.wav',
  },

  // Priya (Female Indian)
  priya: {
    english: '/audio-samples/priya/english.wav',
    hinglish: '/audio-samples/priya/hinglish.wav',
    tanglish: '/audio-samples/priya/tamil.wav',
    tenglish: '/audio-samples/priya/telugu.wav',
    manglish: '/audio-samples/priya/malayalam.wav',
    kanglish: '/audio-samples/priya/kannada.wav',
    benglish: '/audio-samples/priya/bengali.wav',
    marathlish: '/audio-samples/priya/marathi.wav',
    gujlish: '/audio-samples/priya/gujarati.wav',
    urdu: '/audio-samples/priya/urdu.wav',
    odia: '/audio-samples/priya/odia.wav',
  },
};

export type SupportedPersona = keyof typeof SAMPLE_AUDIO;
export type SupportedLanguage = 'english' | 'hinglish' | 'tanglish' | 'tenglish' | 'manglish' | 'kanglish' | 'benglish' | 'marathlish' | 'gujlish' | 'urdu' | 'odia';

/**
 * Get sample audio URL for a persona and language
 */
export function getSampleAudio(persona: string, language: string): string | null {
  const personaSamples = SAMPLE_AUDIO[persona as keyof typeof SAMPLE_AUDIO];
  if (!personaSamples) return null;

  // Try exact language match
  if (personaSamples[language as keyof typeof personaSamples]) {
    return personaSamples[language as keyof typeof personaSamples];
  }

  // Fallback to English
  return personaSamples.english || null;
}

/**
 * Play sample audio with proper error handling
 */
export async function playSampleAudio(persona: string, language: string): Promise<boolean> {
  const url = getSampleAudio(persona, language);
  if (!url) {
    console.warn(`[SampleAudio] No sample for ${persona}/${language}`);
    return false;
  }

  try {
    // Stop any currently playing sample
    const currentAudio = document.querySelector('audio[data-sample="true"]') as HTMLAudioElement;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.remove();
    }

    const audio = new Audio(url);
    audio.setAttribute('data-sample', 'true');
    audio.volume = 0.5; // Lower volume for preview

    await audio.play();
    return true;
  } catch (err) {
    // Autoplay blocked or other error
    console.debug('[SampleAudio] Play failed (likely autoplay block):', err);
    return false;
  }
}

/**
 * Stop any playing sample audio
 */
export function stopSampleAudio(): void {
  const currentAudio = document.querySelector('audio[data-sample="true"]') as HTMLAudioElement;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.remove();
  }
}

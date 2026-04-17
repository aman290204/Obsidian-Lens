/**
 * Sample Audio Mapping for Demo Playback
 * --------------------------------------
 * These are static frontend samples to preview avatar voices.
 * NOT part of the NVIDIA worker pipeline.
 */

export const SAMPLE_AUDIO: Record<string, Record<string, string>> = {
  // Ethan (Male Pro)
  ethan: {
    english:    '/audio-samples/ethan/english.wav',
    hinglish:   '/audio-samples/ethan/hinglish.wav',
    tanglish:   '/audio-samples/ethan/tanglish.wav',
    tenglish:   '/audio-samples/ethan/tenglish.wav',
    manglish:   '/audio-samples/ethan/manglish.wav',
    kanglish:   '/audio-samples/ethan/kanglish.wav',
    benglish:   '/audio-samples/ethan/benglish.wav',
    marathlish: '/audio-samples/ethan/marathlish.wav',
    gujlish:    '/audio-samples/ethan/gujlish.wav',
    urdu:       '/audio-samples/ethan/urdu.wav',
    odia:       '/audio-samples/ethan/odia.wav',
  },

  // Maya (Female)
  maya: {
    english:    '/audio-samples/maya/english.wav',
    hinglish:   '/audio-samples/maya/hinglish.wav',
    tanglish:   '/audio-samples/maya/tanglish.wav',
    tenglish:   '/audio-samples/maya/tenglish.wav',
    manglish:   '/audio-samples/maya/manglish.wav',
    kanglish:   '/audio-samples/maya/kanglish.wav',
    benglish:   '/audio-samples/maya/benglish.wav',
    marathlish: '/audio-samples/maya/marathlish.wav',
    gujlish:    '/audio-samples/maya/gujlish.wav',
    urdu:       '/audio-samples/maya/urdu.wav',
    odia:       '/audio-samples/maya/odia.wav',
  },

  // Kenji (Male)
  kenji: {
    english:    '/audio-samples/kenji/english.wav',
    hinglish:   '/audio-samples/kenji/hinglish.wav',
    tanglish:   '/audio-samples/kenji/tanglish.wav',
    tenglish:   '/audio-samples/kenji/tenglish.wav',
    manglish:   '/audio-samples/kenji/manglish.wav',
    kanglish:   '/audio-samples/kenji/kanglish.wav',
    benglish:   '/audio-samples/kenji/benglish.wav',
    marathlish: '/audio-samples/kenji/marathlish.wav',
    gujlish:    '/audio-samples/kenji/gujlish.wav',
    urdu:       '/audio-samples/kenji/urdu.wav',
    odia:       '/audio-samples/kenji/odia.wav',
  },

  // Clara (Female)
  clara: {
    english:    '/audio-samples/clara/english.wav',
    hinglish:   '/audio-samples/clara/hinglish.wav',
    tanglish:   '/audio-samples/clara/tanglish.wav',
    tenglish:   '/audio-samples/clara/tenglish.wav',
    manglish:   '/audio-samples/clara/manglish.wav',
    kanglish:   '/audio-samples/clara/kanglish.wav',
    benglish:   '/audio-samples/clara/benglish.wav',
    marathlish: '/audio-samples/clara/marathlish.wav',
    gujlish:    '/audio-samples/clara/gujlish.wav',
    urdu:       '/audio-samples/clara/urdu.wav',
    odia:       '/audio-samples/clara/odia.wav',
  },

  // Arjun (Male Indian)
  arjun: {
    english:    '/audio-samples/arjun/english.wav',
    hinglish:   '/audio-samples/arjun/hinglish.wav',
    tanglish:   '/audio-samples/arjun/tanglish.wav',
    tenglish:   '/audio-samples/arjun/tenglish.wav',
    manglish:   '/audio-samples/arjun/manglish.wav',
    kanglish:   '/audio-samples/arjun/kanglish.wav',
    benglish:   '/audio-samples/arjun/benglish.wav',
    marathlish: '/audio-samples/arjun/marathlish.wav',
    gujlish:    '/audio-samples/arjun/gujlish.wav',
    urdu:       '/audio-samples/arjun/urdu.wav',
    odia:       '/audio-samples/arjun/odia.wav',
  },

  // Priya (Female Indian)
  priya: {
    english:    '/audio-samples/priya/english.wav',
    hinglish:   '/audio-samples/priya/hinglish.wav',
    tanglish:   '/audio-samples/priya/tanglish.wav',
    tenglish:   '/audio-samples/priya/tenglish.wav',
    manglish:   '/audio-samples/priya/manglish.wav',
    kanglish:   '/audio-samples/priya/kanglish.wav',
    benglish:   '/audio-samples/priya/benglish.wav',
    marathlish: '/audio-samples/priya/marathlish.wav',
    gujlish:    '/audio-samples/priya/gujlish.wav',
    urdu:       '/audio-samples/priya/urdu.wav',
    odia:       '/audio-samples/priya/odia.wav',
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

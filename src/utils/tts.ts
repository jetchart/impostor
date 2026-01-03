// Text-to-Speech utility using Web Speech API

let voicesLoaded = false;
let cachedVoices: SpeechSynthesisVoice[] = [];

export const speak = (text: string, onEnd?: () => void): SpeechSynthesisUtterance | null => {
  if (!('speechSynthesis' in window)) {
    console.warn('Text-to-speech not supported');
    onEnd?.();
    return null;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-AR'; // Spanish Argentina
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  // Get voices (use cached if available)
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  
  // Try to find a Spanish voice (prefer AR, then any Spanish)
  const spanishVoice = voices.find(v => v.lang.includes('es-AR')) 
    || voices.find(v => v.lang.startsWith('es')) 
    || voices[0];
  if (spanishVoice) {
    utterance.voice = spanishVoice;
  }

  // Safety timeout - if speech doesn't complete in reasonable time, call onEnd
  const maxDuration = Math.max(3000, text.length * 100); // ~100ms per character, min 3 seconds
  const safetyTimeout = setTimeout(() => {
    console.warn('Speech timed out, forcing completion');
    window.speechSynthesis.cancel();
    onEnd?.();
  }, maxDuration);

  utterance.onend = () => {
    clearTimeout(safetyTimeout);
    onEnd?.();
  };
  
  utterance.onerror = (event) => {
    console.error('Speech error:', event.error);
    clearTimeout(safetyTimeout);
    onEnd?.();
  };

  // Chrome has a bug where speech synthesis pauses after ~15 seconds
  // This keeps it alive by resuming periodically
  const keepAlive = setInterval(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    } else {
      clearInterval(keepAlive);
    }
  }, 10000);

  utterance.onend = () => {
    clearTimeout(safetyTimeout);
    clearInterval(keepAlive);
    onEnd?.();
  };

  // Small delay to ensure voices are loaded
  setTimeout(() => {
    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Speech synthesis error:', err);
      clearTimeout(safetyTimeout);
      clearInterval(keepAlive);
      onEnd?.();
    }
  }, 50);
  
  return utterance;
};

export const cancelSpeech = () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

// Preload voices (needed for some browsers)
export const preloadVoices = (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      voicesLoaded = true;
      resolve(voices);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      voicesLoaded = true;
      resolve(cachedVoices);
    };

    // Timeout fallback
    setTimeout(() => {
      cachedVoices = window.speechSynthesis.getVoices();
      voicesLoaded = cachedVoices.length > 0;
      resolve(cachedVoices);
    }, 1000);
  });
};

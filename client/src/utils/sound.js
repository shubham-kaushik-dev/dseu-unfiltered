/**
 * Plays a gentle, premium two-tone chime using Web Audio API.
 * Does not require external audio assets.
 * Respects user preferences saved in localStorage.
 */
export function playNotificationChime() {
  try {
    const isSoundEnabled = localStorage.getItem('dseu_sound_enabled') !== 'false';
    if (!isSoundEnabled) return;

    // Create browser audio context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const audioCtx = new AudioContext();
    
    const playTone = (frequency, startTime, duration) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);
      
      // Volume envelope: start subtle, fade to zero exponentially
      gainNode.gain.setValueAtTime(0.04, startTime); // Low, pleasant volume
      gainNode.gain.exponentialRampToValueAtTime(0.00001, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = audioCtx.currentTime;
    // Chime notes: C5 (523.25 Hz) followed quickly by E5 (659.25 Hz)
    playTone(523.25, now, 0.15);
    playTone(659.25, now + 0.08, 0.25);
  } catch (err) {
    // Browsers block audio before first user gesture, fail silently
    console.debug('Audio Context playback blocked:', err);
  }
}

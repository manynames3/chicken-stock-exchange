let audio, master;
const voices = new Set();
export const soundEnabled = () => localStorage.getItem("cse-sound") === "on";
export function unlockSound() {
  if (!soundEnabled()) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!audio) {
      audio = new Audio();
      master = audio.createGain();
      master.connect(audio.destination);
    }
    master.gain.setValueAtTime(1, audio.currentTime);
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch {
    /* Sound is optional. */
  }
}
export function setSoundEnabled(enabled) {
  localStorage.setItem("cse-sound", enabled ? "on" : "off");
  if (enabled) unlockSound();
  else if (audio) {
    master.gain.setValueAtTime(0, audio.currentTime);
    for (const voice of voices) {
      try {
        voice.stop();
      } catch {
        /* Already ended. */
      }
    }
    voices.clear();
  }
  return enabled;
}
export function toggleSound() {
  const enabled = setSoundEnabled(!soundEnabled());
  if (enabled) playCue("settlement");
  return enabled;
}
// Shared by live playback and offline renders used to verify the effects.
export function scheduleCue(
  context,
  destination,
  cue,
  positive = true,
  start = context.currentTime,
  onVoice = () => {},
) {
  function note(
    at,
    frequency,
    duration = 0.14,
    volume = 0.035,
    type = "sine",
    slide = null,
    filter = 1800,
    wobble = false,
  ) {
    const oscillator = context.createOscillator(),
      gain = context.createGain(),
      lowpass = context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start + at);
    if (slide)
      oscillator.frequency.exponentialRampToValueAtTime(
        slide,
        start + at + duration,
      );
    lowpass.type = "lowpass";
    lowpass.frequency.value = filter;
    gain.gain.setValueAtTime(0, start + at);
    gain.gain.linearRampToValueAtTime(volume, start + at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + duration);
    oscillator.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(destination);
    const connected = [oscillator, lowpass, gain];
    if (wobble) {
      const lfo = context.createOscillator(),
        depth = context.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.value = 7;
      lfo.connect(depth);
      depth.connect(oscillator.frequency);
      lfo.start(start + at);
      lfo.stop(start + at + duration + 0.02);
      connected.push(lfo, depth);
    }
    onVoice(oscillator);
    oscillator.onended = () => {
      voices.delete(oscillator);
      for (const node of connected) node.disconnect();
    };
    oscillator.start(start + at);
    oscillator.stop(start + at + duration + 0.02);
  }
  function cluck(at) {
    note(at, 900, 0.09, 0.055, "triangle", 430);
    note(at + 0.11, 1150, 0.13, 0.045, "triangle", 620);
  }
  if (cue === "news") {
    // A short drum roll, bright brass fanfare and two cartoon clucks.
    if (positive) {
      for (let i = 0; i < 4; i++)
        note(i * 0.075, 105, 0.075, 0.045, "triangle", 45);
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        note(
          0.32 + i * 0.16,
          f,
          i === 3 ? 0.48 : 0.18,
          0.055,
          "square",
          null,
          1700,
        ),
      );
      note(0.8, 659.25, 0.48, 0.022, "triangle");
      cluck(1.35);
      cluck(1.65);
      return 1.91;
    }
    // A drooping trombone, a low comic bump, then a surprised chicken squeak.
    note(0, 349.23, 0.62, 0.065, "sawtooth", 261.63, 950, true);
    note(0.66, 261.63, 0.82, 0.07, "sawtooth", 130.81, 850, true);
    note(1.34, 90, 0.18, 0.065, "triangle", 38);
    note(1.56, 320, 0.19, 0.045, "triangle", 1080);
    note(1.78, 1000, 0.11, 0.03, "triangle", 490);
    return 1.93;
  }
  const sequences = {
    orders: [240, 300],
    dice: [180, 240, 160, 280],
    prices: positive ? [440, 550] : [440, 330],
    settlement: [440, 550, 660],
    closing: [440, 550, 660, 880],
  };
  const values = sequences[cue] || [];
  values.forEach((f, i) => note(i * 0.085, f));
  return values.length ? values.length * 0.085 + 0.14 : 0;
}
export function playCue(cue, positive = true) {
  if (!soundEnabled() || !audio || document.hidden) return;
  try {
    if (cue === "news") {
      for (const voice of voices) {
        try {
          voice.stop();
        } catch {
          /* Already ended. */
        }
      }
      voices.clear();
    }
    scheduleCue(audio, master, cue, positive, audio.currentTime, (voice) =>
      voices.add(voice),
    );
  } catch {
    /* Sound is optional. */
  }
}

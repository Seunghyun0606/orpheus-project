// Synthesised sound for the Godot build (no third-party audio, nothing to license).
//
//   node scripts/story/synth-audio.mjs      writes godot/audio/*.wav
//
// Deterministic: a seeded generator, so re-running produces identical files.
// Loops (ambient, title) are built from whole cycles and a cross-faded noise
// bed, so they repeat without a click.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'godot/audio/';
const TAU = Math.PI * 2;

let seed = 4172;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

function wav(name, samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((value, i) =>
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), i * 2),
  );
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(OUT + name + '.wav', Buffer.concat([header, data]));
}

const render = (seconds, rate, fn) =>
  Array.from({ length: Math.round(seconds * rate) }, (_, i) => fn(i / rate, i));
const envelope = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

// One-pole low-pass over white noise: a soft, dark bed.
function noise(seconds, rate, cutoff) {
  const alpha = 1 - Math.exp((-TAU * cutoff) / rate);
  let last = 0;
  return render(seconds, rate, () => (last += alpha * (random() * 2 - 1 - last)));
}

// Cross-fades the tail into the head so the noise loops seamlessly.
function loopable(samples, rate, fade) {
  const n = Math.round(fade * rate);
  const body = samples.slice(0, samples.length - n);
  for (let i = 0; i < n; i++) {
    const w = i / n;
    body[i] = body[i] * w + samples[samples.length - n + i] * (1 - w);
  }
  return body;
}

mkdirSync(OUT, { recursive: true });
const SFX = 44100;

// Pager: three two-tone chirps.
wav(
  'pager',
  render(1.25, SFX, (t) => {
    const beat = t % 0.42;
    if (beat > 0.3) return 0;
    const f = beat < 0.15 ? 1046 : 784;
    return 0.35 * Math.sign(Math.sin(TAU * f * t)) * 0.4 * envelope(beat % 0.15, 0.004, 0.09);
  }),
  SFX,
);

// Typing: a short filtered tick; the log console uses a brighter one.
const tick = (bright) => {
  const bed = noise(0.03, SFX, bright ? 6000 : 2500);
  return bed.map((v, i) => v * (bright ? 1.2 : 1.6) * envelope(i / SFX, 0.0008, 0.006));
};
wav('type', tick(false), SFX);
wav('log', tick(true), SFX);

// Evidence: a soft two-note chime.
wav(
  'evidence',
  render(0.9, SFX, (t) => {
    const a = Math.sin(TAU * 659.25 * t) * envelope(t, 0.005, 0.35);
    const b = t > 0.09 ? Math.sin(TAU * 987.77 * (t - 0.09)) * envelope(t - 0.09, 0.005, 0.4) : 0;
    return 0.22 * (a + b);
  }),
  SFX,
);

// Choice: a muted low blip.
wav(
  'choice',
  render(0.12, SFX, (t) => 0.3 * Math.sin(TAU * (330 - 900 * t) * t) * envelope(t, 0.002, 0.03)),
  SFX,
);

// Timer: a dry tick for the last seconds.
wav(
  'tick',
  render(0.05, SFX, (t) => 0.25 * Math.sin(TAU * 1250 * t) * envelope(t, 0.001, 0.008)),
  SFX,
);

// Deduction: rising fifth when it holds, a falling semitone buzz when it doesn't.
wav(
  'solved',
  render(0.8, SFX, (t) => {
    const notes = [523.25, 659.25, 783.99];
    return (
      0.18 *
      notes.reduce(
        (sum, f, k) =>
          sum +
          (t > k * 0.08
            ? Math.sin(TAU * f * (t - k * 0.08)) * envelope(t - k * 0.08, 0.004, 0.3)
            : 0),
        0,
      )
    );
  }),
  SFX,
);
wav(
  'missed',
  render(0.45, SFX, (t) => {
    const f = t < 0.18 ? 233.08 : 220;
    return 0.2 * Math.sign(Math.sin(TAU * f * t)) * 0.5 * envelope(t % 0.18, 0.004, 0.12);
  }),
  SFX,
);

// Ambient: server-room hum (whole cycles of 60/120/180 Hz over 12 s) on a dark
// noise bed, quiet enough to sit under dialogue.
const LOOP = 22050;
const ambientSeconds = 12;
const bed = loopable(noise(ambientSeconds + 1, LOOP, 180), LOOP, 1);
wav(
  'ambient',
  bed.map((v, i) => {
    const t = i / LOOP;
    const hum =
      0.05 * Math.sin(TAU * 60 * t) +
      0.03 * Math.sin(TAU * 120 * t) +
      0.012 * Math.sin(TAU * 180 * t);
    const swell = 0.85 + 0.15 * Math.sin((TAU * t) / ambientSeconds);
    return (hum + 0.55 * v) * swell;
  }),
  LOOP,
);

// Title: a slow two-voice drone (55 and 82.5 Hz, whole cycles over 16 s) that
// breathes twice per loop.
const titleSeconds = 16;
wav(
  'title',
  render(titleSeconds, LOOP, (t) => {
    const breath = 0.6 + 0.4 * Math.sin((TAU * 2 * t) / titleSeconds);
    const voice =
      Math.sin(TAU * 55 * t) * 0.5 +
      Math.sin(TAU * 82.5 * t) * 0.3 +
      Math.sin(TAU * 110 * t + Math.sin((TAU * t) / 8)) * 0.12;
    return 0.16 * voice * breath;
  }),
  LOOP,
);

console.log('Synthesised audio in ' + OUT);

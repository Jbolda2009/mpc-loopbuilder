import { useState } from "react";

const NOTE_MAP = {
  C: 261.63, "C#": 277.18, D: 293.66, "D#": 311.13,
  E: 329.63, F: 349.23, "F#": 369.99, G: 392.0,
  "G#": 415.3, A: 440.0, "A#": 466.16, B: 493.88
};

const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

function noteFreq(key, step, octaveShift = 0) {
  const keys = Object.keys(NOTE_MAP);
  const rootIndex = keys.indexOf(key || "C");
  const semitone = MINOR_SCALE[step % MINOR_SCALE.length];
  const noteIndex = (rootIndex + semitone) % 12;
  return NOTE_MAP[keys[noteIndex]] * Math.pow(2, octaveShift);
}

export default function Home() {
  const [bpm, setBpm] = useState(90);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState(null);

  async function generateLoop() {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    setResult(data);

    if (data.bpm) setBpm(Number(data.bpm));
  }

  function playAILoop() {
    if (!result) return alert("Generate a loop first.");

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const secondsPerBeat = 60 / Number(result.bpm || bpm);
    const bars = 4;
    const totalBeats = bars * 4;
    const start = audioCtx.currentTime + 0.1;

    function playTone(freq, time, duration, type = "triangle", gain = 0.15) {
      const osc = audioCtx.createOscillator();
      const amp = audioCtx.createGain();

      osc.type = type;
      osc.frequency.value = freq;

      amp.gain.setValueAtTime(0, time);
      amp.gain.linearRampToValueAtTime(gain, time + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(amp);
      amp.connect(audioCtx.destination);

      osc.start(time);
      osc.stop(time + duration);
    }

    function playKick(time) {
      playTone(60, time, 0.18, "sine", 0.8);
    }

    function playSnare(time) {
      playTone(180, time, 0.08, "square", 0.25);
    }

    function playHat(time) {
      playTone(9000, time, 0.025, "square", 0.05);
    }

    const melody = [0, 2, 4, 5, 4, 2, 1, 0];

    for (let beat = 0; beat < totalBeats; beat++) {
      const t = start + beat * secondsPerBeat;

      if (result.style === "trap") {
        if (beat % 4 === 0 || beat % 4 === 3) playKick(t);
        if (beat % 4 === 2) playSnare(t);
        playHat(t);
        playHat(t + secondsPerBeat / 2);
      }

      const m = melody[beat % melody.length];
      const freq = noteFreq(result.key || "C", m, 0);

      if (beat % 2 === 0) {
        playTone(freq, t, secondsPerBeat * 1.5, "triangle", 0.18);
        playTone(freq / 2, t, secondsPerBeat * 0.9, "sine", 0.12);
      }
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>MPC LoopBuilder AI</h1>

      <input
        type="text"
        placeholder="dark trap guitar 140 bpm F minor"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        style={{ width: "100%", padding: 10 }}
      />

      <br /><br />

      <button onClick={generateLoop}>Generate Loop</button>
      <button onClick={playAILoop} style={{ marginLeft: 10 }}>
        Play AI Loop
      </button>

      <br /><br />

      <p>BPM: {bpm}</p>

      <input
        type="range"
        min="60"
        max="160"
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        style={{ width: "100%" }}
      />

      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

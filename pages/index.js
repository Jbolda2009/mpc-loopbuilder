import { useState } from "react";

const KEYS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

export default function Home() {
  const [prompt, setPrompt] = useState("dark trap guitar 140 bpm C minor 8 bars");
  const [result, setResult] = useState(null);
  const [bpm, setBpm] = useState(140);
  const [loading, setLoading] = useState(false);

  async function generateLoop() {
    setLoading(true);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    setResult(data);
    if (data.bpm) setBpm(Number(data.bpm));
    setLoading(false);
  }

  function freqFor(key = "C", degree = 0, octave = 0) {
    const minor = [0, 2, 3, 5, 7, 8, 10];
    const root = KEYS.indexOf(key);
    const note = (root + minor[degree % minor.length]) % 12;
    return 261.63 * Math.pow(2, (note / 12) + octave);
  }

  function playLoop() {
    if (!result) return alert("Generate a loop first.");

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const bpmVal = Number(result.bpm || bpm);
    const spb = 60 / bpmVal;
    const bars = Number(result.bars || 8);
    const beats = bars * 4;
    const start = ctx.currentTime + 0.1;
    const key = result.key || "C";
    const genre = (result.genre || result.style || "").toLowerCase();

    function tone(freq, time, dur, type = "triangle", gainVal = 0.18) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = type;
      osc.frequency.value = freq;
      filter.type = "lowpass";
      filter.frequency.value = genre.includes("trap") ? 1800 : 2600;

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(gainVal, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + dur);
    }

    function kick(t) {
      tone(60, t, 0.18, "sine", 0.9);
    }

    function snare(t) {
      tone(180, t, 0.08, "square", 0.22);
    }

    function hat(t) {
      tone(9000, t, 0.025, "square", 0.035);
    }

    const melody = genre.includes("gospel")
      ? [0, 2, 4, 5, 6, 5, 4, 2]
      : genre.includes("r&b") || genre.includes("soul")
      ? [0, 4, 5, 2, 1, 2, 4, 0]
      : genre.includes("drill")
      ? [0, 1, 3, 4, 3, 1, 0, 5]
      : [0, 2, 4, 5, 4, 2, 1, 0];

    for (let b = 0; b < beats; b++) {
      let t = start + b * spb;
      if (b % 2 === 1) t += spb * 0.05;

      if (genre.includes("trap") || genre.includes("drill")) {
        if (b % 4 === 0 || b % 4 === 3) kick(t);
        if (b % 4 === 2) snare(t);
        hat(t);
        hat(t + spb / 2);
        if (b % 4 === 3) hat(t + spb * 0.75);
      } else {
        if (b % 4 === 0) kick(t);
        if (b % 4 === 2) snare(t);
        hat(t + spb / 2);
      }

      if (b % 2 === 0) {
        const step = melody[b % melody.length];
        tone(freqFor(key, step, 0), t, spb * 1.6, "triangle", 0.22);
        tone(freqFor(key, step, -1), t, spb, "sine", 0.13);
      }
    }
  }

  return (
    <div style={{
      padding: 24,
      fontFamily: "Arial, sans-serif",
      background: "#0d0d0f",
      color: "white",
      minHeight: "100vh"
    }}>
      <h1 style={{ fontSize: 34 }}>MPC LoopBuilder AI</h1>
      <p>Prompt-based AI loop generator for MPC Key 37.</p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Example: dark trap guitar 140 bpm F minor 8 bars"
        style={{
          width: "100%",
          minHeight: 90,
          padding: 12,
          borderRadius: 10,
          fontSize: 16
        }}
      />

      <br /><br />

      <button onClick={generateLoop} style={{ padding: 12, marginRight: 10 }}>
        {loading ? "Generating..." : "Generate Loop"}
      </button>

      <button onClick={playLoop} style={{ padding: 12 }}>
        Play AI Loop
      </button>

      <h3>BPM: {bpm}</h3>

      <input
        type="range"
        min="60"
        max="180"
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        style={{ width: "100%" }}
      />

      {result && (
        <div style={{
          marginTop: 20,
          background: "#18181b",
          padding: 16,
          borderRadius: 12
        }}>
          <h2>Loop Plan</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

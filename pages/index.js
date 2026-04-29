import { useState } from "react";

const SAMPLE_LIBRARY = {
  kicks: [
    "/samples/kick1.wav",
    "/samples/kick2.wav",
    "/samples/kick3.wav",
    "/samples/kick4.wav",
    "/samples/kick5.wav"
  ],
  snares: [
    "/samples/Snare1.wav",
    "/samples/Snare2.wav",
    "/samples/Snare3.wav",
    "/samples/Snare4.wav",
    "/samples/Snare5.wav"
  ],
  hats: [
    "/samples/hat1.wav",
    "/samples/hat2.wav",
    "/samples/hat3.wav",
    "/samples/hat4.wav",
    "/samples/hat5.wav",
    "/samples/hat6.wav"
  ],
  claps: [
    "/samples/Clap1.wav",
    "/samples/Clap2.wav",
    "/samples/Clap3.wav",
    "/samples/Clap4.wav",
    "/samples/Clap5.wav"
  ],
  bass808: [
    "/samples/808_1.wav",
    "/samples/808_2.wav",
    "/samples/808_3.wav",
    "/samples/808_4.wav",
    "/samples/808_5.wav"
  ]
};

export default function Home() {
  const [prompt, setPrompt] = useState("Trap drum pattern 4 bars 83 bpm");
  const [result, setResult] = useState(null);
  const [bpm, setBpm] = useState(83);
  const [loading, setLoading] = useState(false);

  async function generateLoop() {
    setLoading(true);

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    setResult(data);

    if (data.bpm) {
      setBpm(Number(data.bpm));
    }

    setLoading(false);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  async function loadSample(ctx, url) {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    return await ctx.decodeAudioData(buffer);
  }

  async function playAILoop() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      const kick = await loadSample(ctx, pick(SAMPLE_LIBRARY.kicks));
      const snare = await loadSample(ctx, pick(SAMPLE_LIBRARY.snares));
      const hat = await loadSample(ctx, pick(SAMPLE_LIBRARY.hats));
      const clap = await loadSample(ctx, pick(SAMPLE_LIBRARY.claps));
      const bass808 = await loadSample(ctx, pick(SAMPLE_LIBRARY.bass808));

      const bpmVal = Number(result?.bpm || bpm || 140);
      const spb = 60 / bpmVal;
      const stepTime = spb / 4;
      const start = ctx.currentTime + 0.1;

      function play(buffer, time, vol = 1) {
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();

        src.buffer = buffer;
        gain.gain.value = vol;

        src.connect(gain);
        gain.connect(ctx.destination);

        src.start(time);
      }

      for (let step = 0; step < 16; step++) {
        let t = start + step * stepTime;

        if (step % 4 === 0 || step % 4 === 3) play(kick, t, 1);
        if (step % 4 === 2) {
          play(snare, t, 0.9);
          play(clap, t + 0.01, 0.5);
        }

        play(hat, t, 0.4);

        if ([0, 6, 10].includes(step)) {
          play(bass808, t, 0.8);
        }
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  return (
    <div style={{
      padding: 24,
      fontFamily: "Arial",
      background: "#0d0d0f",
      color: "white",
      minHeight: "100vh"
    }}>
      <h1>MPC LoopBuilder AI</h1>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        style={{ width: "100%", padding: 10 }}
      />

      <br /><br />

      <button onClick={generateLoop}>
        {loading ? "Generating..." : "Generate Loop"}
      </button>

      <button onClick={playAILoop} style={{ marginLeft: 10 }}>
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
        <pre>{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}

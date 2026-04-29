import { useState } from "react";

const SAMPLE_LIBRARY = {
  kicks: [
    "/samples/Kicks/kick1.wav",
    "/samples/Kicks/kick2.wav",
    "/samples/Kicks/kick3.wav",
    "/samples/Kicks/kick4.wav",
    "/samples/Kicks/kick5.wav"
  ],
  snares: [
    "/samples/Snare/Snare1.wav",
    "/samples/Snare/Snare2.wav",
    "/samples/Snare/Snare3.wav",
    "/samples/Snare/Snare4.wav",
    "/samples/Snare/Snare5.wav"
  ],
  hats: [
    "/samples/Hats/hat1.wav",
    "/samples/Hats/hat2.wav",
    "/samples/Hats/hat3.wav",
    "/samples/Hats/hat4.wav",
    "/samples/Hats/hat5.wav",
    "/samples/Hats/hat6.wav"
  ],
  claps: [
    "/samples/Claps/Clap1.wav",
    "/samples/Claps/Clap2.wav",
    "/samples/Claps/Clap3.wav",
    "/samples/Claps/Clap4.wav",
    "/samples/Claps/Clap5.wav"
  ],
  bass808: [
    "/samples/808s/808_1.wav",
    "/samples/808s/808_2.wav",
    "/samples/808s/808_3.wav",
    "/samples/808s/808_4.wav",
    "/samples/808s/808_5.wav",
    "/samples/808s/808_6.wav",
    "/samples/808s/808_7.wav",
    "/samples/808s/808_8.wav",
    "/samples/808s/808_9.wav"
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

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  async function loadSample(ctx, url) {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Could not load sample: ${url}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  }

  async function playAILoop() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      const selected = {
        kick: pick(SAMPLE_LIBRARY.kicks),
        snare: pick(SAMPLE_LIBRARY.snares),
        hat: pick(SAMPLE_LIBRARY.hats),
        clap: pick(SAMPLE_LIBRARY.claps),
        bass808: pick(SAMPLE_LIBRARY.bass808)
      };

      const kick = await loadSample(ctx, selected.kick);
      const snare = await loadSample(ctx, selected.snare);
      const hat = await loadSample(ctx, selected.hat);
      const clap = await loadSample(ctx, selected.clap);
      const bass808 = await loadSample(ctx, selected.bass808);

      const bpmValue = Number(result?.bpm || bpm || 140);
      const secondsPerBeat = 60 / bpmValue;
      const bars = Number(result?.bars || 4);
      const stepsPerBar = 16;
      const totalSteps = bars * stepsPerBar;
      const stepTime = secondsPerBeat / 4;
      const start = ctx.currentTime + 0.12;
      const swing = 0.035;

      function play(buffer, time, volume = 1, playbackRate = 1) {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();

        source.buffer = buffer;
        source.playbackRate.value = playbackRate;
        gain.gain.value = volume;

        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(time);
      }

      for (let step = 0; step < totalSteps; step++) {
        let time = start + step * stepTime;

        if (step % 2 === 1) {
          time += stepTime * swing;
        }

        const position = step % 16;

        // Trap-style kicks
        if ([0, 3, 7, 10, 14].includes(position)) {
          play(kick, time, 1.0);
        }

        // Snare/clap on 3
        if (position === 8) {
          play(snare, time, 0.85);
          play(clap, time + 0.01, 0.45);
        }

        // Hats
        if (step % 2 === 0) {
          play(hat, time, 0.35);
        }

        // Hat rolls
        if ([6, 7, 14, 15].includes(position)) {
          play(hat, time + stepTime / 2, 0.22);
        }

        // 808 hits
        if ([0, 7, 10].includes(position)) {
          play(bass808, time, 0.8);
        }
      }

      setResult((prev) => ({
        ...(prev || {}),
        selectedSamples: selected
      }));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "Arial, sans-serif",
        background: "#0d0d0f",
        color: "white",
        minHeight: "100vh"
      }}
    >
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

      <br />
      <br />

      <button onClick={generateLoop} style={{ padding: 12, marginRight: 10 }}>
        {loading ? "Generating..." : "Generate Loop"}
      </button>

      <button onClick={playAILoop} style={{ padding: 12 }}>
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
        <div
          style={{
            marginTop: 20,
            background: "#18181b",
            padding: 16,
            borderRadius: 12
          }}
        >
          <h2>Loop Plan</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

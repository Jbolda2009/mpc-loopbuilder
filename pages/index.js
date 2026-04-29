import { useState } from "react";

const SAMPLE_LIBRARY = {
  kicks: ["/samples/kick1.wav", "/samples/kick2.wav", "/samples/kick3.wav", "/samples/kick4.wav", "/samples/kick5.wav"],
  snares: ["/samples/Snare1.wav", "/samples/Snare2.wav", "/samples/Snare3.wav", "/samples/Snare4.wav", "/samples/Snare5.wav"],
  hats: ["/samples/hat1.wav", "/samples/hat2.wav", "/samples/hat3.wav", "/samples/hat4.wav", "/samples/hat5.wav", "/samples/hat6.wav"],
  claps: ["/samples/Clap1.wav", "/samples/Clap2.wav", "/samples/Clap3.wav", "/samples/Clap4.wav", "/samples/Clap5.wav"],
  bass808: ["/samples/808_1.wav", "/samples/808_2.wav", "/samples/808_3.wav", "/samples/808_4.wav", "/samples/808_5.wav"]
};

const DEFAULT_PATTERN = {
  kick: [0, 3, 7, 10, 14],
  snare: [8],
  clap: [8],
  hat: "eighths",
  bass808: [0, 6, 10]
};

export default function Home() {
  const [prompt, setPrompt] = useState("Hard trap drums 4 bars 83 bpm with 808 bounce");
  const [result, setResult] = useState(null);
  const [bpm, setBpm] = useState(83);
  const [loading, setLoading] = useState(false);
  const [lastSamples, setLastSamples] = useState(null);

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

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getPattern() {
    return {
      kick: result?.drumPattern?.kick || DEFAULT_PATTERN.kick,
      snare: result?.drumPattern?.snare || DEFAULT_PATTERN.snare,
      clap: result?.drumPattern?.clap || DEFAULT_PATTERN.clap,
      hat: result?.drumPattern?.hat || DEFAULT_PATTERN.hat,
      bass808: result?.drumPattern?.bass808 || DEFAULT_PATTERN.bass808
    };
  }

  async function loadSample(ctx, url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Missing file: " + url);
    const arr = await res.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  }

  async function buildLoop(ctx, exportMode = false) {
    const selected = lastSamples || {
      kick: pick(SAMPLE_LIBRARY.kicks),
      snare: pick(SAMPLE_LIBRARY.snares),
      hat: pick(SAMPLE_LIBRARY.hats),
      clap: pick(SAMPLE_LIBRARY.claps),
      bass808: pick(SAMPLE_LIBRARY.bass808)
    };

    if (!lastSamples && !exportMode) setLastSamples(selected);

    const kick = await loadSample(ctx, selected.kick);
    const snare = await loadSample(ctx, selected.snare);
    const hat = await loadSample(ctx, selected.hat);
    const clap = await loadSample(ctx, selected.clap);
    const bass808 = await loadSample(ctx, selected.bass808);

    const bpmVal = Number(result?.bpm || bpm || 140);
    const bars = Number(result?.bars || 4);
    const stepsPerBar = 16;
    const totalSteps = bars * stepsPerBar;
    const secondsPerBeat = 60 / bpmVal;
    const stepTime = secondsPerBeat / 4;
    const start = exportMode ? 0 : ctx.currentTime + 0.1;
    const pattern = getPattern();

    function play(buffer, time, volume = 1, rate = 1) {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(time);
    }

    for (let i = 0; i < totalSteps; i++) {
      let t = start + i * stepTime;
      const pos = i % 16;

      if (i % 2 === 1) t += stepTime * 0.18;

      if (pattern.kick.includes(pos)) play(kick, t, 1);
      if (pattern.snare.includes(pos)) play(snare, t, 0.9);
      if (pattern.clap.includes(pos)) play(clap, t + 0.01, 0.55);

      if (pattern.hat === "eighths") {
        if (i % 2 === 0) play(hat, t, 0.3);
      } else {
        play(hat, t, 0.25);
      }

      if ([3, 7, 11, 15].includes(pos)) play(hat, t + stepTime / 2, 0.18);

      if (pattern.bass808.includes(pos)) {
        const rate = pos === 10 ? 0.9 : 1;
        play(bass808, t, 0.85, rate);
      }
    }

    return { bpmVal, bars, selected };
  }

  async function playAILoop() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const built = await buildLoop(ctx, false);
      setResult((prev) => ({ ...(prev || {}), selectedSamples: built.selected }));
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    let offset = 0;

    function writeString(str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset++, str.charCodeAt(i));
    }

    writeString("RIFF");
    view.setUint32(offset, length - 8, true); offset += 4;
    writeString("WAVE");
    writeString("fmt ");
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, numChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * numChannels * 2, true); offset += 4;
    view.setUint16(offset, numChannels * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString("data");
    view.setUint32(offset, length - offset - 4, true); offset += 4;

    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = buffer.getChannelData(ch)[i];
        sample = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  async function downloadWav() {
    try {
      const bpmVal = Number(result?.bpm || bpm || 140);
      const bars = Number(result?.bars || 4);
      const duration = bars * 4 * (60 / bpmVal) + 1;
      const sampleRate = 44100;
      const offline = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

      await buildLoop(offline, true);
      const rendered = await offline.startRendering();
      const wavBlob = audioBufferToWav(rendered);

      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mpc-loop-${bpmVal}bpm-${bars}bars.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("WAV export error: " + err.message);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "Arial", background: "#0d0d0f", color: "white", minHeight: "100vh" }}>
      <h1>MPC LoopBuilder AI</h1>
      <p>AI-powered MPC loop generator using your real drum samples.</p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Example: hard trap drums 4 bars 83 bpm with 808 bounce"
        style={{ width: "100%", minHeight: 100, padding: 12, borderRadius: 10, fontSize: 16 }}
      />

      <br /><br />

      <button onClick={generateLoop} style={{ padding: 12, marginRight: 10 }}>
        {loading ? "Generating..." : "Generate Loop"}
      </button>

      <button onClick={playAILoop} style={{ padding: 12, marginRight: 10 }}>
        Play AI Loop
      </button>

      <button onClick={downloadWav} style={{ padding: 12 }}>
        Download WAV
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
        <div style={{ marginTop: 20, background: "#18181b", padding: 16, borderRadius: 12 }}>
          <h2>Loop Plan</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

import { useState, useRef } from "react";
import JSZip from "jszip";

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

const NOTE_MAP = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
  "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11
};

function get808PlaybackRate(key = "C") {
  const semitone = NOTE_MAP[key] ?? 0;
  return Math.pow(2, (semitone - 12) / 12);
}

export default function Home() {
  const audioRef = useRef(null);

  const [prompt, setPrompt] = useState("Hard trap drums 4 bars 83 bpm F minor with 808 bounce");
  const [result, setResult] = useState(null);
  const [bpm, setBpm] = useState(83);
  const [loading, setLoading] = useState(false);
  const [barsControl, setBarsControl] = useState(4);
  const [swingControl, setSwingControl] = useState(18);
  const [energy, setEnergy] = useState("medium");
  const [lastSamples, setLastSamples] = useState(null);
  const [lockSounds, setLockSounds] = useState(false);

  const [uploadingStem, setUploadingStem] = useState(false);
  const [stems, setStems] = useState({});
  const [selectedStem, setSelectedStem] = useState("");
  const [selectedStemUrl, setSelectedStemUrl] = useState("");
  const [stemDuration, setStemDuration] = useState(0);
  const [chopStart, setChopStart] = useState(0);
  const [chopEnd, setChopEnd] = useState(4);

  async function generateLoop() {
    setLoading(true);
    if (!lockSounds) setLastSamples(null);

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    setResult(data);

    if (data.bpm) setBpm(Number(data.bpm));
    if (data.bars) setBarsControl(Number(data.bars));

    setLoading(false);
    setTimeout(() => playAILoop(), 250);
  }

  function regenerate() {
    if (!lockSounds) setLastSamples(null);
    setTimeout(() => playAILoop(), 100);
  }

  function makeItHarder() {
    setEnergy("high");
    setSwingControl(22);

    setResult((prev) => {
      const current = prev || {};
      const p = current.drumPattern || DEFAULT_PATTERN;

      return {
        ...current,
        drumPattern: {
          ...p,
          kick: Array.from(new Set([...(p.kick || DEFAULT_PATTERN.kick), 5, 12, 14])).sort((a, b) => a - b),
          snare: p.snare || DEFAULT_PATTERN.snare,
          clap: p.clap || DEFAULT_PATTERN.clap,
          hat: "sixteenths",
          bass808: Array.from(new Set([...(p.bass808 || DEFAULT_PATTERN.bass808), 3, 12, 14])).sort((a, b) => a - b)
        }
      };
    });

    setTimeout(() => playAILoop(), 200);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getSelectedSamples() {
    if (lockSounds && lastSamples) return lastSamples;
    return lastSamples || {
      kick: pick(SAMPLE_LIBRARY.kicks),
      snare: pick(SAMPLE_LIBRARY.snares),
      hat: pick(SAMPLE_LIBRARY.hats),
      clap: pick(SAMPLE_LIBRARY.claps),
      bass808: pick(SAMPLE_LIBRARY.bass808)
    };
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

  async function buildLoop(ctx, exportMode = false, stem = "full") {
    const selected = getSelectedSamples();
    if (!lastSamples && !exportMode) setLastSamples(selected);

    const kick = await loadSample(ctx, selected.kick);
    const snare = await loadSample(ctx, selected.snare);
    const hat = await loadSample(ctx, selected.hat);
    const clap = await loadSample(ctx, selected.clap);
    const bass808 = await loadSample(ctx, selected.bass808);

    const bpmVal = Number(result?.bpm || bpm || 140);
    const bars = Number(barsControl || result?.bars || 4);
    const totalSteps = bars * 16;
    const stepTime = (60 / bpmVal) / 4;
    const start = exportMode ? 0 : ctx.currentTime + 0.1;
    const swingAmount = Number(swingControl) / 100;
    const pattern = getPattern();
    const key = result?.key || "C";
    const base808Rate = get808PlaybackRate(key);
    const energyBoost = energy === "high" ? 1.2 : energy === "low" ? 0.82 : 1;

    function shouldPlay(type) {
      return stem === "full" || stem === type;
    }

    function play(buffer, time, volume = 1, rate = 1) {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      gain.gain.value = volume * energyBoost;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(time);
    }

    for (let i = 0; i < totalSteps; i++) {
      let t = start + i * stepTime;
      const pos = i % 16;
      const bar = Math.floor(i / 16);
      const lastBar = bar === bars - 1;

      if (i % 2 === 1) t += stepTime * swingAmount;
      if ([5, 13].includes(pos)) t += stepTime * 0.025;

      let kickPattern = [...pattern.kick];
      let bassPattern = [...pattern.bass808];

      if (lastBar) {
        if (!kickPattern.includes(12)) kickPattern.push(12);
        if (!bassPattern.includes(14)) bassPattern.push(14);
      }

      if (bar === 1 && energy !== "low" && !kickPattern.includes(5)) kickPattern.push(5);
      if (energy === "high" && !kickPattern.includes(14)) kickPattern.push(14);

      if (shouldPlay("kick") && kickPattern.includes(pos)) play(kick, t, lastBar && pos === 14 ? 0.78 : 1);
      if (shouldPlay("snare") && pattern.snare.includes(pos)) play(snare, t, 0.9);
      if (shouldPlay("snare") && pattern.clap.includes(pos)) play(clap, t + 0.012, 0.55);

      if (shouldPlay("hats")) {
        if (pattern.hat === "eighths") {
          if (i % 2 === 0) play(hat, t, pos % 4 === 0 ? 0.34 : 0.24);
        } else {
          play(hat, t, 0.25);
        }

        if (energy !== "low" && [2, 6, 10, 14].includes(pos)) play(hat, t + stepTime * 0.48, 0.12);
        if ([3, 7, 11, 15].includes(pos)) play(hat, t + stepTime / 2, 0.17);

        if ((lastBar || energy === "high") && [14, 15].includes(pos)) {
          play(hat, t + stepTime / 3, 0.13);
          play(hat, t + (stepTime * 2) / 3, 0.11);
        }
      }

      if (shouldPlay("808") && bassPattern.includes(pos)) {
        let rate = base808Rate;
        if (pos === 3) rate = base808Rate * Math.pow(2, 2 / 12);
        if (pos === 6) rate = base808Rate * Math.pow(2, 3 / 12);
        if (pos === 10) rate = base808Rate * Math.pow(2, 5 / 12);
        if (pos === 14) rate = base808Rate * Math.pow(2, 7 / 12);
        play(bass808, t, 0.92, rate);
      }
    }

    return { bpmVal, bars, selected };
  }

  async function playAILoop() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const built = await buildLoop(ctx, false, "full");
      setResult((prev) => ({
        ...(prev || {}),
        selectedSamples: built.selected,
        controls: { bars: barsControl, swing: swingControl, energy, lockSounds }
      }));
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

  async function downloadWav(stem = "full") {
    try {
      const bpmVal = Number(result?.bpm || bpm || 140);
      const bars = Number(barsControl || result?.bars || 4);
      const duration = bars * 4 * (60 / bpmVal) + 1;
      const sampleRate = 44100;
      const offline = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

      await buildLoop(offline, true, stem);

      const rendered = await offline.startRendering();
      const wavBlob = audioBufferToWav(rendered);

      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mpc-${stem}-${result?.key || "C"}-${bpmVal}bpm-${bars}bars.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("WAV export error: " + err.message);
    }
  }

  async function uploadAndSeparate(file) {
    if (!file) return;

    try {
      setUploadingStem(true);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${process.env.NEXT_PUBLIC_STEM_API}/separate`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        alert("Stem separation failed. Try a shorter file.");
        setUploadingStem(false);
        return;
      }

      const zipBlob = await res.blob();
      const zip = await JSZip.loadAsync(zipBlob);

      const loaded = {};
      for (const name of ["vocals.wav", "drums.wav", "bass.wav", "other.wav"]) {
        if (zip.files[name]) {
          const blob = await zip.files[name].async("blob");
          loaded[name.replace(".wav", "")] = {
            blob,
            url: URL.createObjectURL(blob)
          };
        }
      }

      setStems(loaded);

      if (loaded.drums) {
        setSelectedStem("drums");
        setSelectedStemUrl(loaded.drums.url);
      } else {
        const first = Object.keys(loaded)[0];
        setSelectedStem(first);
        setSelectedStemUrl(loaded[first].url);
      }

      setUploadingStem(false);
    } catch (err) {
      alert("Stem error: " + err.message);
      setUploadingStem(false);
    }
  }

  function selectStem(name) {
    setSelectedStem(name);
    setSelectedStemUrl(stems[name].url);
    setChopStart(0);
    setChopEnd(Math.min(4, stemDuration || 4));
  }

  function onStemLoaded() {
    const d = audioRef.current?.duration || 0;
    setStemDuration(d);
    setChopStart(0);
    setChopEnd(Math.min(4, d));
  }

  function playChop() {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Number(chopStart);
    audio.play();

    const stopAt = Number(chopEnd);
    const timer = setInterval(() => {
      if (audio.currentTime >= stopAt) {
        audio.pause();
        clearInterval(timer);
      }
    }, 50);
  }

  async function downloadChop() {
    if (!selectedStem || !stems[selectedStem]) return;

    try {
      const ctx = new OfflineAudioContext(2, 44100 * Math.max(1, chopEnd - chopStart), 44100);
      const arr = await stems[selectedStem].blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arr.slice(0));

      const startSample = Math.floor(chopStart * decoded.sampleRate);
      const endSample = Math.floor(chopEnd * decoded.sampleRate);
      const length = Math.max(1, endSample - startSample);

      const chopBuffer = new AudioContext().createBuffer(
        decoded.numberOfChannels,
        length,
        decoded.sampleRate
      );

      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const source = decoded.getChannelData(ch).slice(startSample, endSample);
        chopBuffer.copyToChannel(source, ch);
      }

      const wavBlob = audioBufferToWav(chopBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chop-${selectedStem}-${chopStart.toFixed(2)}-${chopEnd.toFixed(2)}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Chop export error: " + err.message);
    }
  }

  async function exportMpcKitZip() {
    try {
      const selected = getSelectedSamples();
      const zip = new JSZip();
      const folder = zip.folder("MPC_LoopBuilder_Kit");

      async function addFileToZip(path, name) {
        const res = await fetch(path);
        if (!res.ok) throw new Error("Missing file: " + path);
        const blob = await res.blob();
        folder.file(name, blob);
      }

      await addFileToZip(selected.kick, "kick.wav");
      await addFileToZip(selected.snare, "snare.wav");
      await addFileToZip(selected.hat, "hat.wav");
      await addFileToZip(selected.clap, "clap.wav");
      await addFileToZip(selected.bass808, "808.wav");

      folder.file("kit-info.json", JSON.stringify({
        app: "MPC LoopBuilder AI",
        bpm,
        bars: barsControl,
        swing: swingControl,
        energy,
        lockSounds,
        prompt,
        loopPlan: result,
        selectedSamples: selected
      }, null, 2));

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mpc-kit-${result?.key || "C"}-${bpm}bpm.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("MPC Kit ZIP error: " + err.message);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "Arial", background: "#0d0d0f", color: "white", minHeight: "100vh" }}>
      <h1>MPC LoopBuilder AI</h1>
      <p>AI-powered MPC loop generator, stem separator, and chop editor.</p>

      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ width: "100%", minHeight: 100, padding: 12, borderRadius: 10, fontSize: 16 }} />

      <br /><br />

      <button onClick={generateLoop} style={{ padding: 12, marginRight: 10 }}>{loading ? "Generating..." : "Generate Loop"}</button>
      <button onClick={regenerate} style={{ padding: 12, marginRight: 10 }}>Regenerate</button>
      <button onClick={playAILoop} style={{ padding: 12, marginRight: 10 }}>Play AI Loop</button>
      <button onClick={makeItHarder} style={{ padding: 12, marginRight: 10 }}>Make It Harder 🔥</button>
      <button onClick={() => downloadWav("full")} style={{ padding: 12, marginRight: 10 }}>Download Full Mix</button>
      <button onClick={exportMpcKitZip} style={{ padding: 12 }}>Export MPC Kit ZIP</button>

      <br /><br />

      <label style={{ display: "inline-block", padding: 12, background: lockSounds ? "#facc15" : "#eee", color: "#111", marginRight: 10 }}>
        <input type="checkbox" checked={lockSounds} onChange={(e) => setLockSounds(e.target.checked)} style={{ marginRight: 8 }} />
        Lock Sounds
      </label>

      <label style={{ display: "inline-block", padding: 12, background: "#22c55e", color: "#111", marginTop: 10 }}>
        {uploadingStem ? "Separating Stems..." : "Upload Song → Separate Stems"}
        <input type="file" accept="audio/*" style={{ display: "none" }} onChange={(e) => uploadAndSeparate(e.target.files?.[0])} />
      </label>

      <h3>BPM: {bpm}</h3>
      <input type="range" min="60" max="180" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} style={{ width: "100%" }} />

      <h3>Bars: {barsControl}</h3>
      <button onClick={() => setBarsControl(4)} style={{ padding: 10, marginRight: 8 }}>4 Bars</button>
      <button onClick={() => setBarsControl(8)} style={{ padding: 10 }}>8 Bars</button>

      <h3>Swing: {swingControl}%</h3>
      <input type="range" min="0" max="35" value={swingControl} onChange={(e) => setSwingControl(Number(e.target.value))} style={{ width: "100%" }} />

      <h3>Energy: {energy}</h3>
      <button onClick={() => setEnergy("low")} style={{ padding: 10, marginRight: 8 }}>Low</button>
      <button onClick={() => setEnergy("medium")} style={{ padding: 10, marginRight: 8 }}>Medium</button>
      <button onClick={() => setEnergy("high")} style={{ padding: 10 }}>High</button>

      <h2>Stem Export</h2>
      <button onClick={() => downloadWav("kick")} style={{ padding: 10, marginRight: 8 }}>Kick WAV</button>
      <button onClick={() => downloadWav("snare")} style={{ padding: 10, marginRight: 8 }}>Snare/Clap WAV</button>
      <button onClick={() => downloadWav("hats")} style={{ padding: 10, marginRight: 8 }}>Hats WAV</button>
      <button onClick={() => downloadWav("808")} style={{ padding: 10 }}>808 WAV</button>

      {Object.keys(stems).length > 0 && (
        <div style={{ marginTop: 30, background: "#18181b", padding: 16, borderRadius: 12 }}>
          <h2>Chop Editor</h2>

          {Object.keys(stems).map((name) => (
            <button key={name} onClick={() => selectStem(name)} style={{ padding: 10, marginRight: 8, background: selectedStem === name ? "#facc15" : "#eee" }}>
              {name}
            </button>
          ))}

          <br /><br />

          <audio ref={audioRef} controls src={selectedStemUrl} onLoadedMetadata={onStemLoaded} style={{ width: "100%" }} />

          <h3>Start: {Number(chopStart).toFixed(2)} sec</h3>
          <input type="range" min="0" max={stemDuration} step="0.01" value={chopStart} onChange={(e) => setChopStart(Number(e.target.value))} style={{ width: "100%" }} />

          <h3>End: {Number(chopEnd).toFixed(2)} sec</h3>
          <input type="range" min="0" max={stemDuration} step="0.01" value={chopEnd} onChange={(e) => setChopEnd(Number(e.target.value))} style={{ width: "100%" }} />

          <button onClick={playChop} style={{ padding: 12, marginRight: 10 }}>Preview Chop</button>
          <button onClick={downloadChop} style={{ padding: 12 }}>Download Chop WAV</button>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20, background: "#18181b", padding: 16, borderRadius: 12 }}>
          <h2>Loop Plan</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
                                         }

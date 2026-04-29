import { useState } from "react";

export default function Home() {
  const [bpm, setBpm] = useState(90);

  function playLoop() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const duration = 4 * (60 / bpm); // 4 beats
    const sampleRate = audioCtx.sampleRate;
    const frameCount = sampleRate * duration;

    const buffer = audioCtx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;

      // simple sine wave tone
      data[i] = Math.sin(2 * Math.PI * 220 * t) * 0.2;

      // add kick on beat
      if (Math.floor(t * bpm / 60) % 4 === 0) {
        data[i] += Math.sin(2 * Math.PI * 60 * t) * 0.5;
      }
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>MPC LoopBuilder</h1>
      <p>BPM: {bpm}</p>

      <input
        type="range"
        min="60"
        max="160"
        value={bpm}
        onChange={(e) => setBpm(e.target.value)}
        style={{ width: "100%" }}
      />

      <br /><br />

      <button onClick={playLoop}>
        Play Loop
      </button>
    </div>
  );
}

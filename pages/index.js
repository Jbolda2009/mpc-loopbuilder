import { useState } from "react";

export default function Home() {
  const [bpm, setBpm] = useState(90);

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

      <button onClick={() => alert("Loop working!")}>
        Play Loop
      </button>
    </div>
  );
}

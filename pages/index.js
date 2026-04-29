import { useState } from "react";

export default function Home() {
  const [bpm, setBpm] = useState(90);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState(null);

  async function generateLoop() {
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

      <br />
      <br />

      <button onClick={generateLoop}>Generate Loop</button>

      <br />
      <br />

      <p>BPM: {bpm}</p>

      <input
        type="range"
        min="60"
        max="160"
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

export default async function handler(req, res) {
  try {
    const { prompt } = req.body;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are an expert music producer and loop designer. Return only valid JSON for an MPC-ready loop."
          },
          {
            role: "user",
            content: `Create an MPC-ready loop plan from this request: ${prompt}

Return JSON with:
bpm, key, scale, genre, instrument, mood, bars, drumPattern, bassPattern, melodyPattern, chordProgression, bounce, soundNotes.

Use modern producer language. Keep bars either 4 or 8 unless user asks otherwise.`
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: "OpenAI error", full: data });
    }

    const text = data.choices?.[0]?.message?.content || "{}";
    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    return res.status(500).json({ error: "Server crash", details: err.message });
  }
}

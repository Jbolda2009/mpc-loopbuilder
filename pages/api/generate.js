export default async function handler(req, res) {
  try {
    const { prompt } = req.body;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an expert modern music producer. Return only valid JSON for an MPC-ready drum loop."
          },
          {
            role: "user",
            content: `Create a modern drum loop plan from this request: ${prompt}

Return JSON exactly with:
{
  "bpm": number,
  "key": "C",
  "scale": "minor",
  "genre": "trap",
  "mood": "dark",
  "bars": 4,
  "drumPattern": {
    "kick": [0,3,7,10,14],
    "snare": [8],
    "clap": [8],
    "hat": "eighths",
    "bass808": [0,6,10]
  },
  "soundNotes": "short producer notes"
}

The drum step grid is 16 steps per bar. Use numbers 0 through 15 only.`
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: "OpenAI error",
        full: data
      });
    }

    const text = data.choices?.[0]?.message?.content || "{}";
    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    return res.status(500).json({
      error: "Server crash",
      details: err.message
    });
  }
}

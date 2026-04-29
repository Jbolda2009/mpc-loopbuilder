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
        messages: [
          {
            role: "system",
            content: "You are a music loop generator. Always return ONLY valid JSON."
          },
          {
            role: "user",
            content: `Create loop settings from this request: ${prompt}

Return JSON exactly like:
{
  "bpm": 140,
  "key": "F",
  "scale": "minor",
  "style": "trap",
  "instrument": "guitar"
}`
          }
        ]
      })
    });

    const data = await response.json();

    const text = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    res.status(200).json(parsed);

  } catch (err) {
    res.status(500).json({
      error: "AI request failed",
      details: err.message
    });
  }
}

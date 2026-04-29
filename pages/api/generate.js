export default async function handler(req, res) {
  try {
    const { prompt } = req.body;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: `Return ONLY JSON like this:
{
  "bpm": number,
  "key": "F",
  "scale": "minor",
  "style": "trap",
  "instrument": "guitar"
}

User request: ${prompt}`
      })
    });

    const data = await response.json();

    const text = data.output[0].content[0].text;

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    res.status(200).json(parsed);

  } catch (err) {
    res.status(500).json({ error: "AI request failed", details: err.message });
  }
}

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
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You are a music loop generator. Always respond ONLY with valid JSON."
          },
          {
            role: "user",
            content: `Convert this into loop settings:

${prompt}

Return ONLY JSON in this format:
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

    // 🔥 Log full response for debugging
    console.log("OPENAI RESPONSE:", JSON.stringify(data, null, 2));

    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      return res.status(500).json({
        error: "No response from AI",
        full: data
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({
      error: "Server crash",
      details: err.message
    });
  }
}

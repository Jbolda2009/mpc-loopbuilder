export const config = {
  api: {
    bodyParser: false
  }
};

async function bufferFromStream(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function getBoundary(contentType = "") {
  const match = contentType.match(/boundary=(.+)$/);
  return match ? match[1] : null;
}

function parseMultipart(buffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(boundaryBuffer);

  while (start !== -1) {
    const next = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    if (next === -1) break;

    const part = buffer.slice(start + boundaryBuffer.length + 2, next - 2);
    parts.push(part);
    start = next;
  }

  for (const part of parts) {
    const sep = part.indexOf(Buffer.from("\r\n\r\n"));
    if (sep === -1) continue;

    const header = part.slice(0, sep).toString();
    const body = part.slice(sep + 4);

    if (header.includes('name="audio"')) {
      const filenameMatch = header.match(/filename="([^"]+)"/);
      const typeMatch = header.match(/Content-Type: ([^\r\n]+)/);

      return {
        filename: filenameMatch ? filenameMatch[1] : "upload.wav",
        type: typeMatch ? typeMatch[1] : "audio/wav",
        body
      };
    }
  }

  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    const contentType = req.headers["content-type"] || "";
    const boundary = getBoundary(contentType);

    if (!boundary) {
      return res.status(400).json({ error: "Missing upload boundary" });
    }

    const rawBuffer = await bufferFromStream(req);
    const file = parseMultipart(rawBuffer, boundary);

    if (!file) {
      return res.status(400).json({ error: "No audio file found" });
    }

    const audioBlob = new Blob([file.body], { type: file.type });
    const formData = new FormData();

    formData.append("file", audioBlob, file.filename);
    formData.append("model", "gpt-4o-mini-transcribe");
    formData.append(
      "prompt",
      "This is a music beat or loop. Listen for style, rhythm, tempo clues, drums, bass, and musical feel."
    );

    const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    const transcription = await transcriptionResponse.json();

    if (!transcriptionResponse.ok) {
      return res.status(500).json({
        error: "Audio transcription failed",
        full: transcription
      });
    }

    const transcript = transcription.text || "Instrumental audio with no clear lyrics.";

    const ideaResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
              "You are an expert producer. Create MPC-ready drum ideas from uploaded beat descriptions. Return only valid JSON."
          },
          {
            role: "user",
            content: `Analyze this uploaded beat/transcription and create a matching drum loop idea.

Audio transcription / description:
${transcript}

Return JSON exactly like this:
{
  "promptSuggestion": "short prompt the user can use",
  "bpm": 83,
  "key": "F",
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
  "producerNotes": "what to add and why"
}

Use only numbers 0 through 15 in drumPattern arrays.`
          }
        ]
      })
    });

    const ideaData = await ideaResponse.json();

    if (!ideaResponse.ok) {
      return res.status(500).json({
        error: "AI idea generation failed",
        full: ideaData,
        transcript
      });
    }

    const text = ideaData.choices?.[0]?.message?.content || "{}";
    const idea = JSON.parse(text);

    return res.status(200).json({
      transcript,
      ...idea
    });
  } catch (err) {
    return res.status(500).json({
      error: "Analyze audio server crash",
      details: err.message
    });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const myKey = process.env.GEMINI_API_KEY;
  if (!myKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const prompt = body && body.prompt;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }
  if (prompt.length > 20000) {
    return res.status(400).json({ error: 'prompt too long' });
  }

  try {
    const encodedKey = encodeURIComponent(myKey);
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodedKey;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    });

    if (!r.ok) {
      if (r.status === 429) {
        return res.status(429).json({ error: 'Daily quota reached' });
      }
      return res.status(502).json({ error: 'AI generation failed (' + r.status + ')' });
    }

    const data = await r.json();
    if (!data.candidates || !data.candidates[0]) {
      return res.status(502).json({ error: 'Empty response' });
    }
    const text = data.candidates[0].content.parts.map(function(p) { return p.text || ''; }).join('').trim();
    return res.status(200).json({ text: text });
  } catch (e) {
    return res.status(500).json({ error: 'Server error: ' + (e.message || String(e)) });
  }
}

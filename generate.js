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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEYが設定されていません' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { prompt } = body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'promptが必要です' });
  }
  if (prompt.length > 20000) {
    return res.status(400).json({ error: 'promptが長すぎます' });
  }

  try {
    const encodedKey = encodeURIComponent(apiKey);
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodedKey;
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
        return res.status(429).json({ error: '本日の利用上限に達しました' });
      }
      return res.status(502).json({ error: 'AI生成失敗 (' + r.status + ')' });
    }

    const data = await r.json();
    if (!data.candidates || !data.candidates[0]) {
      return res.status(502).json({ error: '応答が空です' });
    }
    const text = data.candidates[0].content.parts.map(p => p.text || '').join('').trim();
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: 'サーバーエラー: ' + (e.message || String(e)) });
  }
}

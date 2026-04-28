// Vercel Serverless Function: Gemini APIプロキシ
// APIキーはサーバー側の環境変数 GEMINI_API_KEY に保存し、利用者には公開しない

export default async function handler(req, res) {
  // CORS（同一オリジンなら不要だが念のため）
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
    return res.status(500).json({
      error: 'サーバー設定エラー: GEMINI_API_KEYが設定されていません。Vercelの環境変数を確認してください。'
    });
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

  // 簡易レート制限：プロンプトが極端に長い場合は弾く（無料枠保護）
  if (prompt.length > 20000) {
    return res.status(400).json({ error: 'promptが長すぎます（20,000文字制限）' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const geminiBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody)
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('Gemini API error:', r.status, errText);
      // 無料枠超過の場合
      if (r.status === 429) {
        return res.status(429).json({
          error: '本日の利用上限に達しました。しばらく時間をおいてお試しください。'
        });
      }
      return res.status(502).json({
        error: 'AI生成に失敗しました（Gemini API ' + r.status + '）。しばらく経ってから再度お試しください。'
      });
    }

    const data = await r.json();
    if (!data.candidates || !data.candidates[0]) {
      return res.status(502).json({
        error: '応答が空です。入力内容を見直して再度お試しください。'
      });
    }

    const text = data.candidates[0].content.parts.map(p => p.text || '').join('').trim();
    return res.status(200).json({ text });
  } catch (e) {
    console.error('Server error:', e);
    return res.status(500).json({ error: 'サーバーエラー: ' + (e.message || String(e)) });
  }
}

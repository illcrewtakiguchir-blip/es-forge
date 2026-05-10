// Vercel Serverless Function: Gemini APIプロキシ
// APIキーはサーバー側の環境変数 GEMINI_API_KEY に保存し、利用者には公開しない

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // デバッグ用: GET /api/generate?debug=models で利用可能モデル一覧を返す
  if (req.method === 'GET' && req.query && req.query.debug === 'models') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'no api key' });
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'サーバー設定エラー: GEMINI_API_KEYが設定されていません。'
    });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { prompt, mode } = body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'promptが必要です' });
  }
  if (prompt.length > 30000) {
    return res.status(400).json({ error: 'promptが長すぎます（30,000文字制限）' });
  }

  // mode: 'skeleton' は構造化出力(JSON)、'expand' は文章生成
  const isSkeleton = mode === 'skeleton';

  try {
    // gemini-2.0-flash-lite: 無料枠あり。2.0-flashは無料枠0、1.5系はこのアカウントで利用不可のため。
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`;
    const geminiBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: isSkeleton ? 0.4 : 0.65,
        maxOutputTokens: isSkeleton ? 1500 : 2200,
        ...(isSkeleton ? { responseMimeType: 'application/json' } : {})
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
      if (r.status === 429) {
        return res.status(429).json({
          error: '利用上限に達しました（429）。RPM(15req/分)かRPD(1500req/日)の制限です。',
          detail: errText.substring(0, 800)
        });
      }
      return res.status(502).json({
        error: `AI生成に失敗しました（Gemini API ${r.status}）`,
        detail: errText.substring(0, 800)
      });
    }

    const data = await r.json();
    if (!data.candidates || !data.candidates[0]) {
      return res.status(502).json({ error: '応答が空です。入力内容を見直して再度お試しください。' });
    }

    const text = data.candidates[0].content.parts.map(p => p.text || '').join('').trim();
    return res.status(200).json({ text });
  } catch (e) {
    console.error('Server error:', e);
    return res.status(500).json({ error: 'サーバーエラー: ' + (e.message || String(e)) });
  }
}

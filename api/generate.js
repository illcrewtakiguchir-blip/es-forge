// Vercel Serverless Function: Anthropic Claude API プロキシ
// 必須環境変数: ANTHROPIC_API_KEY を Vercel の Settings → Environment Variables に追加
const MODEL = 'claude-haiku-4-5';
const ANTHROPIC_VERSION = '2023-06-01';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'サーバー設定エラー: ANTHROPIC_API_KEY が設定されていません。Vercel の Environment Variables に追加してください。'
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

  // mode mapping:
  // 'all'      → JSON出力（骨子+4本文）、高max_tokens
  // 'skeleton' → JSON出力（経験棚卸し候補3つ）
  // 'expand'   → テキスト出力（単一文字数の生成・改善）
  const wantsJson = mode === 'all' || mode === 'skeleton';
  const maxTokens = mode === 'all' ? 8192 : 4096;
  // 業界トーンを反映するためexpandは少し高めの温度。JSONは構造一貫性のため低め。
  const temperature = wantsJson ? 0.4 : 0.7;

  try {
    const anthropicBody = {
      model: MODEL,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'user', content: prompt }
      ]
    };

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json'
      },
      body: JSON.stringify(anthropicBody)
    });

    const data = await r.json();

    if (!r.ok) {
      const errMessage = data?.error?.message || 'Anthropic API error';
      const errType = data?.error?.type || 'unknown';
      const requestId = data?.request_id;
      console.error('Anthropic API error:', r.status, errType, errMessage);

      if (r.status === 429) {
        const retryAfter = parseFloat(r.headers.get('retry-after') || '0');
        return res.status(429).json({
          error: `レート制限に達しました${retryAfter ? `（${Math.ceil(retryAfter)}秒後に再試行可能）` : ''}`,
          type: errType,
          detail: errMessage,
          retryAfter,
          requestId
        });
      }
      if (r.status === 401) {
        return res.status(401).json({
          error: 'ANTHROPIC_API_KEY が無効です。Vercel の設定を確認してください',
          detail: errMessage,
          requestId
        });
      }
      if (r.status === 529 || r.status >= 500) {
        return res.status(502).json({
          error: `Claude API サーバーエラー (${r.status})。少し待って再試行してください`,
          type: errType,
          detail: errMessage.substring(0, 500),
          requestId
        });
      }
      return res.status(r.status).json({
        error: `Claude API エラー (${r.status})`,
        type: errType,
        detail: errMessage.substring(0, 800),
        requestId
      });
    }

    // Extract text from content blocks
    if (!data.content || !Array.isArray(data.content)) {
      return res.status(502).json({
        error: '応答にcontentが含まれていません',
        detail: JSON.stringify(data).substring(0, 500)
      });
    }
    const textBlock = data.content.find(b => b.type === 'text');
    if (!textBlock || !textBlock.text) {
      return res.status(502).json({
        error: '応答にtextブロックが含まれていません',
        detail: `stop_reason: ${data.stop_reason}`
      });
    }
    const text = textBlock.text.trim();

    // stop_reason check
    if (data.stop_reason === 'max_tokens') {
      console.warn('Output truncated at max_tokens. Consider increasing limit.');
    }
    if (data.stop_reason === 'refusal') {
      return res.status(200).json({
        text,
        warning: '安全性のため一部内容を返答しませんでした',
        stop_reason: 'refusal'
      });
    }

    return res.status(200).json({ text, usage: data.usage });
  } catch (e) {
    console.error('Server error:', e);
    return res.status(500).json({ error: 'サーバーエラー: ' + (e.message || String(e)) });
  }
}

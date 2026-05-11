# ES Forge

就活生向けのガクチカ自動生成ツール。Anthropic Claude Haiku 4.5 + Vercel で動作。

## 機能

- 5ステップ対話形式（業界 → 経験 → 成果 → 構成要素入力 → 生成）
- 200/400/600/800字を**並列**生成
- 2段階生成パイプライン（論理骨子JSON → 文字数別展開）
- 業界別プロンプト辞書（5業界の文体トーン制御）
- 文字数±10字を最大4回リトライ
- 生成結果のコピー・再生成・ダウンロード対応

## アーキテクチャ

```
利用者ブラウザ → Vercel /api/generate → Google Gemini API
                       ↑ APIキーは環境変数 GEMINI_API_KEY に隠蔽
```

## ファイル構成

```
es-forge/
├── api/generate.js     # Vercel Serverless Function（Geminiプロキシ）
├── public/index.html   # フロントエンドUI（5ステップ対話＋生成）
├── package.json
├── vercel.json
└── README.md
```

## デプロイ手順

### 1. Gemini APIキー取得（無料・クレカ不要）

1. https://aistudio.google.com/app/apikey にアクセス
2. 「Create API key」→ 新規プロジェクトで作成
3. `AIzaSy...` で始まるキーをコピー

### 2. GitHub に push

このリポジトリ自体です。

### 3. Vercel にデプロイ

1. https://vercel.com にログイン → Add New → Project
2. このGitHubリポジトリを Import
3. **Environment Variables** に以下を追加：
   - Name: `GEMINI_API_KEY`
   - Value: 取得したAPIキー（AIzaSy...）
4. Deploy

### 4. 動作確認

発行されたURL（例: `es-forge-xxx.vercel.app`）にアクセスして、5ステップ進めてES生成。

## 利用上限

Gemini 2.0 Flash 無料枠: **1日 1,500 リクエスト**
- 1人あたり 1骨子 + 4本文 = 5リクエスト
- → **1日 約300人** まで無料で対応可能

それ以上はその日のみ停止し、翌日0時にリセット。

## カスタマイズ

### 業界トーンの変更

`public/index.html` の `INDUSTRY_TONE` オブジェクトを編集：

```javascript
INDUSTRY_TONE.consulting.prefer = ['構造化', '要因分解', ...];
INDUSTRY_TONE.consulting.avoid = ['頑張った', ...];
```

### プロンプトの変更

`buildSkeletonPrompt()` と `buildExpandPrompt()` 関数を編集。

GitHub にpushすればVercelが自動で再デプロイします。

## ライセンス

Private use only.

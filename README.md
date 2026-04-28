# ES Forge — Vercelデプロイ手順書

ガクチカES自動生成ツール。論理一貫性を担保した200/400/600/800字を同時生成。

## 完成後の利用フロー（利用者視点）

利用者は配布されたURL（例：`es-forge.vercel.app`）にアクセスするだけ。APIキーの取得や登録は一切不要。5ステップのウィザードに従って入力すると、4文字数のESが同時生成される。

## デプロイ手順（10ステップ）

### 一つ目：Gemini APIキーを取得

1. [Google AI Studio](https://aistudio.google.com/app/apikey) を開く
2. Googleアカウントでログイン
3. 「Create API Key」をクリック
4. 発行されたキー（`AIzaSy...`で始まる文字列）をコピーして保管

無料枠は1日1,500リクエスト、クレジットカード登録不要。

### 二つ目：このプロジェクト一式をダウンロード

このフォルダ全体（`es-forge/`）をローカルに保存する。

### 三つ目：GitHubリポジトリを作成

1. [GitHub](https://github.com) にログイン
2. 右上「+」→「New repository」
3. リポジトリ名：`es-forge`（任意）
4. Private（非公開）を推奨
5. 「Create repository」をクリック

### 四つ目：プロジェクト一式をアップロード

GitHubのリポジトリ画面で「uploading an existing file」をクリック。`es-forge/`フォルダの中身（`api/`, `public/`, `package.json`, `vercel.json`, `README.md`）をドラッグ＆ドロップ。「Commit changes」をクリック。

### 五つ目：Vercelにログイン

[Vercel](https://vercel.com) にGitHubアカウントでサインアップ／ログイン。

### 六つ目：プロジェクトをImport

1. 「Add New...」→「Project」をクリック
2. GitHubリポジトリ一覧から`es-forge`を選択
3. 「Import」をクリック

### 七つ目：環境変数を設定

「Configure Project」画面で **Environment Variables** セクションを展開：

- **Name**: `GEMINI_API_KEY`
- **Value**: ステップ1で取得したAPIキー（`AIzaSy...`）

「Add」を押して追加。

### 八つ目：Deploy

「Deploy」ボタンをクリック。1〜2分でビルドが完了。

### 九つ目：URLを確認

デプロイ完了画面に発行されたURL（例：`https://es-forge-xxx.vercel.app`）が表示される。クリックして動作確認。

### 十つ目：URLを配布

利用者にこのURLを共有すればOK。利用者は何もせずに使える。

## 独自ドメインの設定（任意）

Vercelダッシュボード → プロジェクト → Settings → Domains から、独自ドメインを追加可能。

## 利用上限について

Gemini無料枠は **1日1,500リクエスト**。1人の利用者がESを1セット生成すると、骨子1回＋4文字数（最大5回リトライ）で平均5〜10リクエスト消費する。つまり**1日150〜300人程度**が目安。

無料枠を超えた場合、その日は生成できなくなる（翌日0時にリセット）。

利用者数が増えてきた場合は、Vercelの環境変数で**複数のAPIキーをラウンドロビン**する仕組みを後から追加することも可能。

## ファイル構成

```
es-forge/
├── api/
│   └── generate.js     # Vercelサーバーレス関数（Geminiプロキシ）
├── public/
│   └── index.html      # 利用者向けUI
├── package.json        # 依存関係（実質なし）
├── vercel.json         # Vercel設定（タイムアウト60秒）
└── README.md           # この手順書
```

## トラブルシューティング

### 「サーバー設定エラー: GEMINI_API_KEYが設定されていません」と表示される

Vercelの環境変数 `GEMINI_API_KEY` が正しく設定されていない。Vercelダッシュボード → プロジェクト → Settings → Environment Variables で確認。設定後はもう一度Deployし直す必要がある（Redeploy）。

### 「本日の利用上限に達しました」と表示される

Gemini無料枠の1日1,500リクエスト制限に達した。翌日0時にリセットされる。

### 生成が遅い・タイムアウトする

`vercel.json`で関数の最大実行時間を60秒に設定済み。これ以上長くしたい場合はVercelの有料プランが必要（無料プランは10秒制限の場合あり、ただしHobbyプランで60秒まで対応可）。

### ESの精度を改善したい

`public/index.html`の`INDUSTRY_TONE`オブジェクトに業界別のトーン指示が記述されている。語彙や避ける表現を編集してGitHubにpushすると、Vercelが自動で再デプロイする。

## ライセンス

個人利用・商用利用可。

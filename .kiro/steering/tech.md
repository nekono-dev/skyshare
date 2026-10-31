# Technology Stack

## Architecture

Astro（SSR）を Cloudflare Workers で動かす。画面は Astro のページと React の島（`client:load`）で作り、利用者向けの API は `src/pages/v2/` の Astro エンドポイント（`APIRoute`）として実装する。Workers の定期実行（`scheduled`）は `src/worker.ts` で受け、予約投稿とアンケートの保持期限の後片付けを行う。

- 永続化: D1（`migrations/` の SQL。予約・予約用の認可・アンケートの 2 表）と R2（予約の添付画像）
- 外部: Bluesky の PDS・AppView・認可サーバー、OGP 抽出サービス、旧バックエンド（pageDB）、GitHub API（Issue 作成）
- 生成物: `scripts/build-openapi-document.ts` が OpenAPI を作り、`orval` が `src/client/openapi/` のクライアントを作る（手で編集しない）

## Core Technologies

- **Language**: TypeScript（`astro/tsconfigs/strict`、`paths` の `@/*` → `src/*`）
- **Framework**: Astro 7（`@astrojs/cloudflare`、`@astrojs/react`）、React 19
- **Runtime**: Cloudflare Workers（`compatibility_flags: nodejs_compat`）
- **Validation**: zod（`src/lib/api/schema/` に endpoint ごとのスキーマ）、zod-openapi

## Key Libraries

- `@atproto/api`・`@atproto/lex-cbor`・`@atproto/xrpc`: Bluesky の API。予約の実行（Cron）からは読み込まない（後述）
- `twitter-text`・`tlds`: 文字数とリンクの扱い
- `react-easy-crop`・`hls.js`: 画像の切り抜きと動画の再生
- `multiformats`: CID の計算

## Development Standards

### Type Safety

- strict。`noImplicitAny` は無効（`tsconfig.json`）。
- API の入出力は zod で検証し、型はスキーマから得る。

### Code Quality

- Prettier。`.prettierrc` は `.ts` と `.astro` の tabWidth を 4、ほかは 2 と定める。セミコロンなし、`arrowParens: avoid`。
- 各モジュールの先頭に日本語の JSDoc を置き、「責務と処理概要」「実装上の制約」を書く（既存コードの共通の書き方）。

### Workers 固有の制約（コードに現れている規則）

- Cron の経路と、全リクエストで読み込むミドルウェアには `@atproto/*` を静的に import しない。WebCrypto と fetch だけで実装する（`src/lib/schedule/executor.ts`、`src/lib/session/bskySessionRefresh.ts`）。
- `src/lib/api/schema/**` は生成ツールから相対 import されるため、`@/` エイリアスに依存する大きなモジュールを読ませない。共有する定数は依存のない小さなファイルに置く（`src/lib/atproto/threadLimit.ts`）。
- トークン・鍵・認可コード・応答の本文はログに出さない。セッション関連の応答は `cache-control: no-store`。

## Development Environment

### Required Tools

- Node.js と npm。`prepare` で `.githooks` を `core.hooksPath` に設定する。`@atproto/api` のパッチは持たない（削除済み）。
- Wrangler（D1・R2・Cron・Rate Limiter のローカル確認）

### Common Commands

```bash
# 型生成（OpenAPI → クライアント）
npm run codegen
# 開発サーバー（HTTPS。事前にアンケート設定の描画とローカル環境の準備を行う）
npm run dev
# 本番ビルド（運用者の値が欠けていれば止まる）
npm run build
```

## Testing

テストの方針の正本は [testing.md](testing.md)（草案）。ここには現在の設定の観察だけを置く。

- 現在の設定: 層ごとの Vitest 設定（`config/test/vitest.unit.config.ts`・`config/test/vitest.component.config.ts`・`config/test/vitest.route.config.ts`・`config/test/vitest.astro.config.ts`・`config/test/vitest.live.config.ts`）、Playwright（`config/test/playwright.config.ts`、E2E の起動は `scripts/e2e/run-e2e.mjs`）、変異テスト（`config/test/stryker.config.mjs`）、`tsc --noEmit`、Lexicon の lint（`scripts/build/lint-lexicon.sh`）。
- テストは `tests/` に置く。層ごとの配置と方針は [testing.md](testing.md) が正本。各層の coverage の対象パスは現在の `src/` に存在する。

## Key Technical Decisions

- **Cloudflare Workers への載せ方**: 画面と API は Astro のアダプタに任せ、`scheduled` だけ自前のエントリで受ける（`src/worker.ts`）。
- **セッションの保持**: セッションのトークンは HttpOnly の Cookie にだけ置き、JSON やクライアントのストレージに出さない（`src/lib/session/cookies.ts`）。複数アカウントは `atp_account_0`〜`_3` のプールで持つ。
- **予約の認可**: 予約用の更新トークンと DPoP の鍵は AES-GCM で暗号化して D1 に置き、DID を追加認証データにする（`src/lib/schedule/credentialCrypto.ts`）。
- **アンケートの匿名性**: 回答者は `HMAC-SHA256(鍵, surveyId + did)` の値だけで表し、回答の行には識別子を持たせない（`src/lib/survey/respondentHash.ts`）。

---

_Document standards and patterns, not every dependency._
_updated_at: 2026-11-01（テスト節の旧い記述を現行の配置に合わせた）_

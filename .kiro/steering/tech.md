# Technology Stack

## Architecture

Astro（SSR）を Cloudflare Workers で動かす。画面は Astro のページと React の島（`client:load`）で作り、利用者向けの API は `src/pages/v2/` の Astro エンドポイント（`APIRoute`）として実装する。Workers の定期実行（`scheduled`）は `src/worker.ts` で受け、予約投稿とアンケートの日次集計を行う。日次処理は結果と目録の記録を確認した後に回答を削除する。

- 永続化: D1（`migrations/` の SQL。予約の 3 表・アンケートの 2 表）と R2（予約の添付画像）
- 外部: Bluesky の PDS・AppView・認可サーバー、OGP 抽出サービス、旧バックエンド（pageDB）、GitHub API（Issue 作成）
- 送信の間隔制限: Workers の Rate Limiter（フィードバックの送信。ログイン中のアカウントの DID をキーにする。`src/lib/feedback/submitFeedback.ts`）
- アクセス解析（任意）: 測定 ID（`PUBLIC_GA_MEASUREMENT_ID`）を設定したときだけ Google Analytics のタグを出す。タグは Partytown で Web Worker 上で動かし、画面の処理を妨げない（`src/components/layout/AnalyticsTag/`）
- 設定と秘密: 運用者ごとの非秘密の値は `config/<名前>.json`（`develop`・`production`・`e2e`。雛形は `*.example.json`）に置き、`scripts/config/render-wrangler.mjs` が `config/wrangler.template.jsonc` から `wrangler.jsonc` を生成する（生成物・`config/*.json` とも gitignore 対象。手で編集しない）。秘密は `.dev.vars` と Worker のシークレットに置き、`scripts/secrets/` が生成・登録する。dotenv・JSONC の解析は `scripts/lib/` の共通関数を使う
- 生成物: `scripts/build/build-openapi-document.ts` が OpenAPI を作り、`orval` が `src/client/openapi/` のクライアントを作る（手で編集しない）

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
- コメントの書き方（先頭ヘッダ・禁止パターン・許容リストによる検査）は `comments.md` に従う。

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

テストの方針の正本は [testing.md](testing.md)（承認済み）。ここには現在の設定の観察だけを置く。

- 現在の設定: 層ごとの Vitest 設定（`config/test/vitest.unit.config.ts`・`config/test/vitest.component.config.ts`・`config/test/vitest.route.config.ts`・`config/test/vitest.astro.config.ts`・`config/test/vitest.live.config.ts`）、Playwright（`config/test/playwright.config.ts`、E2E の起動は `scripts/e2e/run-e2e.mjs`）、変異テスト（`config/test/stryker.config.mjs`）、`tsc --noEmit`、Lexicon の lint（`scripts/build/lint-lexicon.sh`）。
- テストは `tests/` に置く。層ごとの配置と方針は [testing.md](testing.md) が正本。各層の coverage の対象パスは現在の `src/` に存在する。

## Key Technical Decisions

- **Cloudflare Workers への載せ方**: 画面と API は Astro のアダプタに任せ、`scheduled` だけ自前のエントリで受ける（`src/worker.ts`）。
- **セッションの保持**: セッションのトークンは HttpOnly の Cookie にだけ置き、JSON やクライアントのストレージに出さない（`src/lib/session/cookies/`。Cookie の処理をフォルダに分けた）。複数アカウントは `atp_account_0`〜`_3` のプールで持つ。
- **D1 のマイグレーション**: `release/**` 以外のブランチ（develop・main・dev/*）では、`migrations/` は `0001_initial.sql` だけにする。develop と main は、運用の追加を考慮せず、始めの状態から構築できるようにしておく。構造を変えるときは `0001` を直接編集し、develop の D1 を作り直す（作り直しは利用者の作業。配備は空の DB に `0001` を適用する）。`0002` 以降を積んでよいのは `release/**` だけで、develop・main へは持ち込まない。`scripts/git/check-migrations.mjs`（`npm run test:migrations`。コミット前・`test:all`・CI の `e2e`）と、Claude のフック `scripts/agent/migration-gate.mjs`（`0002` 以降の作成・書き込みを拒否）が守る。
- **予約の認可**: 予約用の更新トークンと DPoP の鍵は AES-GCM で暗号化して D1 に置き、DID を追加認証データにする（`src/lib/schedule/credentialCrypto.ts`）。
- **アンケートの匿名性**: 回答者は `HMAC-SHA256(鍵, surveyId + did)` の値だけで表し、回答の行には識別子を持たせない（`src/lib/survey/respondentHash.ts`）。

---

_Document standards and patterns, not every dependency._
_updated_at: 2026-11-11_

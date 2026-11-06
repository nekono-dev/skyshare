# Brief: platform-runtime

## Problem

Worker の入口、ミドルウェアの合成、ビルド時のサイト設定、Cloudflare の型と環境変数は、どの機能からも使われる。ここの規則が機能側に散ると、ビルドの失敗や環境変数の取り違えが起きる。

## Current State

- `src/worker.ts`: `fetch` は Astro のハンドラへ渡す。`scheduled` は毎分の予約実行（`runScheduledPosts`）を起動し、`isHousekeepingTime` のときだけ後片付け（`runHousekeeping`）とアンケートの削除（`runSurveyRetention`）を別の `waitUntil` で起動する。
- `src/middleware.ts`: `sequence(localeMiddleware, entryPageCache, refreshBskySession)`。合成だけを行い、中身は各 spec が所有する。
- `astro.config.mjs`: 環境変数（`loadEnv` と `process.env`）を読む。`build` のときは `checkSiteEnv` で運用者の値の欠落を検出して止める。Git の SHA とリモートを `resolveBuildInfo` に渡す。`PUBLIC_SURVEY_CONFIG_PRESENT` を決める。
- `src/lib/site/`: `siteEnv.ts`・`siteConfig.ts`（運用者ごとの値）・`buildEnv.ts`・`buildInfo.ts`・`surveyPresence.ts`（判定だけの純粋関数）。
- `src/lib/platform/cfTypes.ts`: D1・R2・Cron の型。（移動前は予約の領域にあったが、アンケートと `worker.ts` も使うため移した。）
- `src/lib/schedule/env.ts`・`src/lib/survey/env.ts`・`src/lib/feedback/env.ts`・`src/lib/oauth/env.ts`: 各領域の環境変数の読み取り（`cloudflare:workers` を動的に読む）。
- `src/lib/guestMode.ts`: `?guest` でログイン不要の表示を許す（8 ファイルが使う）。
- `src/env.ts`・`src/vars.ts`・`src/global.d.ts`: 環境変数の型と公開値。
- `wrangler.template.jsonc`: D1（`DB`）、R2（`SCHEDULE_IMAGES`）、Cron（毎分）、Rate Limiter（`FEEDBACK_RATE_LIMITER`、60 秒に 1 件）、`routes`、`vars`。

## Desired Outcome

- Worker の入口と、fetch・scheduled の役割の分担が記録されている。
- ミドルウェアの合成順序と、各要素の所有者が記録されている。
- 運用者ごとの値（必須と任意）と、ビルドで止める条件が記録されている。
- Cloudflare の型と環境変数の読み取りの規則（動的読み込み）が記録されている。

## Approach

入口・合成・設定・バインディングの型を所有する。個々の処理の中身は各 spec が所有する。`cfTypes.ts` の所有を、この spec に移すことを design で決める。

## Scope

- **In**: `worker.ts`、`middleware.ts`、`astro.config.mjs` の設定部分、`lib/site/`、`cfTypes.ts`、環境変数の読み取り、ゲストモード、`wrangler.template.jsonc` の役割。
- **Out**: 予約の実行の中身（scheduled-posting）、アンケートの削除の中身（surveys）、デプロイの手順と `scripts/`（対象外）。

## Boundary Candidates

- Worker の入口（worker.ts）
- ミドルウェアの合成（middleware.ts）
- 設定とビルド時の検査（astro.config.mjs・lib/site/）
- バインディングの型と環境変数（cfTypes.ts・env.ts・env.ts 類・vars.ts）
- ゲストモード（guestMode.ts）

## Out of Boundary

- 予約の実行、アンケートの削除、デプロイと運用

## Upstream / Downstream

- **Upstream**: i18n（ミドルウェアの言語）、api-contract。
- **Downstream**: 全 spec（環境変数と型を使う）。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: scheduled-posting・surveys（scheduled の中身）、session-accounts（ミドルウェア）、entry-sharing（ページのキャッシュ）。

## Constraints

- 全リクエストのミドルウェアは重い依存を静的に読み込まない（`bskySessionRefresh.ts` の制約）。
- 解消済み（2026-10-31）: `cfTypes.ts` を `lib/platform/` へ移し、`lib/survey` の import も直した。
- 既知の不一致: `astro.config.mjs` は `PUBLIC_*` を `loadEnv` と `process.env` の両方から読む。どちらが優先されるかは `...process.env` の順で決まる（確認済み）。

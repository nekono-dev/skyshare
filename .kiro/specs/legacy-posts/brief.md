# Brief: legacy-posts

## Problem

旧サービス（pageDB）で作られた投稿の URL が残っている。それらを表示し続け、本人が旧投稿を削除できる必要がある。旧バックエンドは別のサービスで、セッションの形式も違う。

## Current State

- `src/pages/posts/[slug].astro`: dbIndex を含まない旧 URL を `/posts/legacy/{slug}` へ内部的に書き換える（`Astro.rewrite`）。
- `src/pages/posts/[dbIndex]/[slug].astro`: 旧投稿の表示。`src/lib/legacy/pagedb.ts` が旧バックエンドの取得を呼ぶ（生成クライアントを使う）。`LegacyPageDeleteButton` は v2 のセッションを持つ閲覧者にだけ表示する（表示の判定は呼び出し側）。
- `src/pages/v1/page.ts`（`DELETE`）: Cookie の `atp_session` から DID と accessJwt を復号し、旧バックエンドの削除をサーバーからだけ呼ぶ。accessJwt は応答に出さない。OAuth のセッションは `OAuthSessionUnsupported` で 403 にする（DPoP に結びついたトークンは旧バックエンドで使えないため）。
- `src/lib/api/schema/v1/page/` にスキーマがある。`src/lib/api/schema/v1/extract/get.ts` は、対応する route（`src/pages/v1/extract*`）が見当たらない。
- 旧バックエンドの接続先は `PUBLIC_LEGACY_BACKEND_ENDPOINT`（`wrangler.template.jsonc`）。

## Desired Outcome

- 旧投稿の表示と URL の規則が記録されている。
- 旧投稿の削除の規則（本人確認は旧バックエンドが行う、OAuth は拒否する）が記録されている。
- 旧バックエンドとの契約（呼ぶ endpoint と応答の扱い）が記録されている。

## Approach

本アプリ側の表示・プロキシ・削除の規則だけを所有する。旧バックエンドの内部は対象外。

## Scope

- **In**: 旧投稿の表示ページ、旧 URL の書き換え、削除の API とボタン、旧バックエンドとの契約。
- **Out**: 旧バックエンドの実装、新しい旧投稿の作成（できない）、`v1/extract`（扱いを利用者に確認する）。

## Boundary Candidates

- 表示ページと URL（posts/・lib/legacy/pagedb.ts）
- 削除のプロキシと API（v1/page.ts・LegacyPageDeleteButton）

## Out of Boundary

- 旧バックエンドの内部、セッションの発行

## Upstream / Downstream

- **Upstream**: session-accounts（セッションの復号）、api-contract（生成クライアント）、i18n、ui-primitives、platform-runtime（環境変数）。
- **Downstream**: なし。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: session-accounts（OAuth の拒否の根拠）、api-contract（旧バックエンドへの転送）。

## Constraints

- accessJwt をクライアントに渡さない。
- 本人確認は旧バックエンドに任せる（本アプリでは判定しない。`LegacyPageDeleteButton/index.tsx` の header に記載）。
- 既知の不一致: `v1/extract/get.ts` のスキーマに対応する route が無い。

## 確定した判断（2026-08-14）

- 旧バックエンド（Cloud Run 上の v1.6）は v2 と登録ドメインが別のため、v2 の Cookie を送れない。Cookie の属性では回避できない。URL は `_legacy/frontend/.env.development` の `PUBLIC_BACKEND_ENDPOINT` を参照する。
- Bluesky のセッション（did と accessJwt）を使う旧バックエンドの呼び出し（投稿の削除など）は、ブラウザから直接呼ばない。v2 のサーバーのエンドポイント（`src/pages/v1/legacy-page.ts`）が自分の Cookie から v2 のセッションを読み、旧バックエンドをサーバー同士で呼ぶ（`src/lib/pagedb.ts` の `deletePageDbEntry`）。
- 旧バックエンド側で Cookie を発行する案は、追加のインフラとセキュリティ設定が要るため退けた。
- 認証の要らない読み取り（`GET /page/{dbIndex}/{dbKey}`）は、v2 の SSR からサーバー同士で呼ぶため影響を受けない。

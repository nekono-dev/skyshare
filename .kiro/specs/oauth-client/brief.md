# Brief: oauth-client

## Problem

Bluesky の OAuth は、ログインと予約投稿の両方で同じクライアントを使う。識別子・権限・秘密鍵・DPoP の扱いが二つの経路で別々に作られると、認可の失敗や鍵の不整合が起きる。

## Current State

- `src/lib/oauth/client.ts`: 配信元のオリジンからクライアント識別子・戻り先・権限を決める。ループバックの配信元では開発用の公開クライアント（`loopback.ts`）。クライアントのメタデータと JWKS を作る。トークン要求のたびに private_key_jwt を作る。
- `src/lib/oauth/env.ts`: 秘密鍵は `OAUTH_CLIENT_KEY`（Worker のシークレット、P-256 の JWK）。
- `src/lib/oauth/token.ts`・`tokenRequest.ts`・`dpop.ts`・`jose.ts`・`discovery.ts`・`resourceFetch.ts`・`callbackFragment.ts`: PAR・トークン要求・DPoP・発行元の探索・保護リソースの取得・戻りのフラグメント。
- `src/lib/oauth/returnPath.ts`: 認可の画面から戻るときの用途とページのパスを、戻り先だけに送られる短命の Cookie に入れる。パスは `/` で始まり `//` と `\` を含まないものだけ受け付ける。
- `src/pages/oauth/client-metadata.json.ts`・`src/pages/oauth/jwks.json.ts`: メタデータと公開鍵。
- 利用者: `src/lib/session/oauthLogin.ts`（ログイン）、`src/lib/schedule/oauth/flow.ts`（予約の認可）。

## Desired Outcome

- クライアントの識別子とメタデータの決まり方、開発用クライアントの条件が記録されている。
- PAR・トークン・DPoP・発行元の検証の規則が記録されている。
- 戻りのパスの検査（開き直しの防止）が記録されている。

## Approach

共通のクライアント本体を所有する。ログインの流れは session-accounts、予約の認可の流れは scheduled-posting が所有する。

## Scope

- **In**: クライアントの定義・メタデータ・JWKS、PAR・トークン要求・DPoP、発行元の探索、開発用クライアント、戻りのパスの受け渡し。
- **Out**: ログインの画面と流れ、予約の認可の流れ、鍵の生成（`scripts/generate-oauth-key.mjs`）、開発用の中継（`scripts/oauthLoopbackForwarder.ts`）。

## Boundary Candidates

- クライアントの定義（client.ts・env.ts・JWKS・メタデータ）
- 要求の組み立て（token.ts・tokenRequest.ts・dpop.ts・jose.ts・discovery.ts・resourceFetch.ts）
- 戻りの受け渡し（returnPath.ts・loopback.ts・callbackFragment.ts）

## Out of Boundary

- ログインの流れ、予約の認可の流れ、鍵の生成

## Upstream / Downstream

- **Upstream**: platform-runtime（環境変数の読み取り）。
- **Downstream**: session-accounts、scheduled-posting。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: session-accounts、scheduled-posting。

## Constraints

- トークン・鍵・認可コードをログに出さない（`oauthLogin.ts` と `flow.ts` に明記）。
- Cron の経路から使うため `@atproto/*` を読み込まず、WebCrypto と fetch だけを使う（`lib/oauth` の既存の実装）。
- 注: `lib/session/oauthSession.ts` の header によると、エージェントの生成（`oauthAgent.ts`）は再開の時点で動的に読み込む。`@atproto/*` を全リクエストの経路で静的に読まないための実装上の工夫。

## 確定した判断（2026-10-24）

- トークンの保管は cookie（D1 は使わない）。更新用トークンの再利用で認可サーバーがセッションを失効させるため、期限 60 秒前のときだけ更新し、更新したときだけ書き戻す。
- cookie の上限のため、アカウントのプールは `atp_account_0..3` に 1 件ずつ。
- スコープは `atproto transition:generic`。開始時は bsky.social へ PAR（Bluesky ホスティングのアカウントのみ）。完了時に sub → PDS → 認可サーバーの issuer 一致を検証する。
- ローカルの開発は、公開クライアント（`client_id` は `http://localhost?...`）と `127.0.0.1:4322` の中継で行う。https のループバックは atproto が拒否する。
- シークレットは `OAUTH_CLIENT_KEY`（旧 `SCHEDULE_OAUTH_KEY`）。
- OAuth のセッションでは、旧バックエンドの投稿削除は 403 になる（アプリパスワードでの再ログインを案内する）。

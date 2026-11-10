# Brief: session-accounts

## Problem

利用者は Bluesky のアカウントでログインし、複数のアカウントを切り替えて使う。セッションのトークンはクライアントから読めてはならず、更新と書き戻しの規則を誤ると、並行するリクエストがセッションを失効させる。

## Current State

- ログインの二つの方式: OAuth（`POST /v2/bsky/session/authorization` → Bluesky の認可 → `/oauth/callback/` → `POST /v2/bsky/session/authorization/completion`）と、アプリパスワード（`POST /v2/bsky/session`）。画面は `src/components/account/LoginForm/`。
- Cookie（`src/lib/session/cookies.ts` の確認済みの名前）: `atp_session`（アクティブ）、`atp_account_0`〜`atp_account_3`（非アクティブのプール）、`atp_accounts`（用途は design で実装を読んで確認する。grep で見つかったのは 1 箇所のみ）、`atp_dpop_nonce`（DPoP の nonce）。
- API: `GET`・`POST`・`PUT /v2/bsky/session`（一覧・追加・切り替え）、`DELETE /v2/bsky/session/{did}`（ログアウト）。`src/pages/v2/bsky/session.ts` の header に、`no-store` と「トークンは応答に含めない」という規則がある。
- 再開と更新: `src/lib/session/bskySessionRefresh.ts` がミドルウェアとして `/v2/` の大半で再開する（`/v2/bsky/session` とその配下は除く）。OAuth は期限の 60 秒前に更新する（`oauthSession.ts`）。更新と nonce は変化があったときだけ Cookie を書き戻す。
- `src/lib/account/activeAccountSession.ts`: アクティブアカウントの取得を一本化し、未ログインの確認を sessionStorage に記録する。
- 画面: `src/pages/login.astro`・`src/pages/accounts.astro`・`components/account/`（AccountSwitcher・AccountSwitchPanel・LoginIntro・LoginForm）。

## Desired Outcome

- ログインの二つの方式と、それぞれの完了条件が記録されている。
- Cookie の配置、切り替え、ログアウトの規則が記録されている。
- 再開と更新の規則（書き戻しの条件）が記録されている。
- トークンをクライアントに出さない規則が記録されている。

## Approach

セッションの状態遷移と Cookie の規則を所有する。OAuth クライアントは oauth-client、予約の認可は scheduled-posting が所有する。

## Scope

- **In**: ログインの開始と完了、アカウントの一覧・切り替え・ログアウト、Cookie、再開と更新、アクティブアカウントの取得、ログイン画面と戻りの処理。
- **Out**: OAuth クライアントの定義（oauth-client）、予約の認可（scheduled-posting）、旧投稿の削除（legacy-posts）。

## Boundary Candidates

- ログイン（oauthLogin.ts・アプリパスワードの API・authorization 系の API・oauth/callback.ts）
- Cookie と複数アカウント（cookies.ts・bsky/session.ts・bsky/session/[did].ts）
- 再開と更新（bskySessionRefresh.ts・oauthSession.ts・oauthAgent.ts・bskySessionRefresh のテスト対象の境界）
- アカウントの画面（components/account/・login.astro・accounts.astro）

## Out of Boundary

- OAuth の部品、予約の認可、旧投稿

## Upstream / Downstream

- **Upstream**: oauth-client、api-contract、atproto-records（did・agent）、platform-runtime、i18n、ui-primitives。
- **Downstream**: 認証を必要とする全 spec。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: oauth-client（認可の部品）、legacy-posts（OAuth の拒否）、scheduled-posting（別の Cookie と鍵）。

## Constraints

- トークンは HttpOnly の Cookie の中にだけ置く。JSON 応答やクライアントのストレージに出さない。
- セッション関連の応答は `no-store`。
- 既知の不一致: なし（確認済みの範囲）。

## 確定した判断（2026-10-24）

- ログインのフォームは、「Bluesky でログイン」のボタンと、折りたたみ（Collapsible）の中のアプリパスワードのフォームにする。タブは使わない。

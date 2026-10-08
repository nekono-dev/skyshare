# APIエラーの文言 設計書

## 1. 構成

| パス                                                 | 責務                                      |
| ---------------------------------------------------- | ----------------------------------------- |
| `src/lib/i18n/errorMessage.ts`                       | HTTPステータスから文言キーへの変換        |
| `src/pages/v2/bsky/session.ts`                       | ログインAPIのエラー応答                   |
| `src/lib/api/schema/v2/bsky/session/post.ts`         | ログインAPIのエラー応答のスキーマ         |
| `src/components/account/LoginForm/index.tsx`         | ログイン失敗の文言の表示                  |
| `src/components/post/ThreadComposer/submitThread.ts` | 投稿APIのエラーコードから文言キーへの変換 |

## 2. 設計項目

### D-1: エラー応答とステータスの対応 (FR-1, FR-2, FR-3, FR-5)

```ts
// サーバー: 全エンドポイントが errorResponseFromStatus(status) で { error: "<英語の固定文字列>" } を返す
// クライアント:
export type ErrorContext = "login"
export const errorMessageKeyFromStatus = (status: number, context?: ErrorContext): MessageKey
```

| ステータス | 汎用                 | `context === "login"`       |
| ---------- | -------------------- | --------------------------- |
| 400        | `error.badRequest`   | ログイン失敗                |
| 401        | `error.unauthorized` | ログイン失敗                |
| 403        | `error.forbidden`    | ログイン失敗                |
| 404        | `error.notFound`     | ログイン失敗                |
| 409        | `error.conflict`     | `error.accountLimitReached` |
| 429        | `error.rateLimited`  | `error.rateLimited`         |
| その他     | `error.generic`      | ログイン失敗                |

画面はキーをstateに保持し、描画時に `t()` で文言にする。サーバーの `error` 文字列は表示に使わない。

### D-2: ログインの上限到達 (FR-4, FR-6)

- `POST /v2/bsky/session` はアカウント数の上限到達を `errorResponseFromStatus(409)` で返す。スキーマの `responses` に `Common.errorResponses` で409を加え、409が上限到達を表すことはスキーマのコメントに記す。
- `LoginForm` は `errorMessageKeyFromStatus(res.status, "login")` のキーを表示する。`fetch` が例外を投げた場合は `error.network` を表示する。

```ts
try {
  const res = await fetch(...)
  if (!res.ok) setMessageKey(errorMessageKeyFromStatus(res.status, "login"))
} catch {
  setMessageKey("error.network")
}
```

### D-3: 処理固有の文言とエラーコード (FR-7, FR-8)

| 呼び出し元               | 失敗時の文言キー                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `Timeline`               | `post.timeline.loadFailed`                                                                    |
| `EntryList`              | 一覧の読み込み失敗のキー                                                                      |
| `OgpFetchButton`         | リンクカードの取得失敗のキー                                                                  |
| `submitThread`           | 応答の `error` のエラーコードを `post.submit.*` に変換し、未知のコードは `post.submit.failed` |
| ステータスを持たない失敗 | `error.network`                                                                               |

## 3. エラー処理

| 事象                 | 処理                               |
| -------------------- | ---------------------------------- |
| 応答本文がJSONでない | ステータスだけから文言キーを決める |

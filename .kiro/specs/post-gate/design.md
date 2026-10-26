# Design Document

## Overview

**Purpose**: 投稿ごとに、返信できる相手と引用の可否を制限できるようにし、その既定値を端末に保存して、毎回の設定の手間を省けるようにする。
**Users**: 投稿ごとに返信できる相手と引用の可否を制限したい利用者
**Impact**: 返信と引用の制限を Bluesky のレコードへ変換し、既定値を端末に保存して毎回の設定の手間を省く。

### Goals

- 返信できる相手の制限と、引用の許可を、Blueskyのレコードへ変換すること。
- 返信と引用の設定を編集するダイアログ。
- 設定の既定値の保存と読み取り。

### Non-Goals

- 投稿に対するレコードの書き込み。
- 自分が所有するリストの取得。

## Boundary Commitments

### This Spec Owns

- 返信できる相手の制限と、引用の許可を、Blueskyのレコードへ変換すること。
- 返信と引用の設定を編集するダイアログ。
- 設定の既定値の保存と読み取り。

### Out of Boundary

- 投稿に対するレコードの書き込み。
- 自分が所有するリストの取得。

### Allowed Dependencies

- Bluesky の投稿の gate レコード（threadgate・postgate）
- 自分が所有するリストの取得（atproto-access）
- ブラウザの保存領域

### Revalidation Triggers

- 返信を許可するルールの上限（5件）を変えるとき
- 既定値の保存形式を変えるとき（保存値が壊れている場合の扱いを再確認する）
- gate レコードの形（Bluesky の仕様）が変わるとき

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                                           | 責務                                   |
| ---------------------------------------------- | -------------------------------------- |
| `src/lib/atproto/gate.ts`                      | 簡略化した設定からのレコードの組み立て |
| `src/lib/settings/postGateSettings.ts`         | 既定値の保存と読み取り                 |
| `src/components/post/PostGateDialog/index.tsx` | 返信と引用の設定の編集ダイアログ       |

## Requirements Traceability

| Requirement        | Summary          | Components |
| ------------------ | ---------------- | ---------- |
| 1.1, 1.2, 1.3, 1.4 | 返信の制限       | D-1        |
| 2.1, 2.2           | 引用の制限       | D-1        |
| 3.1, 3.2, 3.3, 3.4 | 既定値の保存     | D-2        |
| 4.1, 4.2           | 設定のダイアログ | D-3        |

## Components and Interfaces

#### D-1: レコードの組み立て

**Requirements**: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2

```ts
export type ReplyAudience = "everyone" | "nobody" | "custom"
export type PostGateValue = {
  replyAudience: ReplyAudience
  allowMentioned: boolean
  allowFollower: boolean
  allowFollowing: boolean
  listUris: string[]
  allowQuote: boolean
}
export const MAX_REPLY_GATE_RULES = 5
export const DEFAULT_POST_GATE_VALUE: PostGateValue = {
  replyAudience: "everyone", allowMentioned: false, allowFollower: false,
  allowFollowing: false, listUris: [], allowQuote: true,
}
export const buildThreadgateRecord = (postUri: string, gate: PostGateValue, createdAt: string): Record<string, unknown> | null
export const buildPostgateRecord = (postUri: string, gate: PostGateValue, createdAt: string): Record<string, unknown> | null
```

| 設定       | 返信の制限（threadgate）                                             |
| ---------- | -------------------------------------------------------------------- |
| `everyone` | レコードを作らない（`null`）                                         |
| `nobody`   | `allow: []`                                                          |
| `custom`   | mention・follower・following の各ルールの後に、リストごとの listRule |

- ルールの合計が `MAX_REPLY_GATE_RULES` に達したら、残りのリストは含めない。
- 引用の制限（postgate）は、`allowQuote` が偽のときだけ `embeddingRules` に `disableRule` を持つレコードを作る。

#### D-2: 既定値の保存

**Requirements**: 3.1, 3.2, 3.3, 3.4

```ts
// 保存キーは postGateDefault（JSON）と syncGateDefaultAfterPost（"true" か "false"）
export const readPostGateDefaultSetting = (): PostGateValue
export const writePostGateDefaultSetting = (value: PostGateValue): void
export const isDefaultPostGateValue = (value: PostGateValue): boolean
export const readSyncGateDefaultAfterPostSetting = (defaultValue: boolean): boolean
export const writeSyncGateDefaultAfterPostSetting = (value: boolean): void
```

- 読み取りは、`window` が無い・保存値が無い・JSON が壊れている・形状が不正・例外のときに初期の既定値を返す。書き込みの例外は握りつぶす。
- 形状の検査は、`replyAudience` が3値のいずれかで、各許可が真偽値で、`listUris` が文字列の配列であることを確かめる。
- 一致の判定は、リストが空であることを含め、すべての項目を既定値と比べる。

#### D-3: ダイアログ

**Requirements**: 4.1, 4.2

```tsx
type PostGateDialogProps = {
  open: boolean
  value: PostGateValue
  onChange: (next: PostGateValue) => void // 適用したときだけ呼ぶ
  onClose: () => void
  accountDid?: string | null // 未解決の間は「リストから選択」を無効にする
}
```

- 「誰でも返信可能」と「返信不可」は排他のラジオで選び、メンション・フォロワー・フォロー中・リストの組み合わせとは相互に排他とする。組み合わせを選ぶと `custom` になり、組み合わせをすべて外すと「誰でも返信可能」へ戻す。
- 背景のクリックと Esc では確定せず、「適用」だけが `onChange` を呼ぶ。
- 開いた時点で、自分のリスト一覧を公開の AppView から読み込む。

## Error Handling

| 事象                       | 処理                                         |
| -------------------------- | -------------------------------------------- |
| 保存値の JSON が壊れている | 初期の既定値を使う                           |
| リスト一覧の取得の失敗     | 失敗の文言を表示し、リストの選択を無効にする |

## Testing Strategy

- Unit / Build Tests:
  - `npx vitest run tests/lib/atproto/gate.test.ts`
  - `npx vitest run tests/lib/settings/postGateSettings.test.ts`
  - `npx tsc --noEmit`
- E2E/UI Tests:
  - `tests/e2e/postGateDialog.spec.ts` ゲスト表示の設定ページでダイアログを開き、返信不可を選んで適用またはキャンセルする → 適用では既定値が保存され、キャンセルでは保存されない
- テストの名前には、対応する基準 ID を `[post-gate/<ID>]` の形で付ける（例: `[post-gate/1.1]`）

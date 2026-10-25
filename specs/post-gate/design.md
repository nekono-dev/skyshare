# 返信と引用の制限 設計書

## 1. 構成

| パス                                           | 責務                                   |
| ---------------------------------------------- | -------------------------------------- |
| `src/lib/atproto/gate.ts`                      | 簡略化した設定からのレコードの組み立て |
| `src/lib/settings/postGateSettings.ts`         | 既定値の保存と読み取り                 |
| `src/components/post/PostGateDialog/index.tsx` | 返信と引用の設定の編集ダイアログ       |

## 2. 関係図・ワークフロー

- なし

## 3. 設計項目

### D-1: レコードの組み立て (FR-1, FR-2, FR-3, FR-4, FR-5)

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

### D-2: 既定値の保存 (FR-6, FR-7, FR-8)

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

### D-3: ダイアログ (FR-9)

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

## 4. エラー処理

| 事象                       | 処理                                         |
| -------------------------- | -------------------------------------------- |
| 保存値の JSON が壊れている | 初期の既定値を使う                           |
| リスト一覧の取得の失敗     | 失敗の文言を表示し、リストの選択を無効にする |

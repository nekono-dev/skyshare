# メンションとハッシュタグの候補 設計書

## 1. 構成

| パス                                                    | 責務                                       |
| ------------------------------------------------------- | ------------------------------------------ |
| `src/util/textarea/suggestTrigger.ts`                   | カーソル直前の入力からの契機の判定         |
| `src/lib/atproto/suggest.ts`                            | メンションの検索とトレンドの取得           |
| `src/components/post/ThreadComposer/suggestHashtags.ts` | ハッシュタグの候補の合成                   |
| `src/lib/settings/hashtagHistorySettings.ts`            | ハッシュタグの履歴の保存                   |
| `src/lib/settings/suggestSettings.ts`                   | 候補機能の有効と無効の保存                 |
| `src/components/post/ThreadComposer/useSuggest.ts`      | 契機の評価・取得・キー操作・確定の状態管理 |
| `src/components/post/SuggestPopover/index.tsx`          | 候補の一覧の描画                           |

## 2. 関係図・ワークフロー

候補機能の構成要素の依存方向を示す。

```mermaid
flowchart LR
  useSuggest --> suggestTrigger
  useSuggest --> suggest
  useSuggest --> suggestHashtags
  useSuggest --> index
  suggestHashtags --> suggest
  suggestHashtags --> hashtagHistorySettings
  ext_form["ThreadSegmentForm"] --> useSuggest
  ext_form --> suggestSettings
  ext_form --> hashtagHistorySettings
```

入力から候補の提示までの流れと、契機の種類による分岐を示す。

```mermaid
sequenceDiagram
  participant useSuggest
  participant suggestTrigger
  participant suggest
  participant suggestHashtags
  participant hashtagHistorySettings
  participant index
  useSuggest->>suggestTrigger: detectSuggestTrigger
  alt 契機なし
    suggestTrigger-->>useSuggest: null
  else メンション
    useSuggest->>suggest: searchMentionSuggestions
  else ハッシュタグ
    useSuggest->>suggestHashtags: getHashtagCandidates
    suggestHashtags->>hashtagHistorySettings: readHashtagHistory
    suggestHashtags->>suggest: getTrendingTagSuggestions
  end
  useSuggest->>index: 候補の一覧を提示
  hashtagHistorySettings->>hashtagHistorySettings: addHashtagsToHistory
  useSuggest->>useSuggest: useSuggest
```

## 3. 設計項目

### D-1: 契機の判定 (FR-1, FR-2, FR-3, FR-4)

```ts
export type SuggestTrigger = { kind: "mention" | "hashtag"; startIndex: number; query: string }
// メンション: トークン文字は a-z A-Z 0-9 . -。ハッシュタグ: \p{L} \p{N} \p{M} _。
// 記号の直前は文字列の先頭か空白でなければならず、記号以降のクエリは 40 文字以内
export const detectSuggestTrigger = (text: string, caretIndex: number): SuggestTrigger | null
```

### D-2: 候補の取得 (FR-5, FR-6, FR-7, NFR-1)

```ts
export const searchMentionSuggestions = async (query: string, opts?: { signal?: AbortSignal }): Promise<MentionSuggestion[]>
export const getTrendingTagSuggestions = async (opts?: { signal?: AbortSignal }): Promise<TrendingTagSuggestion[]>
export const getHashtagCandidates = async (params: { prefix: string; signal?: AbortSignal; accountDid?: string | null }): Promise<HashtagCandidate[]>
```

| 処理                 | 内容                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| メンションの検索     | `searchActorsTypeahead` を `limit: 5` で呼ぶ。空のクエリは呼ばずに空配列。中断以外の失敗は空配列      |
| トレンドの取得       | `getTrendingTopics` を `limit: 25` で呼び、先頭の記号を除く。1〜64文字で空白を含まないものだけ残す    |
| トレンドの保持       | 結果を 5 分間保持する。取得に失敗したときは保持中の結果を返す                                         |
| ハッシュタグの候補   | 履歴を先、トレンドを後に並べ、前置一致（大文字小文字を区別しない）で選び、履歴と重なるものを除いて5件 |
| 取得の契機と打ち切り | 入力から 200 ミリ秒後に開始し、`AbortSignal.timeout(5000)` で打ち切る。IME の変換中は評価しない       |

### D-3: 履歴と設定 (FR-8, FR-9, FR-10)

```ts
export type HashtagHistoryEntry = { tag: string; lastUsedAt: number }
export const readHashtagHistory = (accountDid: string | null | undefined): HashtagHistoryEntry[] // 新しい順
export const addHashtagsToHistory = (tags: string[], accountDid: string | null | undefined): void
// 履歴が空のときだけ、使用数順のタグを履歴の初期値として書き込む
const seedHashtagHistoryFromRankedTags = (tags: string[], accountDid: string | null | undefined): void
```

- 保存先は `localStorage` の `hashtagHistory:<did>` とする。DID が未解決の間は読み書きしない。
- 上限は `PUBLIC_HASHTAG_HISTORY_MAX`（正の整数。不正なら 100）とする。
- 設定は `hashtagSuggestEnabled` と `mentionSuggestEnabled` の2つのキーに文字列の真偽値で保存し、読み取りは `readHashtagSuggestEnabledSetting`・`readMentionSuggestEnabledSetting`、書き込みは `writeHashtagSuggestEnabledSetting`・`writeMentionSuggestEnabledSetting` で行う。読み取れないときは既定値を返す。

### D-4: 候補の一覧 (FR-11)

```tsx
type Props = {
  candidates: SuggestCandidate[]
  activeIndex: number
  position: { top: number; left: number } | null
  listboxId: string
  onHoverIndex: (index: number) => void
  onSelect: (index: number) => void // mousedown で確定する。入力欄のフォーカスを奪わない
  onDismiss: () => void
}
```

- 行は共通の `ListboxOption` で描画し、選択中の行に `aria-selected` を付ける。
- 矢印キーで `activeIndex` を移し、Enter または Tab で確定し、Esc で閉じる。

## 4. エラー処理

| 事象                     | 処理                                 |
| ------------------------ | ------------------------------------ |
| メンションの検索の失敗   | 警告を記録して空の候補を返す         |
| トレンドの取得の失敗     | 保持中の結果、無ければ空の候補を返す |
| 保存領域の読み書きの例外 | 既定値を返すか、書き込みを諦める     |

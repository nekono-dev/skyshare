# Design Document

## Overview

**Purpose**: 選択肢の多いプルダウンで、トリガーに文字を入力して選択肢を絞り込めるようにする。
**Users**: 選択肢の多いプルダウン（言語の選択など）から値を選ぶ利用者
**Impact**: 共通のプルダウンに、トリガーへの入力で選択肢を絞り込む検索モードを加える。

### Goals

- 検索付きプルダウンの一覧モードと検索モードの切り替え。
- 入力による選択肢の絞り込みと確定。

### Non-Goals

- 検索なしのプルダウンの開閉・配置・キーボード操作。
- 選択肢の非同期取得。

## Boundary Commitments

### This Spec Owns

- 検索付きプルダウンの一覧モードと検索モードの切り替え。
- 入力による選択肢の絞り込みと確定。

### Out of Boundary

- 検索なしのプルダウンの開閉・配置・キーボード操作。
- 選択肢の非同期取得。

### Allowed Dependencies

- 共通のプルダウン（dropdown）
- 絞り込み用の正規化と判定（`src/util/listbox/filter.ts`）

### Revalidation Triggers

- 絞り込みの規則（正規化・追加の文字列）を変えるとき
- モードの遷移（一覧モードと検索モード）を変えるとき
- 絞り込みの対象件数が大きく増えるとき（処理時間の基準を再確認する）

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                                       | 責務                               |
| ------------------------------------------ | ---------------------------------- |
| `src/components/common/Dropdown/index.tsx` | 検索モードの状態とトリガーの入力欄 |
| `src/util/listbox/filter.ts`               | 絞り込み用の正規化と判定           |

## Requirements Traceability

| Requirement             | Summary            | Components |
| ----------------------- | ------------------ | ---------- |
| 1.1, 1.2, 1.3, 1.4, 1.5 | 検索モードの入り方 | D-1, D-2   |
| 2.1, 2.2, 2.3, 2.4, 2.5 | 絞り込み           | D-1, D-3   |
| 3.1, 3.2, 3.3, 3.4, 3.5 | 確定と取り消し     | D-1, D-2   |

## Components and Interfaces

#### D-1: 追加のインターフェースと状態

**Requirements**: 1.1, 2.2, 3.5

```ts
// DropdownOption に追加する項目
inputText?: string // 入力欄に表示する現在値の文字列。未指定なら label
searchText?: string // label とは別に絞り込み対象にする文字列
// Props に追加する項目
searchable?: boolean // 既定 false。true でトリガーを <input> にする
searchPlaceholder?: string // 検索モードの入力欄の placeholder
searchPromptText?: string // 入力が空のときにパネルへ出す文言
emptyText?: string // 該当0件の文言

type Mode = "list" | "search"
const [mode, setMode] = useState<Mode>("list")
const [query, setQuery] = useState("")
const visibleOptions = mode === "search" ? (query.trim() === "" ? [] : filterOptions(options, query)) : options
```

パネル内の不可視のsizerには全選択肢を描画するため、パネル幅は絞り込みで変わらない。

#### D-2: モードの遷移

**Requirements**: 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4

| 状態     | 操作                         | 結果                                                                    |
| -------- | ---------------------------- | ----------------------------------------------------------------------- |
| 閉       | クリック・Enter・上下キー    | 一覧モードで開く。`inputMode="none"`                                    |
| 開・一覧 | トリガーを再度クリック       | 検索モードへ。`inputMode` をDOMで `"text"` に書き換えて再フォーカスする |
| 開・一覧 | 文字キー                     | 検索モードへ入り、その文字を入力として扱う                              |
| 開・検索 | 入力が空                     | 選択肢を出さず `searchPromptText` を `role="status"` で表示する         |
| 開・検索 | 候補のクリック・Enter        | 確定して閉じる                                                          |
| 開・検索 | 候補が無い状態のEnter        | 何もしない                                                              |
| 開・検索 | Esc・パネル外のクリック・Tab | 確定せずに閉じ、`query` を破棄する                                      |
| 開・検索 | 入力欄の `blur` のみ         | 入力が空なら一覧モードへ戻し、入力済みなら残す                          |
| 閉       | 開き直す                     | `mode = "list"`、`query = ""`                                           |

- 入力欄は `value={open ? query : (selectedOption?.inputText ?? selectedOption?.label ?? placeholder ?? value)}` の制御入力とする。iOSでキーボードが出ないことがあるため、`readOnly` の切り替えは使わない。
- `blur` の判定は `setTimeout(0)` 後に、検索モードのまま・フォーカスがトリガーに無い・直近500ミリ秒以内にパネル内を押していない、のすべてを満たす場合だけ行う。

#### D-3: 絞り込み

**Requirements**: 2.1, 2.3, 2.4, 2.5

```ts
export const normalizeForSearch = (s: string) =>
  s.normalize("NFKC").toLowerCase()
export const filterOptions = <T extends { label: string; searchText?: string }>(
  options: T[],
  query: string,
): T[] => {
  const q = normalizeForSearch(query.trim())
  if (q === "") return options
  return options.filter(
    o =>
      normalizeForSearch(o.label).includes(q) ||
      (o.searchText !== undefined &&
        normalizeForSearch(o.searchText).includes(q)),
  )
}
```

- 入力が変わるたびに、`activeIndex` を `firstEnabledIndex(新しい visibleOptions)` にする。
- 約180件の正規化は同期処理で間に合うため、デバウンスは行わない。
- IMEの変換中の中間文字列もそのまま絞り込みに使う。Enterキーだけは変換中に確定として扱わない。

## Error Handling

- なし

## Testing Strategy

- Unit / Build Tests:
  - `npx vitest run tests/util/listbox/filter.test.ts`
  - `npm run build`
- E2E/UI Tests:
  - `tests/e2e/dropdown.spec.ts` 投稿言語のプルダウンを開いて再クリックし「ko」と入力する → 該当する言語だけに絞り込まれ、Escキーで直前の選択に戻る
- テストの名前には、対応する基準 ID を `[dropdown-search/<ID>]` の形で付ける（例: `[dropdown-search/1.1]`）

# 検索付きプルダウン 設計書

## 1. 構成

| パス                                       | 責務                               |
| ------------------------------------------ | ---------------------------------- |
| `src/components/common/Dropdown/index.tsx` | 検索モードの状態とトリガーの入力欄 |
| `src/util/listbox/filter.ts`               | 絞り込み用の正規化と判定           |

## 2. 設計項目

### D-1: 追加のインターフェースと状態 (FR-1, FR-6, FR-12)

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

### D-2: モードの遷移 (FR-2, FR-3, FR-4, FR-9, FR-10, FR-11)

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

### D-3: 絞り込み (FR-5, FR-7, FR-8, NFR-1)

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

## 3. エラー処理

- なし

# 投稿言語の選択欄 設計書

## 1. 構成

| パス                                             | 責務                           |
| ------------------------------------------------ | ------------------------------ |
| `src/components/common/LanguageSelect/index.tsx` | 投稿言語の選択肢の定義         |
| `src/lib/atproto/languageFlag.ts`                | 投稿言語から代表国への対応表   |
| `src/util/emoji/countryFlag.ts`                  | 国コードから国旗絵文字への変換 |

## 2. 設計項目

### D-1: 国旗の対応 (FR-2, FR-3, FR-4)

```ts
// ISO 3166-1 alpha-2 → 地域指示記号2文字。/^[A-Za-z]{2}$/ 以外は undefined
export const countryCodeToFlagEmoji = (code: string): string | undefined
const LANGUAGE_REPRESENTATIVE_COUNTRY: Record<string, string> = { ja: "JP", ko: "KR", en: "US", ... }
export const languageCodeToFlagEmoji = (languageCode: string): string | undefined
```

| 規則                                    | 対応                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------- |
| 公用語とする国が1つ、または本拠国がある | その国（`ja→JP` `ko→KR` `fr→FR` `de→DE` `it→IT` `ru→RU` `tr→TR`）       |
| 複数国にまたがる                        | `en→US` `es→ES` `pt→BR` `zh→CN` `ar→SA` `hi→IN` `bn→BD` `ms→MY` `sw→TZ` |
| 人工言語・古典言語・典礼言語            | 国旗なし（`eo` `ia` `ie` `io` `vo` `la` `cu` `pi` `sa` `ae`）           |
| 国に対応づけられない言語                | 国旗なし                                                                |

誤った国旗を表示しないよう、規則で判断できない言語は国旗なしとする。

### D-2: 選択肢の定義 (FR-1, FR-5)

```tsx
const options: DropdownOption[] = UNIQUE_BLUESKY_POST_LANGUAGES.map(l => {
  const flag = languageCodeToFlagEmoji(l.code)
  return {
    value: l.code,
    label: l.label,
    searchText: l.code,
    content: (
      <span className={styles["language-option"]}>
        <span className={styles.flag} aria-hidden="true">
          {flag ?? ""}
        </span>
        {l.label}
      </span>
    ),
    inputText: flag ? `${flag} ${l.label}` : l.label,
  }
})
// <Dropdown searchable options={options} ... />
```

`.flag` は `display: inline-block; width: 1.5em; text-align: center` とし、国旗の無い言語でも同じ幅の領域を確保する。

## 3. エラー処理

- なし

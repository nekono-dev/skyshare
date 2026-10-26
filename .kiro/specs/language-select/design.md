# Design Document

## Overview

**Purpose**: 約180件ある投稿言語から目的の言語を素早く見つけられるよう、国旗付きで絞り込める選択欄を提供する。
**Users**: 投稿言語を選ぶ利用者
**Impact**: 約180件ある投稿言語から目的の言語を素早く見つけられるよう、国旗付きで絞り込める選択欄を提供する。

### Goals

- 投稿言語の選択欄の選択肢と絞り込みの対象。
- 言語ごとの国旗の表示。

### Non-Goals

- 国旗画像の導入。国旗は絵文字とし、国旗の絵文字を描画できない環境で2文字の国コード表記になることを許容する。
- 表示言語の選択。

## Boundary Commitments

### This Spec Owns

- 投稿言語の選択欄の選択肢と絞り込みの対象。
- 言語ごとの国旗の表示。

### Out of Boundary

- 国旗画像の導入。国旗は絵文字とし、国旗の絵文字を描画できない環境で2文字の国コード表記になることを許容する。
- 表示言語の選択。

### Allowed Dependencies

- 検索付きのプルダウン（dropdown-search）
- 国旗の絵文字（国旗を描画できない環境では2文字の国コード表記になることを許容する）

### Revalidation Triggers

- 言語から代表国への対応表を変えるとき
- 選択肢の言語の集合を変えるとき（検索付きプルダウンの処理時間の基準に影響する）

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                                             | 責務                           |
| ------------------------------------------------ | ------------------------------ |
| `src/components/common/LanguageSelect/index.tsx` | 投稿言語の選択肢の定義         |
| `src/lib/atproto/languageFlag.ts`                | 投稿言語から代表国への対応表   |
| `src/util/emoji/countryFlag.ts`                  | 国コードから国旗絵文字への変換 |

## Requirements Traceability

| Requirement        | Summary    | Components |
| ------------------ | ---------- | ---------- |
| 1.1                | 絞り込み   | D-2        |
| 2.1, 2.2, 2.3, 2.4 | 国旗の表示 | D-1, D-2   |

## Components and Interfaces

#### D-1: 国旗の対応

**Requirements**: 2.1, 2.2, 2.3

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

#### D-2: 選択肢の定義

**Requirements**: 1.1, 2.4

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

## Error Handling

- なし

## Testing Strategy

- Unit / Build Tests:
  - `npx vitest run tests/util/emoji/countryFlag.test.ts tests/lib/atproto/languageFlag.test.ts`
  - `npm run build`
- E2E/UI Tests:
  - `tests/e2e/dropdown.spec.ts` 投稿言語で「ko」と入力して確定する → トリガーに国旗と言語名が表示される
- テストの名前には、対応する基準 ID を `[language-select/<ID>]` の形で付ける（例: `[language-select/1.1]`）

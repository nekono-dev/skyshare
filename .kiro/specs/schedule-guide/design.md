# Design Document

## Overview

**Purpose**: 設定の予約投稿の近くで、予約できる投稿の種類と、より本格的な予約投稿のための外部サービスを案内し、利用者が予約できない投稿を作ってから気づくことを減らす。
**Users**: 予約投稿を使おうとする利用者
**Impact**: 設定の予約投稿の近くに、予約できる投稿の種類と本格的な予約投稿サービスへの案内を置き、予約できない投稿を作ってから気づくことを減らす。

### Goals

- 予約できる投稿とできない投稿の、画像と動画のアイコンを使った注。
- 本格的な予約投稿サービス Chronosky への、ロゴつきの案内とリンク。

### Non-Goals

- 予約投稿の有効化と無効化の操作。
- Chronosky の機能の説明と、Chronosky との連携。

## Boundary Commitments

### This Spec Owns

- 予約できる投稿とできない投稿の、画像と動画のアイコンを使った注。
- 本格的な予約投稿サービス Chronosky への、ロゴつきの案内とリンク。

### Out of Boundary

- 予約投稿の有効化と無効化の操作。
- Chronosky の機能の説明と、Chronosky との連携。

### Allowed Dependencies

- 設定の予約投稿の説明文（schedule-form の設定のスイッチ）
- 文中に置くアイコン部品（InlineIcon）
- 表示言語の辞書（i18n-messages）

### Revalidation Triggers

- 予約できる投稿の種類（動画の可否）を変えるとき（schedule-api・schedule-runner の対応範囲と一致が要る）
- 案内先の外部サービスを変えるとき（リンク先と注意書きを更新する）

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                                                | 責務                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/components/schedule/ScheduleSetting/index.tsx` | 予約投稿の説明文に注を続け、スイッチの下に Chronosky の案内を描画する（CSS モジュールを含む） |
| `src/components/common/InlineIcon/index.tsx`        | 文中に置く画像と動画のアイコン                                                                |
| `src/images/chronosky.svg`                          | Chronosky のロゴ（公式サイトの favicon を開発者の許可を得て同梱）                             |

## Requirements Traceability

| Requirement | Summary              | Components |
| ----------- | -------------------- | ---------- |
| 1.1         | 予約できる投稿の案内 | D-1        |
| 2.1, 2.2    | 外部サービスへの案内 | D-2        |
| 3.1         | 多言語対応           | D-1, D-2   |

## Components and Interfaces

#### D-1: 予約できる投稿の注

**Requirements**: 1.1, 3.1

```tsx
// SettingList の行の description に渡す
description: renderSlots(raw("schedule.setting.description"), {
  image: <InlineIcon name="image" alt={t("schedule.setting.mediaImageAlt")} />,
})
```

- 文言は予約投稿の説明文 `schedule.setting.description` の末尾に `{image}の予約投稿のみ対応しています。` を改行せずに続け、アイコンは単語の代わりのため代替テキスト（画像）を付ける。`InlineIcon` に `image` と `video` を加える。
- 文字の大きさと色は設定の行の説明文に従う。

#### D-2: Chronosky への案内

**Requirements**: 2.1, 2.2, 3.1

| 要素   | 内容                                                                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ロゴ   | `chronosky.svg` を18pxの大きさ（文の文字と同程度）で、リンクの直前に文中へ埋め込み、装飾として `alt=""` にする                                                                               |
| 文     | `schedule.setting.chronoskyLead`（`{video}の予約投稿や、高度な機能については{link}をご利用ください。`）。`{video}` に動画のアイコン（代替テキスト「動画」）、`{link}` にロゴとリンクを入れる |
| リンク | `href="https://chronosky.app/"`・`target="_blank"`・`rel="noopener noreferrer"`・説明つきの `aria-label`                                                                                     |

## Error Handling

| 事象                 | 処理                                                     |
| -------------------- | -------------------------------------------------------- |
| ロゴの画像が読めない | 装飾のため、文とリンクだけで案内として成り立つようにする |

## Testing Strategy

- Unit / Build Tests:
  - `npx tsc --noEmit`
- E2E/UI Tests:
  - `tests/e2e/scheduleSetting.spec.ts` 設定のページを開く → 予約投稿の下に、画像と動画のアイコンつきの注と、Chronosky のロゴとリンクが表示される
- テストの名前には、対応する基準 ID を `[schedule-guide/<ID>]` の形で付ける（例: `[schedule-guide/1.1]`）

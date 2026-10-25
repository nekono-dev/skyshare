# 予約投稿の案内 設計書

## 1. 構成

| パス                                                | 責務                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/components/schedule/ScheduleSetting/index.tsx` | 予約投稿の説明文に注を続け、スイッチの下に Chronosky の案内を描画する（CSS モジュールを含む） |
| `src/components/common/InlineIcon/index.tsx`        | 文中に置く画像と動画のアイコン                                                                |
| `src/images/chronosky.svg`                          | Chronosky のロゴ（公式サイトの favicon を開発者の許可を得て同梱）                             |

## 2. 関係図・ワークフロー

- なし

## 3. 設計項目

### D-1: 予約できる投稿の注 (FR-1, NFR-1)

```tsx
// SettingList の行の description に渡す
description: renderSlots(raw("schedule.setting.description"), {
  image: <InlineIcon name="image" alt={t("schedule.setting.mediaImageAlt")} />,
})
```

- 文言は予約投稿の説明文 `schedule.setting.description` の末尾に `{image}の予約投稿のみ対応しています。` を改行せずに続け、アイコンは単語の代わりのため代替テキスト（画像）を付ける。`InlineIcon` に `image` と `video` を加える。
- 文字の大きさと色は設定の行の説明文に従う。

### D-2: Chronosky への案内 (FR-2, NFR-1)

| 要素   | 内容                                                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ロゴ   | `chronosky.svg` を 24px で表示し、装飾として `alt=""` にする                                                                                                                           |
| 文     | `schedule.setting.chronoskyLead`（`{video}の予約投稿や、高度な機能については{link}をご利用ください。`）。`{video}` に動画のアイコン（代替テキスト「動画」）、`{link}` にリンクを入れる |
| リンク | `href="https://chronosky.app/"`・`target="_blank"`・`rel="noopener noreferrer"`・説明つきの `aria-label`                                                                               |

## 4. エラー処理

| 事象                 | 処理                                                     |
| -------------------- | -------------------------------------------------------- |
| ロゴの画像が読めない | 装飾のため、文とリンクだけで案内として成り立つようにする |

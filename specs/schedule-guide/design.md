# 予約投稿の案内 設計書

## 1. 構成

| パス                                                | 責務                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/components/schedule/ScheduleSetting/index.tsx` | 予約投稿のスイッチの下に、注と Chronosky の案内を描画する（CSS モジュールを含む） |
| `src/components/common/InlineIcon/index.tsx`        | 文中に置く画像と動画のアイコン                                                    |
| `src/images/chronosky.svg`                          | Chronosky のロゴ（公式サイトの favicon を開発者の許可を得て同梱）                 |

## 2. 関係図・ワークフロー

- なし

## 3. 設計項目

### D-1: 予約できる投稿の注 (FR-1, NFR-1)

```tsx
<p data-testid="schedule-media-note">
  {renderSlots(raw("schedule.setting.mediaNote"), {
    image: (
      <InlineIcon name="image" alt={t("schedule.setting.mediaImageAlt")} />
    ),
    video: (
      <InlineIcon name="video" alt={t("schedule.setting.mediaVideoAlt")} />
    ),
  })}
</p>
```

- 文言は `schedule.setting.mediaNote`（`{image}の予約投稿のみ対応しており、{video}については対応していません。`）とし、アイコンは単語の代わりのため代替テキスト（画像・動画）を付ける。`InlineIcon` に `image` と `video` を加える。
- 文字は `--font-size-sm` と `--color-text-muted` にし、左右の余白を設定の行に揃える。

### D-2: Chronosky への案内 (FR-2, NFR-1)

| 要素   | 内容                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------- |
| ロゴ   | `chronosky.svg` を 24px で表示し、装飾として `alt=""` にする                                             |
| 文     | `schedule.setting.chronoskyLead`（`{link}` にリンクを入れる）。Chronosky の機能を断定する表現は使わない  |
| リンク | `href="https://chronosky.app/"`・`target="_blank"`・`rel="noopener noreferrer"`・説明つきの `aria-label` |

## 4. エラー処理

| 事象                 | 処理                                                     |
| -------------------- | -------------------------------------------------------- |
| ロゴの画像が読めない | 装飾のため、文とリンクだけで案内として成り立つようにする |

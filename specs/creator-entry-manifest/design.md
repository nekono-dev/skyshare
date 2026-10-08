# クリエイターモードのentry詳細設定 設計書

## 1. 構成

| パス                                                       | 責務                           |
| ---------------------------------------------------------- | ------------------------------ |
| `src/lib/postFeatures/entryManifest.ts`                    | 指定の型と検証                 |
| `src/components/postFeatures/EntryManifestPanel/index.tsx` | 入力のパネルとツールの組み立て |
| `src/components/creator/creatorTools.ts`                   | ツールの登録                   |
| `src/components/post/ThreadComposer/segments.ts`           | `entryManifest` のフィールド   |
| `src/components/post/ThreadComposer/submitThread.ts`       | 指定の送信への反映             |

## 2. 設計項目

### D-1: 指定の状態 (FR-1, FR-6)

```ts
export type EntryManifestOverride = {
  heading?: string // 100文字まで
  caption?: string // 300文字まで
  cover?: { previewUrl: string; blob: Blob } // 1200×630 に切り抜いた画像
}
export const validateEntryManifestOverride = (value: EntryManifestOverride): PlainMessageKey[]
// SegmentState に entryManifest?: EntryManifestOverride を加える
// ツールの disabled = ctx.disabled || !(segment.imageEntry || segment.videoEntry) || manualImageAttach
```

| パネルの要素 | 部品                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------- |
| 見出し       | `CountedTextInput`（上限100）                                                                |
| 説明文       | `CountedTextInput`（上限300）                                                                |
| カバー画像   | 1枚用のファイル入力と `ImageCropDialog`（区画1つ、overlay なし）。選び直しと取り消しのボタン |

### D-2: 送信への反映 (FR-2, FR-3, FR-4, FR-5, FR-7)

```ts
const candidate = segments[entryCandidateIndex] // 既存の素材の選択と同じセグメント
const override = candidate.entryManifest ?? {}
const defaults = buildEntryText({
  userName,
  postText: segments[0].text,
  videoDurationSec,
})
const body = {
  posts,
  createEntry: true,
  heading: override.heading?.trim() || defaults.heading,
  caption: override.caption?.trim() || defaults.caption,
  visual:
    override.cover?.blob ??
    (candidate.imageEntry ?? candidate.videoEntry!).thumbnailBlob,
}
```

見出しと説明文はクライアントが決めて送る形式のため、APIの変更は不要とする。カバー画像の切り抜きには再生ボタンの overlay を渡さない。

## 3. エラー処理

| 事象                       | 処理                                         |
| -------------------------- | -------------------------------------------- |
| 上限を超える入力           | 入力欄にエラーを表示し、送信しない           |
| カバー画像の読み込みの失敗 | パネルにエラーを表示し、既定の代表画像を使う |

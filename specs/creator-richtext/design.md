# クリエイターモードのリンクと装飾 設計書

## 1. 構成

| パス                                                   | 責務                                      |
| ------------------------------------------------------ | ----------------------------------------- |
| `src/util/postFeatures/byteOffset.ts`                  | UTF-16の文字位置とUTF-8のバイト位置の変換 |
| `src/util/postFeatures/yaytext.ts`                     | 装飾文字の変換表と変換・解除              |
| `src/lib/postFeatures/manualFacets.ts`                 | 手動リンクの型と、自動検出との統合        |
| `src/lib/postFeatures/facetReindex.ts`                 | 本文の編集と装飾に伴う範囲の再計算        |
| `src/components/postFeatures/LinkFacetPanel/index.tsx` | リンクのパネルとツールの組み立て          |
| `src/components/postFeatures/YayTextPanel/index.tsx`   | 装飾のパネルとツールの組み立て            |
| `src/components/creator/creatorTools.ts`               | 2つのツールの登録                         |
| `src/components/post/ThreadComposer/segments.ts`       | `manualFacets` のフィールド               |
| `src/components/post/ThreadComposer/submitThread.ts`   | 送信時の統合                              |

## 2. 設計項目

### D-1: 手動リンクと範囲の再計算 (FR-1, FR-3, FR-4, FR-9)

```ts
export type ManualLinkFacet = { id: string; byteStart: number; byteEnd: number; uri: string }
// SegmentState に manualFacets?: ManualLinkFacet[] を追加する
export const charIndexToByteIndex = (text: string, charIndex: number): number =>
  new TextEncoder().encode(text.slice(0, charIndex)).length
export type ByteEdit = { startByte: number; deletedByteLength: number; insertedByteLength: number }
// 共通の接頭辞と接尾辞から1か所の編集区間を求める
export const computeByteEdit = (oldText: string, newText: string): ByteEdit | null
// 入力による編集: 区間より後ろはずらし、区間と重なる範囲は失効させる
export const reindexFacetsAfterEdit = <T extends ByteRange>(facets: T[], edit: ByteEdit): T[]
// 装飾による置換: 置換区間と重なる範囲は端を置換後の区間に合わせて伸縮し、保持する
export const reindexFacetsAfterReplace = <T extends ByteRange>(facets: T[], edit: ByteEdit): T[]
```

- 選択範囲は `window.getSelection()` の `Range` を `extractPlainText` と同じ走査で本文の文字位置に変換し、`charIndexToByteIndex` でバイト位置にする。
- 本文の変更は `useEffect` で前後の本文から `computeByteEdit` を求めて `reindexFacetsAfterEdit` を適用する。装飾は呼び出し側が置換区間を知っているため、`reindexFacetsAfterReplace` を直接適用する。
- パネルは選択範囲のURLの入力欄と、登録済みのリンクの一覧（URLの変更・解除）を持つ。

### D-2: 表示と送信 (FR-2, FR-5)

```ts
export const mergeManualFacetsWithAutoDetected = (
  manual: ManualLinkFacet[], auto: Components.CommonFacetsType | undefined,
): Components.CommonFacetsType
// 1. auto のうち manual のいずれかの範囲と重なるものを除く
// 2. manual を app.bsky.richtext.facet#link に変換する
// 3. 結合して byteStart の昇順に並べる
```

- `submitThread` の `buildPostItem` で `detectFacetsForSubmission(text)` の結果と統合する。サーバーの facet の範囲の検証は変更しない。
- 本文の強調表示（`computeHighlightSegments`）に手動リンクの範囲を加え、下線で表示する。

### D-3: 装飾の変換 (FR-6, FR-7, FR-8, FR-11, NFR-1)

```ts
export type YayTextStyle =
  | "bold"
  | "italic"
  | "boldItalic"
  | "sansBold"
  | "script"
  | "monospace"
  | "doubleStruck"
// A-Z・a-z・0-9 の連番オフセットで生成する。doubleStruck の C H N P Q R Z は ℂℍℕℙℚℝℤ を個別に割り当てる
const STYLE_MAPS: Record<YayTextStyle, Map<string, string>>
const REVERSE_MAP: Map<string, string> // 全スタイルの装飾文字 → 通常の文字
export const removeYayTextStyle = (text: string): string =>
  Array.from(text)
    .map(c => REVERSE_MAP.get(c) ?? c)
    .join("")
export const applyYayTextStyle = (text: string, style: YayTextStyle): string =>
  Array.from(removeYayTextStyle(text))
    .map(c => STYLE_MAPS[style].get(c) ?? c)
    .join("")
```

- 装飾文字はBMP外でサロゲートペアになるため、変換はコードポイント単位（`Array.from`）で行い、選択範囲のUTF-16の位置との変換は境界で分けて扱う。
- パネルは7種のスタイルと解除のボタンを並べる。置換後の本文は `update({ text })` で反映し、文字数のカウンタは本文から再計算される。

### D-4: URLの手動リンクへの置き換え (FR-10)

```
onApplyStyle(style):
  selected = text[charStart..charEnd]
  for url in 自動検出の URL の範囲のうち選択範囲と重なるもの:
    既存の手動リンクと重ならなければ { byteStart, byteEnd, uri: url } を manualFacets に加える
  transformed = applyYayTextStyle(selected, style)
  edit = { startByte, deletedByteLength, insertedByteLength } を置換区間から求める
  manualFacets = reindexFacetsAfterReplace(manualFacets, edit)
  update({ text: 置換後の本文, manualFacets })
```

## 3. エラー処理

| 事象               | 処理                               |
| ------------------ | ---------------------------------- |
| 選択範囲が本文の外 | ツールのボタンを無効にする         |
| URLの形式が不正    | パネルにエラーを表示し、登録しない |

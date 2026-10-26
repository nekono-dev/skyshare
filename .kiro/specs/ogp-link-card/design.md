# Design Document

## Overview

**Purpose**: 投稿の本文に含まれるURLから、ページの題名・説明・画像を取得して投稿に添えられるようにし、共有の直後に相手側でカードが速やかに生成されるようにする。
**Users**: 投稿にリンクカードを添えたい利用者と、共有先でカードを速やかに生成させたい利用者
**Impact**: 本文の URL からページの題名・説明・画像を取得して投稿に添え、entry の作成直後に OGP のキャッシュを事前に温める。

### Goals

- 本文からのURLの検出と、リンクカードの取得操作。
- 取得状況とプレビューの表示。
- OGP抽出APIの契約。
- entryの作成直後のOGPのキャッシュの事前取得。

### Non-Goals

- リンクカードの埋め込みを投稿レコードへ組み立てること。
- OGP抽出サービスの実装。

## Boundary Commitments

### This Spec Owns

- 本文からのURLの検出と、リンクカードの取得操作。
- 取得状況とプレビューの表示。
- OGP抽出APIの契約。
- entryの作成直後のOGPのキャッシュの事前取得。

### Out of Boundary

- リンクカードの埋め込みを投稿レコードへ組み立てること。
- OGP抽出サービスの実装。

### Allowed Dependencies

- OGP 抽出サービス（外部）
- 本文の URL の検出（post-rich-text）
- entry の発行（entry-api）

### Revalidation Triggers

- OGP 抽出 API の契約（クエリ・応答の形）を変えるとき
- 事前取得の打ち切り時間（3秒）を変えるとき
- 抽出サービスの URL の指定を変えるとき（api-codegen の書き換えの対応が影響を受ける）

## Architecture

### Architecture Pattern & Boundary Map

リンクカードの取得に関わる依存方向を示す。

```mermaid
flowchart LR
  ofb["OgpFetchButton/index"] --> get
  op["OgpPreview/index"] --> ofb
  warmOgpCache --> get
  get --> ext_extract["OGP抽出サービス"]
  ofb --> ext_extract
```

## File Structure Plan

| パス                                            | 責務                              |
| ----------------------------------------------- | --------------------------------- |
| `src/components/image/OgpFetchButton/index.tsx` | URLの検出・取得の実行・取得ボタン |
| `src/components/image/OgpPreview/index.tsx`     | 取得状況とプレビューの表示        |
| `src/lib/entry/warmOgpCache.ts`                 | OGPのキャッシュの事前取得         |
| `src/lib/api/schema/v1/extract/get.ts`          | OGP抽出APIのスキーマ              |

## System Flows

取得の成功と失敗による分岐を示す。

```mermaid
sequenceDiagram
  participant ofb as OgpFetchButton/index
  participant op as OgpPreview/index
  participant ext_extract as OGP抽出サービス
  participant warmOgpCache
  ofb->>ext_extract: useOgpFetch が URL を渡す
  alt 抽出に失敗
    ext_extract-->>ofb: エラー
    ofb->>op: 失敗の表示
  else 画像なしまたは取得失敗
    ext_extract-->>ofb: 画像の情報
    ofb->>op: 画像に関する失敗の表示
  else 成功
    ext_extract-->>ofb: 題名・説明・画像
    ofb->>op: 取得済みの表示とプレビュー
  end
  warmOgpCache->>ext_extract: warmOgpCache
```

## Requirements Traceability

| Requirement   | Summary                    | Components |
| ------------- | -------------------------- | ---------- |
| 1.1, 1.2, 1.3 | リンクカードの取得         | D-1        |
| 2.1, 2.2      | OGP 抽出 API               | D-2        |
| 3.1, 3.2, 3.3 | OGP のキャッシュの事前取得 | D-2        |

## Components and Interfaces

#### D-1: 取得と表示

**Requirements**: 1.1, 1.2, 1.3

```ts
export type OgpResult = {
  meta: { title: string; description: string }
  imageBlob: Blob
  sourceUrl: string
}
export type UseOgpFetchResult = {
  detectedUrl: string | null
  isOgpLoading: boolean
  ogpStatus: DeferredMessage | null
  previewUrl: string | null
  title?: string
  handleFetchOgp: () => void
  clearOgpStatus: () => void
}
```

| 段階       | 内容                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| URLの検出  | `RichText` で本文のリンクを検出し、最初のURLを使う。検出に失敗したときは `https?://` の正規表現で補う               |
| 取得       | `extractUrl({ url })` の結果から画像のURLを取り、画像を取得して `createOgpThumbnailFromBlob` でサムネイルに変換する |
| 失敗の分類 | 抽出の失敗・画像なし・画像の取得失敗・画像の形式が不正・変換の失敗・予期しない例外の6種に文言を出し分ける           |
| 取得ボタン | URLがあるときだけ描画し、取得中は無効にする                                                                         |
| プレビュー | 取得中・取得状況の文言・画像を描画し、取り外しの操作があるときは取り外しのボタンを付ける                            |

#### D-2: 抽出APIとキャッシュの事前取得

**Requirements**: 2.1, 2.2, 3.1, 3.2, 3.3

```ts
// GET /v1/extract?url=<url> → 200 { title, description, image?, url }
export const warmOgpCache = async (url: string): Promise<void> => {
  if (!url) return
  try {
    await extractUrl({ url }, { signal: AbortSignal.timeout(3000) })
  } catch {}
}
```

- 事前取得は、共有の直後に相手側がカードを生成するとき、初回のアクセスが遅くなるのを避けるために行う。失敗は握りつぶす。

## Error Handling

| 事象               | 処理                                           |
| ------------------ | ---------------------------------------------- |
| 取得の各段階の失敗 | 状況の文言を表示し、リンクカードを未設定にする |
| 事前取得の失敗     | 無視する                                       |

## Testing Strategy

- Unit / Build Tests:
  - `npx vitest run tests/lib/entry/warmOgpCache.test.ts tests/lib/api/schema/extract.test.ts`
  - `npx tsc --noEmit`
- E2E/UI Tests:
  - `tests/e2e/ogpLinkCard.spec.ts` ゲスト表示の投稿ページで本文にURLを入力して取得ボタンを押す → ボタンはURLがあるときだけ現れ、成功では取得済みの表示とプレビューが、失敗では失敗の表示が現れる
- テストの名前には、対応する基準 ID を `[ogp-link-card/<ID>]` の形で付ける（例: `[ogp-link-card/1.1]`）

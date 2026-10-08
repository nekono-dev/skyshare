# 投稿フォーム 設計書

## 1. 構成

| パス                                                             | 責務                                               |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| `src/components/post/ThreadComposer/index.tsx`                   | セグメント配列・編集中の位置・送信・共有設定の配置 |
| `src/components/post/ThreadComposer/ThreadSegmentForm/index.tsx` | 1セグメントの編集表示と簡略表示                    |
| `src/components/post/ThreadComposer/segments.ts`                 | セグメントの状態と追加・削除・下書き変換           |
| `src/components/post/ThreadComposer/submitThread.ts`             | 送信内容の組み立てと送信                           |
| `src/lib/entry/draftList.ts`                                     | 下書き一覧の応答の整形                             |
| `src/components/entry/DraftListPanel/index.tsx`                  | 下書きの一覧と復元                                 |

## 2. 設計項目

### D-1: セグメントの状態 (FR-1, FR-2, FR-5)

```ts
export type SegmentState = {
  id: string
  text: string
  languageCode: string
  selfLabel: CreateEntryBodySelfLabels | undefined
  postGate: PostGateValue
  imageEntry: ImageEntry | null
  ogpResult: OgpResult | null
  videoEntry: VideoEntry | null
}
export const createEmptySegment = (languageCode: string): SegmentState // id は crypto.randomUUID()
export const addSegment = (segments: SegmentState[], languageCode: string): SegmentState[] // MAX_THREAD_POST_COUNT で止める
export const canRemoveSegment = (index: number): boolean => index > 0
export const removeSegment = (segments: SegmentState[], index: number): SegmentState[]
```

`ThreadComposer` は `segments` と `activeIndex` を保持する。単発投稿はセグメントが1件の場合として同じコンポーネントで扱う。各セグメントは入力部品（`PostBodyEditor` `ImagePicker` `VideoPicker` `OgpFetchButton` `PostGateDialog` `SelfLabelsSelect` `LanguageSelect`）を個別にインスタンス化し、`id` はセグメントの位置から一意に決める。

### D-2: セグメントの表示 (FR-3, FR-4, FR-6, NFR-1)

```tsx
<div data-testid={`thread-segment-${index}`}>
  <Avatar size="md" />
  {hasNext && <div className={styles["connector-line"]} aria-hidden="true" />}
  {/* 編集表示と簡略表示を常にマウントし、hidden で切り替える */}
  <div hidden={!isActive} data-testid="segment-editor">
    本文・入力部品・ツールボックス
  </div>
  <div hidden={isActive} className={styles.row}>
    本文の要約・画像のサムネイル・削除ボタン
  </div>
</div>
```

- 条件付きの描画で入力部品をアンマウントすると、`ImagePicker` の内部stateが消えて添付済みの画像のプレビューが失われるため、`hidden` で切り替える。
- 簡略表示は `imageEntry.thumbnailPreview` を読み取り専用で表示し、`canRemoveSegment(index)` のときだけ削除ボタンを出す。
- ツールボックス（返信・引用の設定、言語、画像添付、自己ラベル）は、アバターの列の下まで含めた全幅に置く。アバターの縦線は先頭行の範囲に限る。

### D-3: 送信 (FR-7, FR-8, FR-10)

```ts
const entryCandidateIndex = segments.findIndex(
  s => (!!s.imageEntry || !!s.videoEntry) && !manualImageAttach,
)
const posts = await Promise.all(segments.map(buildPostItem)) // 動画 > 画像 > リンクカードの順で1つを載せる
const body = {
  posts,
  ...(entryCandidateIndex !== -1
    ? {
        createEntry: true,
        ...buildEntryText({
          userName,
          postText: segments[0].text,
          videoDurationSec,
        }),
        visual: (
          segments[entryCandidateIndex].imageEntry ??
          segments[entryCandidateIndex].videoEntry!
        ).thumbnailBlob,
      }
    : {}),
}
const res = await createEntry(body) // 1回だけ送信する
```

- 本文のリンク・メンション・ハッシュタグは `detectFacetsForSubmission` で送信直前に検出する。
- entryを要求したのに応答に `skyshareEntry` が無い場合は失敗として扱う。
- 状態は送信中・成功・失敗の3つとし、セグメントごとの進捗は表示しない。
- 成功後の共有処理には、先頭のセグメントの本文・応答のentryのURL・先頭のセグメントのリンクカードのURLを渡す。

### D-4: 下書き (FR-9)

| 方向 | 変換                                                                                       |
| ---- | ------------------------------------------------------------------------------------------ |
| 保存 | `segmentsToDraftPosts(segments)` → `{ text, labels? }[]` を下書きAPIの `posts` に送る      |
| 復元 | `draftPostsToSegments(posts, languageCode)` → 画像・動画・リンクカードが空のセグメント配列 |
| 一覧 | `draftList.ts` が `{ id, posts, updatedAt }` に整形する                                    |

### D-5: 設定の配置 (FR-11, FR-12)

| 領域           | 並び順                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 主トグル       | ポップアップを開く設定 → 画像を自分で添付                                                                                                                                                        |
| 詳細オプション | 自動ポップアップするSNS（ポップアップを開く設定がONのときだけ） → 長文を省略して共有（`disabled={isSubmitting \|\| manualImageAttach}`） → 返信・引用の設定を保存 → 投稿フォームを固定表示しない |

```ts
const resolveShareOptionsDefaultOpen = ({
  optionsList,
}: {
  optionsList: boolean[]
}) => optionsList.some(Boolean)
// optionsList: [pinnedFormDisabled, shareToggles.truncateIntentText]
```

共有設定はマウント後に読み込まれるため、`Collapsible` の `key` を読み込み完了で切り替えて再マウントし、`defaultOpen` を実際の値で評価し直す。

## 3. エラー処理

| 事象               | 処理                                               |
| ------------------ | -------------------------------------------------- |
| 投稿APIの失敗      | エラーコードから文言キーを決めて表示し、入力を残す |
| 投稿者名の取得失敗 | entryの作成失敗として扱い、送信しない              |
| 応答にentryが無い  | entryの作成失敗として扱う                          |

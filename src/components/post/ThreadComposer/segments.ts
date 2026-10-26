/**
 * ThreadComposer のセグメント配列（スレッド投稿の各投稿単位）を扱う純粋関数群。
 *
 * 責務と処理概要:
 * - Reactの外側で完結する、セグメントの追加・削除・下書き変換・予約の書き戻しのロジックのみを持つ
 *   （DOM・API呼び出し・Reactの state 更新には一切触れない）。
 * - `.kiro/specs/thread-composer`の決定により、先頭（1件目）segmentは
 *   スレッドの起点のため削除できない。2件目以降は編集中かどうかに関わらずいつでも削除できる。
 */
import type {
    CreateEntryBodySelfLabels,
    ScheduleDetail,
} from "@/client/openapi/model"
import type { ImageEntry } from "@/components/image/ImagePicker"
import type { OgpResult } from "@/components/image/OgpFetchButton"
import { DEFAULT_POST_GATE_VALUE, type PostGateValue } from "@/lib/atproto/gate"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/post"
import type { SlotCropState } from "@/lib/image/postImageProcessing"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import type {
    VideoBlobRef,
    VideoUploadProgress,
} from "@/lib/video/videoUploader"

/**
 * segment に添付した動画。選択直後に先行アップロードし、`upload` で状態を持つ。
 * 動画の `File` は保持しない（アップロード後は blob 参照だけが必要）。
 */
export type VideoEntry = {
    fileName: string
    width: number
    height: number
    durationSec: number
    alt: string
    /** poster のプレビュー用 object URL（取り外し時に revoke する） */
    posterPreview: string
    /** poster（JPEG） */
    posterBlob: Blob
    /** visual に使う poster の切り抜き状態（「サムネ調整」で更新する） */
    cropState: SlotCropState
    /** `thumbnailBlob` の object URL（プレビュー・縮小表示用。差し替え・取り外し時に revoke する） */
    thumbnailPreview: string
    /** visual（`cropState` の切り抜きに再生ボタンを重ねた 1200x630 の画像） */
    thumbnailBlob: Blob
    upload:
        | { state: "uploading"; progress: VideoUploadProgress }
        | { state: "done"; blob: VideoBlobRef }
        | { state: "error"; messageKey: PlainMessageKey }
}

export type SegmentState = {
    /** React の key・非アクティブ切替時の同一性判定にのみ使う、UI上だけの識別子。API送信・下書きには含めない。 */
    id: string
    text: string
    languageCode: string
    selfLabel: CreateEntryBodySelfLabels | undefined
    postGate: PostGateValue
    imageEntry: ImageEntry | null
    ogpResult: OgpResult | null
    videoEntry: VideoEntry | null
}

export type DraftSegmentPost = {
    text: string
    labels?: string[]
}

/**
 * セグメント識別子を新規発行する。
 */
const createSegmentId = (): string =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `segment-${Date.now()}-${Math.random().toString(36).slice(2)}`

/**
 * 空のセグメントを1件作る。
 *
 * Input:
 * - `languageCode`: 新規セグメントの初期言語コード
 *
 * Output:
 * - 未入力状態の `SegmentState`
 */
export const createEmptySegment = (languageCode: string): SegmentState => ({
    id: createSegmentId(),
    text: "",
    languageCode,
    selfLabel: undefined,
    postGate: DEFAULT_POST_GATE_VALUE,
    imageEntry: null,
    ogpResult: null,
    videoEntry: null,
})

/**
 * 画像エントリが保持する object URL を解放する。
 *
 * Input:
 * - `entry`: プレビュー URL を保持する画像エントリ
 *
 * Output:
 * - なし
 */
export const revokeImageEntry = (entry: ImageEntry | null) => {
    if (!entry) return

    try {
        entry.originalPreviews?.forEach(p => {
            try {
                URL.revokeObjectURL(p)
            } catch (e) {}
        })
        try {
            URL.revokeObjectURL(entry.thumbnailPreview)
        } catch (e) {}
    } catch (error) {
        console.warn("ThreadComposer: failed to revoke object URL", error)
    }
}

/**
 * 動画エントリが保持する poster の object URL を解放する。
 *
 * Input:
 * - `entry`: プレビュー URL を保持する動画エントリ
 */
export const revokeVideoEntry = (entry: VideoEntry | null) => {
    if (!entry) return
    try {
        URL.revokeObjectURL(entry.posterPreview)
        URL.revokeObjectURL(entry.thumbnailPreview)
    } catch (error) {
        console.warn("ThreadComposer: failed to revoke object URL", error)
    }
}

/**
 * スレッド末尾にセグメントを1件追加する。
 *
 * 処理の趣旨:
 * - `MAX_THREAD_POST_COUNT`（バックエンドの`posts`配列上限と共通）に達している場合は
 *   何もしない（呼び出し側でボタンを`disabled`にする想定の防御的な上限）。
 *
 * Input:
 * - `segments`: 現在のセグメント配列
 * - `languageCode`: 追加するセグメントの初期言語コード
 *
 * Output:
 * - 末尾に1件追加したセグメント配列（上限到達時は元の配列と同じ内容の新配列）
 */
export const addSegment = (
    segments: SegmentState[],
    languageCode: string,
): SegmentState[] => {
    if (segments.length >= MAX_THREAD_POST_COUNT) return segments
    return [...segments, createEmptySegment(languageCode)]
}

/**
 * 指定indexのセグメントを削除できるか判定する。
 *
 * Input:
 * - `index`: 対象セグメントのindex
 *
 * Output:
 * - 先頭（0件目）以外なら `true`
 *
 * 例:
 * - 入力: `0`
 * - 出力: `false`
 */
export const canRemoveSegment = (index: number): boolean => index > 0

/**
 * セグメントを1件削除する。
 *
 * 処理の趣旨:
 * - 先頭（`index === 0`）は削除不可（スレッドの起点のため）。呼び出し側で
 *   `canRemoveSegment` により削除ボタン自体を出し分ける想定だが、ここでも
 *   二重に防御する。
 *
 * Input:
 * - `segments`: 現在のセグメント配列
 * - `index`: 削除対象のindex
 *
 * Output:
 * - 削除後のセグメント配列（削除不可な場合は元の配列）
 */
export const removeSegment = (
    segments: SegmentState[],
    index: number,
): SegmentState[] => {
    if (!canRemoveSegment(index)) return segments
    return segments.filter((_, i) => i !== index)
}

/**
 * セグメントが投稿条件（`POST /v2/entry`が受理する条件）を満たすか判定する。
 *
 * 処理の趣旨:
 * - バックエンドは、画像もOGPリンクも無い「テキストのみ」の投稿では、空白除去後の
 *   `text`が1文字以上であることを要求する（空白のみは未指定扱いで400になる）。
 *   画像付き・OGPリンク付きの投稿は`text`を省略できる。WebUI側でも同じ条件で
 *   投稿ボタンをブロックするため、この条件はバックエンドのスキーマと一致させること。
 *
 * Input:
 * - `segment`: 判定対象のセグメント
 *
 * Output:
 * - 投稿可能なら `true`
 *
 * 例:
 * - 入力: `{ text: "  ", imageEntry: null, ogpResult: null, ... }`
 * - 出力: `false`
 */
export const isSegmentPostable = (segment: SegmentState): boolean =>
    segment.text.trim().length > 0 ||
    (segment.imageEntry?.originalBlobs.length ?? 0) > 0 ||
    segment.ogpResult !== null ||
    segment.videoEntry?.upload.state === "done"

/**
 * アップロード・変換が完了していない動画（実行中・失敗）が1つでも残っているか判定する。
 * 真の間は投稿できない。解消できるのは、完了を待つ・取り外す（キャンセル）・
 * 失敗した動画を選び直して完了させる、のいずれか。
 *
 * Input:
 * - `segments`: 現在のセグメント配列
 *
 * Output:
 * - 未完了の動画が残っていれば、その状態（`uploading` / `error`）。無ければ `null`
 */
export const pendingVideoState = (
    segments: SegmentState[],
): "uploading" | "error" | null => {
    let state: "uploading" | "error" | null = null
    for (const segment of segments) {
        const upload = segment.videoEntry?.upload
        if (upload?.state === "error") return "error"
        if (upload?.state === "uploading") state = "uploading"
    }
    return state
}

export const hasPendingVideo = (segments: SegmentState[]): boolean =>
    pendingVideoState(segments) !== null

/** 動画を持つセグメントがあるか。動画を含む投稿は予約できないため、予約の操作の可否に使う。 */
export const hasVideoSegment = (segments: SegmentState[]): boolean =>
    segments.some(segment => segment.videoEntry !== null)

/**
 * 全セグメントが投稿条件を満たすか判定する（1件でも満たさなければ全体を投稿できない）。
 *
 * Input:
 * - `segments`: 現在のセグメント配列
 *
 * Output:
 * - 全件投稿可能なら `true`（空配列は投稿不可として `false`）
 */
export const areAllSegmentsPostable = (segments: SegmentState[]): boolean =>
    segments.length > 0 &&
    segments.every((segment, index) => isSegmentPostable(segment))

/**
 * セグメント配列を下書きAPI（`POST`/`PUT /v2/bsky/drafts`）の`posts`配列へ変換する。
 *
 * 処理の趣旨:
 * - 下書きは画像等の埋め込みを持たない既存方針（デバイスローカル参照のため）を踏襲し、
 *   `text`/`labels`のみを抽出する。
 *
 * Input:
 * - `segments`: 現在のセグメント配列
 *
 * Output:
 * - `{ text, labels? }[]`
 */
export const segmentsToDraftPosts = (
    segments: SegmentState[],
): DraftSegmentPost[] =>
    segments.map(segment => ({
        text: segment.text,
        labels: segment.selfLabel ? [segment.selfLabel] : undefined,
    }))

/**
 * 下書きAPIの`posts`配列からセグメント配列を復元する。
 *
 * 処理の趣旨:
 * - 画像・OGP・返信/引用設定は下書きに含まれないため、復元後は常に初期値になる
 *   （既存方針、design.md §4.4）。
 *
 * Input:
 * - `posts`: 下書きの`posts`配列
 * - `languageCode`: 復元後の各セグメントに設定する言語コード
 *
 * Output:
 * - 復元された `SegmentState[]`（1件も無い場合は空配列。呼び出し側で
 *   `createEmptySegment`によるフォールバックが必要）
 */
export const draftPostsToSegments = (
    posts: DraftSegmentPost[],
    languageCode: string,
): SegmentState[] =>
    posts.map(post => ({
        id: createSegmentId(),
        text: post.text,
        languageCode,
        selfLabel: post.labels?.[0] as CreateEntryBodySelfLabels | undefined,
        postGate: DEFAULT_POST_GATE_VALUE,
        imageEntry: null,
        ogpResult: null,
        videoEntry: null,
    }))

/**
 * 予約の内容（`GET /v2/schedules/{id}`）と画像を、投稿フォームのセグメント配列に戻す。
 *
 * 処理の趣旨:
 * - 画像は保管された（送信用に加工済みの）画像を `originalBlobs` に、`imagesMeta` を `meta` に入れる。
 *   代表画像は、予約に代表画像があればそれを、無ければ先頭の画像を `thumbnailBlob` にする。
 * - リンクカードは `ogMeta` と `ogImage` の画像から作る。画像があるときはリンクカードより画像を優先する。
 * - 返信と引用の制限・自己ラベル・言語を戻す。`langs` が無い投稿は `languageCode` を使う。
 * - 画像が欠けた番号は、その画像を除いて戻す（呼び出し側は全画像の取得の成功を確かめてから呼ぶ）。
 *
 * Input:
 * - `detail`: 予約の内容
 * - `images`: 番号ごとの画像（`images[n]` が番号 n の画像）
 * - `languageCode`: 言語の指定が無い投稿に使う言語
 *
 * Output: セグメント配列（1件以上）
 *
 * Example:
 * - `scheduleDetailToSegments({ posts: [{ text: "a", images: [0], imagesMeta: [...] }] }, [blob], "ja")`
 *   → 画像1枚を持つ1件のセグメント
 */
export const scheduleDetailToSegments = (
    detail: ScheduleDetail,
    images: Blob[],
    languageCode: string,
): SegmentState[] => {
    const visualBlob =
        detail.visual !== undefined ? images[detail.visual] : undefined
    const segments = detail.posts.map((post, index): SegmentState => {
        const blobs = (post.images ?? [])
            .map(n => images[n])
            .filter((blob): blob is Blob => blob instanceof Blob)
        // 代表画像は先頭の画像つきのセグメントだけが使う（送信の組み立てと同じ規則）
        const thumbnailBlob =
            blobs.length > 0
                ? ((index === firstImageIndex(detail)
                      ? visualBlob
                      : undefined) ?? blobs[0]!)
                : undefined
        const imageEntry: ImageEntry | null =
            blobs.length > 0 && thumbnailBlob
                ? {
                      originalBlobs: blobs,
                      thumbnailBlob,
                      originalPreviews: blobs.map(blob =>
                          URL.createObjectURL(blob),
                      ),
                      thumbnailPreview: URL.createObjectURL(thumbnailBlob),
                      sourceFileNames: blobs.map((_, i) => `image-${i + 1}`),
                      meta: blobs.map((_, i) => ({
                          width: post.imagesMeta?.[i]?.width,
                          height: post.imagesMeta?.[i]?.height,
                          alt: post.imagesMeta?.[i]?.alt ?? "",
                      })),
                  }
                : null
        const ogBlob =
            post.ogImage !== undefined ? images[post.ogImage] : undefined
        const ogpResult: OgpResult | null =
            !imageEntry && post.ogMeta && ogBlob
                ? {
                      meta: {
                          title: post.ogMeta.title,
                          description: post.ogMeta.description,
                      },
                      imageBlob: ogBlob,
                      sourceUrl: post.ogMeta.url,
                  }
                : null
        return {
            id: createSegmentId(),
            text: post.text ?? "",
            languageCode: post.langs?.[0] ?? languageCode,
            selfLabel: post.selfLabels as CreateEntryBodySelfLabels | undefined,
            postGate: post.gate
                ? { ...DEFAULT_POST_GATE_VALUE, ...post.gate }
                : DEFAULT_POST_GATE_VALUE,
            imageEntry,
            ogpResult,
            videoEntry: null,
        }
    })
    return segments.length > 0 ? segments : [createEmptySegment(languageCode)]
}

/** 画像を持つ最初の投稿の位置。無ければ -1 */
const firstImageIndex = (detail: ScheduleDetail): number =>
    detail.posts.findIndex(post => (post.images?.length ?? 0) > 0)

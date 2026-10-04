/**
 * ThreadComposer のセグメント配列（スレッド投稿の各投稿単位）を扱う純粋関数群。
 *
 * 責務と処理概要:
 * - Reactの外側で完結する、セグメントの追加・削除・下書き変換ロジックのみを持つ
 *   （DOM・API呼び出し・Reactの state 更新には一切触れない）。
 * - `specs/threadpost/requirements.md §5`の決定により、先頭（1件目）segmentは
 *   スレッドの起点のため削除できない。2件目以降は編集中かどうかに関わらずいつでも削除できる。
 */
import type { CreateEntryBodySelfLabels } from "@/client/openapi/model"
import type { ImageEntry } from "@/components/image/ImagePicker"
import type { OgpResult } from "@/components/image/OgpFetchButton"
import { DEFAULT_POST_GATE_VALUE, type PostGateValue } from "@/lib/atproto/gate"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/post"

export type SegmentState = {
    /** React の key・非アクティブ切替時の同一性判定にのみ使う、UI上だけの識別子。API送信・下書きには含めない。 */
    id: string
    text: string
    languageCode: string
    selfLabel: CreateEntryBodySelfLabels | undefined
    postGate: PostGateValue
    imageEntry: ImageEntry | null
    ogpResult: OgpResult | null
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
    }))

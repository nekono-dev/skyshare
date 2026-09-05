/**
 * WebShareAPI 実行ユーティリティ。
 *
 * 責務と処理概要:
 * - ブラウザの WebShareAPI 対応可否を判定する。
 * - 実際の共有実行を統一し、失敗理由を呼び出し側へ返す。
 */

type ShareFailureReason = "aborted" | "failed"

type ShareExecutionResult = {
    ok: boolean
    reason?: ShareFailureReason
}

/**
 * 指定データで WebShareAPI が利用可能か判定する。
 *
 * Input:
 * - `shareData`: 共有候補データ（省略時は API 対応可否のみ判定）
 *
 * Output:
 * - 利用可能なら `true`
 *
 * 例:
 * - 入力: `{ text: "hello" }`
 * - 出力: `true`（対応ブラウザの場合）
 */
export const canShareWithWebApi = (shareData?: ShareData) => {
    if (typeof navigator === "undefined") {
        return false
    }
    if (navigator.share === undefined || navigator.canShare === undefined) {
        return false
    }
    if (shareData && !navigator.canShare(shareData)) {
        return false
    }
    return true
}

/**
 * WebShareAPI で共有を実行する。
 *
 * Input:
 * - `shareData`: 共有するデータ
 *
 * Output:
 * - 成功時 `{ ok: true }`、失敗時 `{ ok: false, reason }`
 *
 * 例:
 * - 入力: `{ text: "投稿本文" }`
 * - 出力: `{ ok: true }`
 */
export const shareWithWebApi = async (
    shareData: ShareData,
): Promise<ShareExecutionResult> => {
    try {
        await navigator.share(shareData)
        return { ok: true }
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            return { ok: false, reason: "aborted" }
        }
        return { ok: false, reason: "failed" }
    }
}

/**
 * Blob を WebShareAPI が要求する File へ変換する。
 *
 * Input:
 * - `blob`: 画像 Blob
 * - `index`: ファイル名採番用のインデックス
 *
 * Output:
 * - MIME タイプから拡張子を推定した `File`
 *
 * 例:
 * - 入力: `image/png` の Blob, `0`
 * - 出力: ファイル名 `image-0.png` の `File`
 */
export const toShareFile = (blob: Blob, index: number) => {
    const extension = blob.type.split("/")[1] ?? "png"
    return new File([blob], `image-${index}.${extension}`, {
        type: blob.type,
    })
}

/**
 * WebShareAPI へ渡す共有テキストを組み立てる。
 *
 * 処理の趣旨:
 * - `@/util/share/intent`の`buildIntentText`と同じ「本文 + 改行 + URL」形式を
 *   WebShareAPI向けにも踏襲する。
 *
 * Input:
 * - `text`: 元の投稿本文
 * - `url`: 本文に付加するURL（skyshare entryのURL等）
 *
 * Output:
 * - WebShareAPI の `text` に渡す1つの文字列
 *
 * 例:
 * - 入力: `"こんにちは"`, `"https://example.com"`
 * - 出力: `"こんにちは\nhttps://example.com"`
 */
export const buildWebShareText = (text: string, url: string) => {
    const normalizedText = text.trim()
    if (normalizedText.length === 0) {
        return url
    }
    return `${normalizedText}\n${url}`
}

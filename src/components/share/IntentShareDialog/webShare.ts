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

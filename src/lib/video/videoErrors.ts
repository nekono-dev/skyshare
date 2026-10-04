/**
 * 動画投稿のエラー種別と、利用者向けメッセージキーの対応。
 */
import type { PlainMessageKey } from "@/lib/i18n/translate"

/** 添付時に検査するエラー（形式・サイズ・長さ・読み込み） */
export type VideoValidationError =
    "unsupportedFormat" | "tooLarge" | "tooLong" | "unreadable"

/** アップロード・変換で発生しうるエラー */
export type VideoUploadErrorCode =
    | "tooLarge"
    | "badAspectRatio"
    | "dailyLimit"
    | "forbidden"
    | "tooManyUploads"
    | "overloaded"
    | "processingFailed"
    | "timeout"
    | "network"
    | "unsupportedPds"
    | "unknown"

export class VideoUploadError extends Error {
    constructor(
        readonly code: VideoUploadErrorCode,
        message?: string,
    ) {
        super(message ?? code)
        this.name = "VideoUploadError"
    }
}

export type VideoErrorCode = VideoValidationError | VideoUploadErrorCode

const MESSAGE_KEYS = {
    unsupportedFormat: "video.error.unsupportedFormat",
    tooLarge: "video.error.tooLarge",
    tooLong: "video.error.tooLong",
    unreadable: "video.error.unreadable",
    badAspectRatio: "video.error.badAspectRatio",
    dailyLimit: "video.error.dailyLimit",
    forbidden: "video.error.forbidden",
    tooManyUploads: "video.error.tooManyUploads",
    overloaded: "video.error.overloaded",
    processingFailed: "video.error.processingFailed",
    timeout: "video.error.timeout",
    unsupportedPds: "video.error.unsupportedPds",
    network: "video.error.network",
    unknown: "video.error.unknown",
} as const satisfies Record<VideoErrorCode, PlainMessageKey>

/**
 * エラー種別を利用者向けメッセージキーへ変換する。
 *
 * 例:
 * - 入力: `"tooLong"`
 * - 出力: `"video.error.tooLong"`
 */
export const mapVideoError = (code: VideoErrorCode): PlainMessageKey =>
    MESSAGE_KEYS[code]

/** 動画サービスのエラー名（`{ error: string }`）を `VideoUploadErrorCode` へ対応づける。 */
export const mapServiceErrorName = (name: unknown): VideoUploadErrorCode => {
    switch (name) {
        case "VideoTooLarge":
            return "tooLarge"
        case "BadAspectRatio":
            return "badAspectRatio"
        case "DailyLimitExceeded":
            return "dailyLimit"
        case "UploadForbidden":
            return "forbidden"
        case "TooManyOpenUploads":
            return "tooManyUploads"
        case "ServiceOverloaded":
            return "overloaded"
        default:
            return "unknown"
    }
}

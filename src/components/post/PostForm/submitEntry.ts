/**
 * PostForm の投稿送信（OpenAPI契約への整形とAPI呼び出し）を担うモジュール。
 *
 * 責務と処理概要:
 * - 画像投稿は `createEntry`（skyshare entry を伴う）、テキスト・OGP投稿・
 *   手動画像添付投稿（`manualImageAttach` 有効時の画像投稿）は `createBskyRecord`
 *   （skyshare entry を伴わない）を呼び出す。手動画像添付投稿でも Bluesky への
 *   画像添付自体は行う。
 * - 画像投稿では不足しうる `imagesMeta` を補完して送信する。
 * - API エラーコードをユーザー向け文言へ変換する。
 */
import { createBskyRecord, createEntry } from "@/client/openapi/client"
import type {
    CreateBskyRecordBody,
    CreateEntryBody,
    CreateEntryBodySelfLabels,
} from "@/client/openapi/model"
import type { ImageEntry } from "@/components/image/ImagePicker"
import type { OgpResult } from "@/components/image/OgpFetchButton"

export type SubmitEntryParams = {
    text: string
    languageCode: string
    selfLabel?: CreateEntryBodySelfLabels
    imageEntry: ImageEntry | null
    manualImageAttach: boolean
    ogpResult: OgpResult | null
}

export type SubmitEntryResult =
    { ok: true; skyshareUri: string } | { ok: false; message: string }

type ImageSizeCandidate = {
    width?: number
    height?: number
}

/**
 * API エラーコードを表示文言へ変換する。
 *
 * Input:
 * - `errorCode`: API から返却されたエラーコード
 *
 * Output:
 * - ユーザー向け日本語メッセージ
 *
 * 例:
 * - 入力: "APP_BSKY_POST_FAILED"
 * - 出力: "Blueskyへの投稿に失敗しました。"
 */
const resolveEntryErrorMessage = (errorCode: string) => {
    switch (errorCode) {
        case "APP_BSKY_POST_FAILED":
            return "Blueskyへの投稿に失敗しました。"
        case "SKYSHARE_ENTRY_CREATE_FAILED":
            return "Blueskyへの投稿は成功しましたが、SkyShareレコード作成に失敗しました。"
        case "ENTRY_CREATE_UNEXPECTED_ERROR":
            return "投稿処理中に予期せぬエラーが発生しました。"
        default:
            return errorCode
    }
}

/**
 * Blob から画像の自然サイズを読み取る。
 *
 * 処理の趣旨:
 * - ImagePicker 側でサイズ取得に失敗した場合でも、送信直前に API 必須の width/height を補完する。
 *
 * Input:
 * - `blob`: 投稿対象の画像 Blob
 *
 * Output:
 * - `{ width, height }`
 *
 * 例:
 * - 入力: JPEG Blob
 * - 出力: `{ width: 1200, height: 630 }`
 */
const loadBlobImageSize = async (blob: Blob) => {
    const objectUrl = URL.createObjectURL(blob)

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const nextImage = new Image()
            nextImage.onload = () => resolve(nextImage)
            nextImage.onerror = () =>
                reject(new Error("画像サイズの取得に失敗しました。"))
            nextImage.src = objectUrl
        })

        if (image.naturalWidth < 1 || image.naturalHeight < 1) {
            throw new Error("画像サイズが不正です。")
        }

        return {
            width: image.naturalWidth,
            height: image.naturalHeight,
        }
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

/**
 * 画像サイズ候補が API 契約を満たす完全な width/height を持つか判定する。
 *
 * Input:
 * - `value`: ImagePicker が保持している画像サイズ候補
 *
 * Output:
 * - 完全なサイズなら `true`
 *
 * 例:
 * - 入力: `{ width: 800, height: 600 }`
 * - 出力: `true`
 */
const hasValidImageSize = (
    value: ImageSizeCandidate,
): value is { width: number; height: number } => {
    return (
        typeof value?.width === "number" &&
        value.width > 0 &&
        typeof value.height === "number" &&
        value.height > 0
    )
}

/**
 * 画像投稿用の imagesMeta を必ず完全な形で組み立てる。
 *
 * 想定する入力形状:
 * - `entry.originalBlobs` は投稿対象画像の配列
 * - `entry.meta` は ImagePicker が保持する元画像サイズ配列（欠落の可能性あり）
 *
 * 処理の趣旨:
 * - 既存メタデータが完全ならそれを利用する。
 * - 欠落がある場合は Blob から再読込して API 契約を満たす。
 *
 * Input:
 * - `entry`: 投稿対象の画像エントリ
 *
 * Output:
 * - API に送信できる `imagesMeta`
 *
 * 例:
 * - 入力: meta が完全な `ImageEntry`
 * - 出力: 既存 meta をそのまま返す
 */
const resolveImageMetadata = async (
    entry: ImageEntry,
): Promise<NonNullable<CreateEntryBody["imagesMeta"]>> => {
    const imageSizes = entry.meta ?? []
    const hasCompleteImageSizes =
        imageSizes.length === entry.originalBlobs.length &&
        imageSizes.every(value => hasValidImageSize(value))

    if (hasCompleteImageSizes) {
        return imageSizes.map(value => ({
            width: value.width,
            height: value.height,
        }))
    }

    return Promise.all(
        entry.originalBlobs.map((blob, index) => loadBlobImageSize(blob)),
    )
}

/**
 * 投稿フォームの入力内容を OpenAPI 契約へ整形して送信する。
 *
 * 処理の趣旨:
 * - skyshare entry を作成するのは `manualImageAttach` が無効な画像投稿の場合のみ。
 *   `manualImageAttach` が有効な場合（skyshare entry を作らずBlueskyにのみ画像を
 *   添付したい場合）や、画像が無い投稿（テキスト投稿・OGP投稿）は skyshare entry
 *   を伴わないため、v2/bsky 名前空間の純粋な bypass エンドポイントを使う
 *   （画像添付自体はこの経路でも行う）。
 *
 * Input:
 * - `params`: 投稿内容一式
 *
 * Output:
 * - 成功時 `{ ok: true, skyshareUri }`（画像投稿以外は空文字）、失敗時 `{ ok: false, message }`
 *
 * 例:
 * - 入力: テキストのみのフォーム内容
 * - 出力: `{ ok: true, skyshareUri: "" }`
 */
export const submitEntry = async (
    params: SubmitEntryParams,
): Promise<SubmitEntryResult> => {
    const {
        text,
        languageCode,
        selfLabel,
        imageEntry,
        manualImageAttach,
        ogpResult,
    } = params

    if (imageEntry && !manualImageAttach) {
        const payload: CreateEntryBody = {
            text,
            langs: [languageCode],
            selfLabels: selfLabel,
            ogImage: imageEntry.thumbnailBlob,
            images: imageEntry.originalBlobs,
            imagesMeta: await resolveImageMetadata(imageEntry),
        }

        const res = await createEntry(payload)
        if (res.status !== 200) {
            const errorCode =
                "error" in res.data && typeof res.data.error === "string"
                    ? res.data.error
                    : "投稿に失敗しました。"
            return { ok: false, message: resolveEntryErrorMessage(errorCode) }
        }

        return { ok: true, skyshareUri: res.data.skyshare.uri }
    }

    const payload: CreateBskyRecordBody = {
        text,
        langs: [languageCode],
        selfLabels: selfLabel,
    }

    if (imageEntry) {
        payload.images = imageEntry.originalBlobs
        payload.imagesMeta = await resolveImageMetadata(imageEntry)
    } else if (ogpResult) {
        payload.ogMeta = ogpResult.meta
        payload.ogImage = ogpResult.imageBlob
    }

    const res = await createBskyRecord(payload)
    if (res.status !== 200) {
        const errorCode =
            "error" in res.data && typeof res.data.error === "string"
                ? res.data.error
                : "投稿に失敗しました。"
        return { ok: false, message: resolveEntryErrorMessage(errorCode) }
    }

    return { ok: true, skyshareUri: "" }
}

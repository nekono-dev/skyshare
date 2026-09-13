/**
 * ThreadComposer の投稿送信（OpenAPI契約への整形とAPI呼び出し）を担うモジュール。
 *
 * 責務と処理概要:
 * - `createEntry`（`POST /v2/entry`、旧`/v2/bsky/record`を統合した投稿作成エンドポイント）を、
 *   セグメント配列を`posts`配列にそのままマッピングして1回だけ呼び出す
 *   （`specs/threadpost/design.md §4.3`、原子的な複数投稿作成をそのまま利用する）。
 * - entry作成（`createEntry`/`visual`）はリクエスト全体でトップレベルに高々1組だけ持つ
 *   （`specs/entry/backend/design.md §3.1`）。画像投稿かつ`manualImageAttach`が無効な
 *   セグメント（＝entry作成候補）が複数ある場合、先頭（最小index）のセグメントのみを
 *   自動選択してそのsegmentの`thumbnailBlob`をトップレベル`visual`として送信する
 *   （`posts[i]`側にはentry関連のフィールドを一切送らない）。画像投稿segmentが2件以上
 *   ある場合に手動で選択させるUIは設けず、常に先頭を自動選択する
 *   （`specs/entry/frontend/requirements.md FR-1`）。
 * - entryの`source`（スレッド先頭を指すか、単発投稿なら自身を指すか）はサーバが常に
 *   自動解決するため、クライアントは解決方針を送信しない
 *   （`specs/entry/backend/design.md §7.1`）。
 * - バックエンドはfacetsの自動検出を行わない設計になったため、送信直前に
 *   `detectFacetsForSubmission`でfacetsを組み立てて併せて送信する。
 * - クロスポスト（X/タイッツー/Mastodon自動ポップアップ・WebShareAPI）は先頭（1件目）
 *   segmentのみを対象とするため（本モジュールの利用側で合意済みの方針）、戻り値は
 *   トップレベルskyshareEntryのuriのみを返す。
 */
import { createEntry } from "@/client/openapi/client"
import type { CreateEntryBody } from "@/client/openapi/model"
import { detectFacetsForSubmission } from "@/lib/atproto/richtext"
import { warmOgpCache } from "@/lib/entry/warmOgpCache"
import type { SegmentState } from "./segments"

export type SubmitThreadParams = {
    segments: SegmentState[]
    manualImageAttach: boolean
}

export type SubmitThreadResult =
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
 * Input:
 * - `blob`: 投稿対象の画像 Blob
 *
 * Output:
 * - `{ width, height }`
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
 * Input:
 * - `entry`: 投稿対象の画像エントリ
 *
 * Output:
 * - API に送信できる `imagesMeta`
 */
const resolveImageMetadata = async (
    entry: NonNullable<SegmentState["imageEntry"]>,
) => {
    const imageSizes = entry.meta ?? []
    const hasCompleteImageSizes =
        imageSizes.length === entry.originalBlobs.length &&
        imageSizes.every(value => hasValidImageSize(value))
    const alts = entry.originalBlobs.map(
        (_, index) => imageSizes[index]?.alt ?? "",
    )

    if (hasCompleteImageSizes) {
        return imageSizes.map((value, index) => ({
            width: value.width,
            height: value.height,
            alt: alts[index],
        }))
    }

    const sizes = await Promise.all(
        entry.originalBlobs.map((blob, index) => loadBlobImageSize(blob)),
    )
    return sizes.map((size, index) => ({ ...size, alt: alts[index] }))
}

/**
 * 1セグメント分の投稿内容を API 契約（`posts[i]`）の形へ整形する。
 * entry作成関連のフィールド（`createEntry`/`visual`）はここでは扱わない
 * （リクエスト全体でトップレベルに1組だけ持つため、`submitThread`側が組み立てる）。
 *
 * Input:
 * - `segment`: セグメントの入力内容
 *
 * Output:
 * - `posts[i]`として送信するプレーンオブジェクト
 */
const buildPostItem = async (segment: SegmentState) => {
    const { text, languageCode, selfLabel, postGate, imageEntry, ogpResult } =
        segment
    const facets = await detectFacetsForSubmission(text)

    const post: Record<string, unknown> = {
        text,
        facets,
        langs: [languageCode],
        selfLabels: selfLabel,
        gate: postGate,
    }

    if (imageEntry) {
        post.images = imageEntry.originalBlobs
        post.imagesMeta = await resolveImageMetadata(imageEntry)
    } else if (ogpResult) {
        post.ogMeta = { ...ogpResult.meta, url: ogpResult.sourceUrl }
        post.ogImage = ogpResult.imageBlob
    }

    return post
}

/**
 * ThreadComposer のセグメント配列を OpenAPI 契約に合わせて1回のリクエストで送信する。
 *
 * Input:
 * - `params`: セグメント配列一式
 *
 * Output:
 * - 成功時 `{ ok: true, skyshareUri }`（先頭segmentが画像投稿以外なら空文字）、
 *   失敗時 `{ ok: false, message }`
 */
export const submitThread = async (
    params: SubmitThreadParams,
): Promise<SubmitThreadResult> => {
    const { segments, manualImageAttach } = params

    // entry作成候補（画像投稿かつmanualImageAttachが無効）のうち、先頭のsegmentのみを
    // visual元として自動選択する（複数候補があっても、entryはリクエスト全体で最大1件）。
    const entryCandidateIndex = segments.findIndex(
        segment => !!segment.imageEntry && !manualImageAttach,
    )
    const wantsSkyshareEntry = entryCandidateIndex !== -1

    const posts = await Promise.all(segments.map(buildPostItem))

    const body = {
        posts,
        ...(wantsSkyshareEntry
            ? {
                  createEntry: true,
                  visual: segments[entryCandidateIndex].imageEntry!
                      .thumbnailBlob,
              }
            : {}),
    } as unknown as CreateEntryBody

    const res = await createEntry(body)
    if (res.status !== 200) {
        const errorCode =
            "error" in res.data && typeof res.data.error === "string"
                ? res.data.error
                : "投稿に失敗しました。"
        return { ok: false, message: resolveEntryErrorMessage(errorCode) }
    }

    const skyshareEntry = res.data.skyshareEntry
    if (wantsSkyshareEntry) {
        if (!skyshareEntry) {
            return {
                ok: false,
                message: resolveEntryErrorMessage(
                    "SKYSHARE_ENTRY_CREATE_FAILED",
                ),
            }
        }
        await warmOgpCache(skyshareEntry.uri)
    }

    return {
        ok: true,
        skyshareUri: skyshareEntry?.uri ?? "",
    }
}

import { v2BackendEndpoint } from "./endpoint"

// v2バックエンド POST /v2/entry の呼び出し。
// Blobアップロード・app.bsky.feed.postレコード作成・facet検出をv2側にまとめて委譲する。
// 認証は事前にcreateV2Sessionで発行されたCookie(atp_session, 同一オリジン)に依存する。
//
// 画像投稿時、v2は ogImage(OGP用サムネイル)を必須とする。呼び出し元(PostButton.tsx)が
// legacy backend の POST /ogp(複数画像レイアウト合成)で生成した画像をここに渡す。

export type createV2EntrySuccessResult = {
    bsky: { url: string }
    skyshare: { uri: string }
}
export type createV2EntryErrorResult = {
    error: string
    message: string
}
export type createV2EntryResult =
    createV2EntrySuccessResult | createV2EntryErrorResult

export const api = async ({
    text,
    langs,
    selfLabels,
    images,
    imagesMeta,
    ogImage,
}: {
    text?: string
    langs?: string[]
    selfLabels?: "sexual" | "nudity" | "porn" | "spoiler" | "!warn"
    images?: Blob[]
    imagesMeta?: Array<{ width: number; height: number }>
    ogImage?: Blob
}): Promise<createV2EntryResult> => {
    try {
        const formData = new FormData()
        if (typeof text === "string") {
            formData.set("text", text)
        }
        langs?.forEach(lang => formData.append("langs", lang))
        if (typeof selfLabels === "string") {
            formData.set("selfLabels", selfLabels)
        }
        images?.forEach((image, index) => {
            formData.append("images", image, `image${index}.jpg`)
        })
        if (typeof imagesMeta !== "undefined") {
            formData.set("imagesMeta", JSON.stringify(imagesMeta))
        }
        if (typeof ogImage !== "undefined") {
            formData.set("ogImage", ogImage, "ogImage.jpg")
        }

        const response = await fetch(`${v2BackendEndpoint}/v2/entry`, {
            method: "POST",
            credentials: "same-origin",
            body: formData,
        })
        const body = (await response.json().catch(() => undefined)) as
            createV2EntrySuccessResult | { error?: string } | undefined

        if (!response.ok || !body || !("bsky" in body)) {
            const message =
                body && "error" in body && typeof body.error === "string"
                    ? body.error
                    : `v2 entry request failed (status ${response.status})`
            return { error: "V2EntryError", message }
        }
        return body
    } catch (e: unknown) {
        return {
            error: "V2EntryError",
            message:
                e instanceof Error ? e.message : "Unexpected Unknown Error",
        }
    }
}

export default api

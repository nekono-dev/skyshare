import { v2BackendEndpoint } from "./endpoint"

// v2バックエンド POST /v2/entry の呼び出し。
// Blobアップロード・app.bsky.feed.postレコード作成・facet検出をv2側にまとめて委譲する。
// 認証は事前にcreateV2Sessionで発行されたCookie(atp_session, 同一オリジン)に依存する。
//
// v2側は`/v2/bsky/record`を統合しており、テキストのみの投稿・画像投稿のいずれも
// このエンドポイントの`posts[0][...]`フィールドとして送る（本ファイルは常に1件のみ送る）。
// 画像投稿でskyshare entryも作成したい場合は`ogImage`(OGP用サムネイル、legacy backendの
// POST /ogpで合成した画像)を渡し、`posts[0][createEntry]=true`を付与する。

export type createV2EntryPostResult = {
    url: string
    uri: string
    cid: string
    skyshareEntry?: { uri: string }
}
export type createV2EntrySuccessResult = {
    posts: createV2EntryPostResult[]
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
        // "posts[0][text]"はJSON文字列として送る(v2バックエンドの`PostItemFieldKinds.text`が
        // "json"種別のため。生の改行がブラウザ側で`\r\n`へ正規化されるのを避ける)。
        if (typeof text === "string") {
            formData.set("posts[0][text]", JSON.stringify(text))
        }
        langs?.forEach(lang => formData.append("posts[0][langs]", lang))
        if (typeof selfLabels === "string") {
            formData.set("posts[0][selfLabels]", selfLabels)
        }
        const hasImages = !!images && images.length > 0
        images?.forEach((image, index) => {
            formData.append("posts[0][images]", image, `image${index}.jpg`)
        })
        if (typeof imagesMeta !== "undefined") {
            formData.set("posts[0][imagesMeta]", JSON.stringify(imagesMeta))
        }
        if (typeof ogImage !== "undefined") {
            formData.set("posts[0][ogImage]", ogImage, "ogImage.jpg")
            if (hasImages) {
                formData.set("posts[0][createEntry]", "true")
            }
        }

        const response = await fetch(`${v2BackendEndpoint}/v2/entry/`, {
            method: "POST",
            credentials: "same-origin",
            body: formData,
        })
        const body = (await response.json().catch(() => undefined)) as
            createV2EntrySuccessResult | { error?: string } | undefined

        if (!response.ok || !body || !("posts" in body)) {
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

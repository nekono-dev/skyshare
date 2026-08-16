import { v2BackendEndpoint } from "./endpoint"

// v2バックエンド POST /v2/bsky/record の呼び出し。
// skyshare entryを一切伴わない、テキストのみのBluesky投稿を作成する。
// (画像投稿+skyshare entryの発行はcreateV2Entryが担う。POST /v2/entryは
// ogImageを常に必須とするため、テキストのみの投稿はこちらを使う必要がある)
// 認証は事前にcreateV2Sessionで発行されたCookie(atp_session, 同一オリジン)に依存する。

export type createV2BskyRecordSuccessResult = {
    url: string
    uri: string
    cid: string
}
export type createV2BskyRecordErrorResult = {
    error: string
    message: string
}
export type createV2BskyRecordResult =
    createV2BskyRecordSuccessResult | createV2BskyRecordErrorResult

export const api = async ({
    text,
    langs,
    selfLabels,
}: {
    text: string
    langs?: string[]
    selfLabels?: "sexual" | "nudity" | "porn" | "spoiler" | "!warn"
}): Promise<createV2BskyRecordResult> => {
    try {
        const formData = new FormData()
        formData.set("text", text)
        langs?.forEach(lang => formData.append("langs", lang))
        if (typeof selfLabels === "string") {
            formData.set("selfLabels", selfLabels)
        }

        const response = await fetch(`${v2BackendEndpoint}/v2/bsky/record`, {
            method: "POST",
            credentials: "same-origin",
            body: formData,
        })
        const body = (await response.json().catch(() => undefined)) as
            createV2BskyRecordSuccessResult | { error?: string } | undefined

        if (!response.ok || !body || !("uri" in body)) {
            const message =
                body && "error" in body && typeof body.error === "string"
                    ? body.error
                    : `v2 bsky record request failed (status ${response.status})`
            return { error: "V2BskyRecordError", message }
        }
        return body
    } catch (e: unknown) {
        return {
            error: "V2BskyRecordError",
            message:
                e instanceof Error ? e.message : "Unexpected Unknown Error",
        }
    }
}

export default api

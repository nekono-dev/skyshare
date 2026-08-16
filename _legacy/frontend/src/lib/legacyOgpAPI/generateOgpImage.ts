const endpoint_url = import.meta.env.PUBLIC_LEGACY_BACKEND_ENDPOINT as string

// legacy backend(Firebase Functions) POST /ogp の呼び出し。
// 複数画像(最大4枚)をレイアウト合成したOGP画像を生成してもらい、
// バイナリのままレスポンスとして受け取る。投稿・アップロード等の副作用はない。
// 悪用防止のため、呼び出し元は有効なBluesky accessJwtを渡す必要がある
// (backend側でcom.atproto.server.getSessionにより有効性を検証する)。

export type generateOgpImageSuccessResult = { blob: Blob }
export type generateOgpImageErrorResult = {
    error: string
    message: string
}
export type generateOgpImageResult =
    generateOgpImageSuccessResult | generateOgpImageErrorResult

export const api = async ({
    accessJwt,
    images,
}: {
    accessJwt: string
    images: File[]
}): Promise<generateOgpImageResult> => {
    try {
        const formData = new FormData()
        formData.set("accessJwt", accessJwt)
        images.forEach((image, index) => {
            formData.append("images", image, `image${index}.jpg`)
        })

        const response = await fetch(`${endpoint_url}/ogp`, {
            method: "POST",
            body: formData,
        })

        if (!response.ok) {
            const body = (await response.json().catch(() => undefined)) as
                { error?: string } | undefined
            const message =
                body && typeof body.error === "string"
                    ? body.error
                    : `generateOgpImage request failed (status ${response.status})`
            return { error: "GenerateOgpImageError", message }
        }
        return { blob: await response.blob() }
    } catch (e: unknown) {
        return {
            error: "GenerateOgpImageError",
            message:
                e instanceof Error ? e.message : "Unexpected Unknown Error",
        }
    }
}

export default api

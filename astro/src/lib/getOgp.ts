import { z } from "zod"

export const ZodOgpMetaData = z.object({
    title: z.string(),
    description: z.string(),
    image: z.string(),
})
export type ogpMetaData = z.infer<typeof ZodOgpMetaData>

const endpoint_url = import.meta.env.PUBLIC_BACKEND_ENDPOINT as string

export const getOgpMeta = async ({
    externalUrl,
    languageCode,
}: {
    externalUrl: string
    languageCode: string
}): Promise<ogpMetaData> => {
    const apiUrl = new URL(`${endpoint_url}/ogp/meta`)
    apiUrl.searchParams.append("url", encodeURIComponent(externalUrl))
    apiUrl.searchParams.append("lang", languageCode)
    return await fetch(apiUrl, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Accept-Language": languageCode,
            "Cache-Control": "no-cache",
        },
    }).then(async response => {
        const jsonResponse: unknown = await response.json()
        const responseParsedAsOgpMetaData = ZodOgpMetaData.parse(jsonResponse)
        return responseParsedAsOgpMetaData
    })
}
// Blob型はユニオン型として扱うことが難しいため、エラーハンドリングできない
export const getOgpBlob = async ({
    externalUrl,
    languageCode,
}: {
    externalUrl: string
    languageCode: string
}): Promise<Blob> => {
    const apiUrl = new URL(`${endpoint_url}/ogp/blob`)
    apiUrl.searchParams.append("url", encodeURIComponent(externalUrl))
    apiUrl.searchParams.append("lang", languageCode)
    return await fetch(apiUrl, {
        method: "GET",
        headers: {
            "Accept-Language": languageCode,
            "Cache-Control": "no-cache",
        },
    }).then(async response => {
        const result: Blob = await response.blob()
        const ContentType = response.headers.get("Content-Type")
        const MimeType =
            result.type !== ""
                ? result.type
                : ContentType !== null
                  ? ContentType
                  : "image/png"
        return new Blob([result], { type: MimeType })
    })
}

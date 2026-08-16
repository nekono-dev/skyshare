import { z } from "zod"

// legacy backend(v1.6/ogp/meta, v1.6/ogp/blob)の代わりに、v2([src/vars.ts]・
// [src/lib/fetcher.ts])と同じOGP抽出サービスを直接呼び出す。抽出先サービスの
// ホスト名はソースへ直書きせず、wrangler.jsonc(gitignore対象。テンプレートは
// wrangler.jsonc.template)経由の環境変数のみで解決する。
const extractorApi = import.meta.env.PUBLIC_OGP_EXTRACTOR_API as string

export const ZodOgpMetaData = z.object({
    title: z.string(),
    description: z.string(),
    image: z.string().optional().default(""),
})
export type ogpMetaData = z.infer<typeof ZodOgpMetaData>

export const getOgpMeta = async ({
    externalUrl,
}: {
    externalUrl: string
}): Promise<ogpMetaData> => {
    const query = new URLSearchParams({ url: externalUrl })
    return await fetch(`${extractorApi}/v1/extract?${query}`).then(
        async response => {
            const jsonResponse: unknown = await response.json()
            const responseParsedAsOgpMetaData =
                ZodOgpMetaData.parse(jsonResponse)
            return responseParsedAsOgpMetaData
        },
    )
}
// Blob型はユニオン型として扱うことが難しいため、エラーハンドリングできない
export const getOgpBlob = async ({
    externalUrl,
}: {
    externalUrl: string
}): Promise<Blob> => {
    // getOgpMetaが返すimage URLは抽出先サービス自身の画像プロキシであり、
    // CORS越しでも直接fetchできるため、追加のプロキシは不要
    // (v2の OgpFetchButton も同様に画像のみ直接取得している)。
    return await fetch(externalUrl).then(async response => {
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

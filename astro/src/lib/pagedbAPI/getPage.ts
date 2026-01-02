import { z } from "zod"
import etype from "./models/error"
const endpoint_url = import.meta.env.PUBLIC_BACKEND_ENDPOINT as string

export const ZodPageFetchOutput = z.object({
    ogp: z.string(),
    context: z.string().optional(),
    imgs: z.array(
        z.object({
            thumb: z.string(),
            alt: z.string(),
        }),
    ),
})
export type pageFetchOutput = z.infer<typeof ZodPageFetchOutput>

export const api = async ({
    pageId,
}: {
    pageId: string
}): Promise<pageFetchOutput | etype> => {
    const url = new URL(`${endpoint_url}/page/${pageId}`)
    return fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then(async response => {
            const responseParsed = ZodPageFetchOutput.safeParse(
                await response.json(),
            )

            if (!responseParsed.success) {
                const e: Error = new Error(
                    "Unexpected Response Type@getPages::api",
                )
                e.name = "Unexpected Response Type@getPages::api"
                throw e
            }

            const apiResult: pageFetchOutput = responseParsed.data
            return apiResult
        })
        .catch((e: Error) => {
            return {
                error: e.name,
                message: e.message,
            }
        })
}

export default api

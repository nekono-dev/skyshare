import { z } from "zod"
import etype from "./models/error"
const endpoint_url = import.meta.env.PUBLIC_BACKEND_ENDPOINT as string

export const ZodPageFetchOutput = z.object({
    ogp: z.string(),
    handle: z.string(),
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
            const result = ZodPageFetchOutput.safeParse(await response.json())
            if (!result.success) {
                const errorResult = z
                    .object({ error: z.string() })
                    .safeParse(await response.json())
                if (errorResult.success) {
                    return {
                        error: errorResult.data.error,
                        message: "Failed to fetch page data",
                    }
                }
                return {
                    error: "UnknownError",
                    message: "An unknown error occurred",
                }
            } else {
                return result.data
            }
        })
        .catch((e: Error) => {
            return {
                error: e.name,
                message: e.message,
            }
        })
}

export default api

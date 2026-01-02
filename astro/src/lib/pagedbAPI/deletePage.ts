import { z } from "zod"
import etype from "./models/error"

const endpoint_url = import.meta.env.PUBLIC_BACKEND_ENDPOINT as string

const ZodPageDeletionOutput = z.object({
    result: z.string(),
})
export type pageDeletionOutput = z.infer<typeof ZodPageDeletionOutput>

/**
 * pageDBからデータを削除
 *
 * @param {Object} props
 * @param {string} props.id handle @ rkeyで形成されるpageid
 * @param {string} props.dud did
 * @param {string} props.accessJwt アクセストークン
 */
export const api = async ({
    pageId,
    did,
    accessJwt,
}: {
    pageId: string
    did: string
    accessJwt: string
}): Promise<pageDeletionOutput | etype> => {
    return fetch(endpoint_url + "/page", {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            pageId: pageId,
            did: did,
            accessJwt: accessJwt,
        }),
    })
        .then(async response => {
            const responseParsed = ZodPageDeletionOutput.safeParse(
                await response.json(),
            )

            if (!responseParsed.success) {
                const e: Error = new Error(
                    "Unexpected Response Type@deletePage::api",
                )
                e.name = "Unexpected Response Type@deletePage::api"
                throw e
            }
            const apiResult: pageDeletionOutput = responseParsed.data
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

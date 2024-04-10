import { z } from "zod"
import etype from "./models/error.json"

const endpoint_url = import.meta.env.PUBLIC_DELETEPAGE_ENDPOINT as string

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
    id,
    did,
    accessJwt,
}: {
    id: string
    did: string
    accessJwt: string
}): Promise<pageDeletionOutput | typeof etype> => {
    return fetch(endpoint_url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id: id,
            did: did,
            accessJwt: accessJwt,
        }),
    })
        .then(response => {
            const responseParsed = ZodPageDeletionOutput.safeParse(
                response.json(),
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

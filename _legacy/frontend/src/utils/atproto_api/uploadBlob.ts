import getEndpoint, { com_atproto } from "./base"
const apiName = com_atproto.repo.uploadBlob
const endpoint = getEndpoint(apiName)

export type uploadBlobSuccessResult = {
    blob: {
        $type: "blob"
        ref: {
            $link: string
        }
        mimeType: string
        size: number
    }
}

export type uploadBlobErrorResult = {
    error: string
    message: string
}

export type uploadBlobResult = uploadBlobSuccessResult | uploadBlobErrorResult

export const api = async ({
    accessJwt,
    mimeType,
    blob,
}: {
    accessJwt: string
    mimeType: string
    blob: Uint8Array
}): Promise<uploadBlobResult> =>
    fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": mimeType,
            Authorization: `Bearer ${accessJwt}`,
        },
        body: blob,
    })
        .then(async response => {
            if (!response?.ok) {
                const res = (await response.json()) as uploadBlobErrorResult

                const e: Error = new Error(res.message)
                e.name = apiName
                throw e
            }
            return (await response.json()) as uploadBlobSuccessResult
        })
        .catch((e: Error) => {
            return {
                error: e.name,
                message: e.message,
            }
        })

export default api

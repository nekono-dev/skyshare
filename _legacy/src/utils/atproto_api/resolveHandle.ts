import getEndpoint, { com_atproto } from "./base"
import etype from "./models/error.json"
const apiName = com_atproto.identity.resolveHandle
const endpoint = getEndpoint(apiName)

export type resolveHandleResult = {
    did: string
}

export const api = async ({
    handle,
}: {
    handle: string
}): Promise<resolveHandleResult> => {
    const url = new URL(endpoint)
    url.searchParams.set("handle", handle)
    return fetch(url.toString(), {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    }).then<resolveHandleResult>(async response => {
        if (!response?.ok) {
            const res: typeof etype = (await response.json()) as typeof etype
            const e: Error = new Error(res.message)
            e.name = apiName
            throw e
        }
        return (await response.json()) as resolveHandleResult
    })
}

export default api

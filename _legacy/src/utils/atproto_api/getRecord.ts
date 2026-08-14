import getEndpoint, { com_atproto, app_bsky } from "./base"
import mtype from "./models/getRecord.json"
import etype from "./models/error.json"
const apiName = com_atproto.repo.getRecord
const endpoint = getEndpoint(apiName)

export const api = async ({
    rkey,
    did,
}: {
    rkey: string
    did: string
}): Promise<typeof mtype | typeof etype> => {
    const url = new URL(endpoint)
    url.searchParams.set("repo", did)
    url.searchParams.set("rkey", rkey)
    url.searchParams.set("collection", app_bsky.feed.post)
    return fetch(url.toString(), {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then(async response => {
            if (!response?.ok) {
                const res: typeof etype =
                    (await response.json()) as typeof etype
                const e: Error = new Error(res.message)
                e.name = apiName
                throw e
            }
            return (await response.json()) as typeof mtype
        })
        .catch((e: Error) => {
            return {
                error: e.name,
                message: e.message,
            }
        })
}

export default api

import getEndpoint, { app_bsky } from "./base"
import mtype from "./models/getProfile.json"
import etype from "./models/error.json"
const apiName = app_bsky.actor.getProfile
const endpoint = getEndpoint(apiName)

export const api = async ({
    handle,
    accessJwt,
}: {
    handle: string
    accessJwt: string
}): Promise<typeof mtype | typeof etype> => {
    const url = new URL(endpoint)
    url.searchParams.set("actor", handle)
    return fetch(url.toString(), {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessJwt}`,
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

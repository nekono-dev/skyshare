import getEndpoint, { com_atproto } from "./base"
import mtype from "./models/getSession.json"
import etype from "./models/error.json"
const apiName = com_atproto.server.getSession
const endpoint = getEndpoint(apiName)

export const api = async ({
    accessJwt,
}: {
    accessJwt: string
}): Promise<typeof mtype | typeof etype> =>
    fetch(endpoint, {
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

export default api

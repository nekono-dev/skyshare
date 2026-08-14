import getEndpoint, { com_atproto } from "./base"
import mtype from "./models/createSession.json"
import etype from "./models/error.json"
const apiName = com_atproto.server.createSession
const endpoint = getEndpoint(apiName)

export const api = async ({
    identifier,
    password,
}: {
    identifier: string
    password: string
}): Promise<typeof mtype | typeof etype> =>
    fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            identifier: identifier,
            password: password,
        }),
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

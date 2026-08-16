import getProfile from "@/utils/atproto_api/getProfile"
import type model_getProfile from "@/utils/atproto_api/models/getProfile.json"
import { Dispatch, SetStateAction } from "react"
import etype from "@/utils/atproto_api/models/error.json"

export const loadProfile = async ({
    session,
    setProfile,
}: {
    session: {
        accessJwt: string
        handle: string
    }
    setProfile: Dispatch<SetStateAction<typeof model_getProfile | null>>
}): Promise<void | typeof etype> => {
    try {
        setProfile(null)
        if (session.accessJwt === "" || session.handle === null) {
            return
        }
        const res = await getProfile({
            accessJwt: session.accessJwt,
            handle: session.handle,
        })
        if (!("error" in res)) {
            setProfile(res)
        }
    } catch (e: unknown) {
        if (e instanceof Error) {
            return {
                error: e.name,
                message: e.message,
            }
        }
    }
}
export default loadProfile

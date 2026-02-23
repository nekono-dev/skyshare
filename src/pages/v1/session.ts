import type { APIRoute } from "astro"
import { AtpBaseClient } from "@/client/atproto"

import { makeSessionSetCookie } from "@/lib/cookies.js"
import * as PostSchema from "@/client/openapi/schemas/v1/session/post"

import { errorResponseFromStatus } from "@/lib/api.js"
import { XRPCError } from "@atproto/xrpc"

export const POST: APIRoute = async ({ request }: { request: Request }) => {
    try {
        const body = PostSchema.RequestBodySchema.safeParse(
            await request.json(),
        )
        if (!body.success) {
            console.warn("login.ts: " + JSON.stringify(body.error))
            return errorResponseFromStatus(400)
        }

        const identifier = body.data.identifier
        const password = body.data.password
        const service = body.data.service || "https://bsky.social"

        const agent = new AtpBaseClient(service)
        const data = await agent.com.atproto.server
            .createSession({
                identifier,
                password,
            })
            .then(res => res.data)

        const session = {
            accessJwt: data.accessJwt,
            refreshJwt: data.refreshJwt,
            handle: data.handle,
            did: data.did,
            active: data.active ?? true,
            status: data.status,
        }
        // Store both session and service so server-side APIs can resume correctly
        const cookiePayload = { session, service }
        const cookie = makeSessionSetCookie(cookiePayload)
        const responeseHeader: PostSchema.ResponseHeaders200Type = {
            "set-cookie": cookie,
        }
        return new Response(undefined, {
            status: 200,
            headers: responeseHeader,
        })
    } catch (err: unknown) {
        console.error("login.ts: ", err)
        if (err instanceof XRPCError) {
            switch (err.error) {
                case "AuthenticationRequired":
                    console.warn("login.ts: AuthenticationRequired")
                    return errorResponseFromStatus(401)
                case "RateLimitExceeded":
                    console.warn("login.ts: RateLimitExceeded")
                    return errorResponseFromStatus(429)
            }
        }
        return errorResponseFromStatus(500)
    }
}

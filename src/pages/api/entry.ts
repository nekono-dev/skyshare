import type { APIRoute } from "astro"

import { ComAtprotoServerRefreshSession, AtpBaseClient } from "@/client/atproto"

import { validateRecord as validateAppBskyFeedPost } from "@/client/atproto/types/app/bsky/feed/post.js"
import { parseSessionFromRequest } from "@/lib/cookies.js"
import { convertHeaderToObj, errorResponseFromStatus } from "@/lib/api.js"

import * as PostSchema from "@/client/openapi/schemas/api/entry/post"

export const POST: APIRoute = async ({ request }: { request: Request }) => {
    try {
        const head = PostSchema.RequestHeaderSchema.safeParse(
            convertHeaderToObj(request.headers),
        )
        const body = PostSchema.RequestBodySchema.safeParse(
            await request.json(),
        )
        if (!body.success || !head.success) {
            console.warn(
                "login.ts: " + JSON.stringify(body.error || head.error),
            )
            return errorResponseFromStatus(400)
        }
        const text = body.data.text

        if (!text) {
            return errorResponseFromStatus(400)
        }

        let session: ComAtprotoServerRefreshSession.OutputSchema
        let service: string
        ;({ session, service } = parseSessionFromRequest(request))

        // session = await refreshSession(service, undefined, session.refreshJwt)
        const agent = new AtpBaseClient(service)
        session = await agent.com.atproto.server
            .refreshSession(undefined, {
                headers: {
                    authorization: `Bearer ${session.refreshJwt}`,
                },
            })
            .then(res => res.data)
        session = {
            accessJwt: session.accessJwt,
            refreshJwt: session.refreshJwt,
            handle: session.handle,
            did: session.did,
            active: session.active ?? true,
            status: session.status,
        }

        // app.bsky.feed.postコレクションに最低限のレコードをPUTするサンプル
        const record = {
            $type: "app.bsky.feed.post",
            text: text || "sample post",
            createdAt: new Date().toISOString(),
        }

        const validation = validateAppBskyFeedPost(record)
        if (!validation?.success) {
            console.error(validation)
            return errorResponseFromStatus(400)
        }
        const response = await agent.app.bsky.feed.post.create(
            {
                repo: session.did,
            },
            validation.value,
            {
                authorization: `Bearer ${session.accessJwt}`,
            },
        )
        return new Response(
            JSON.stringify({ uri: response.uri, cid: response.cid }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            },
        )

        // const repo = session.did

        // // Build blob ref for manifest visual. Require it because the lexicon demands it.
        // let visual: any = undefined
        // if (manifestIn?.visual) {
        //     visual = manifestIn.visual
        // } else if (visualCid) {
        //     visual = { cid: visualCid }
        // }

        // if (!visual) {
        //     return new Response(
        //         JSON.stringify({
        //             error: "manifest.visual (blob ref) required by dev.nekono.skyshare",
        //         }),
        //         {
        //             status: 400,
        //             headers: { "Content-Type": "application/json" },
        //         },
        //     )
        // }

        // const record = {
        //     $type: "def.skyshare.entry",
        //     source: {
        //         $type: "app.bsky.feed.post",
        //         text: text || title || "",
        //         createdAt: new Date().toISOString(),
        //     },
        //     manifest: {
        //         $type: "def.skyshare.manifest",
        //         visual,
        //         heading: title || undefined,
        //         caption: text || undefined,
        //     },
        //     createdAt: new Date().toISOString(),
        // }

        // // Validate against generated lexicon types
        // const validation = Api.DefSkyshareEntry.validateRecord(record as any)
        // if (!validation?.success) {
        //     return new Response(
        //         JSON.stringify({
        //             error: "record validation failed",
        //             detail: validation,
        //         }),
        //         {
        //             status: 400,
        //             headers: { "Content-Type": "application/json" },
        //         },
        //     )
        // }

        // const res = await agent.com.atproto.repo.createRecord({
        //     repo,
        //     collection: "def.skyshare.entry",
        //     record,
        // })
    } catch (err: any) {
        console.error("create entry error", err)
        return new Response(
            JSON.stringify({ error: (err && err.message) || String(err) }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            },
        )
    }
}

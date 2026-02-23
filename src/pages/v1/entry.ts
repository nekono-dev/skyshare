import type { APIRoute } from "astro"

import { ComAtprotoServerRefreshSession, AtpBaseClient } from "@/client/atproto"
import { RichText, AtpAgent } from "@atproto/api"
import { validateRecord as validateAppBskyFeedPost } from "@/client/atproto/types/app/bsky/feed/post.js"
import { parseSessionFromRequest } from "@/lib/cookies.js"
import { convertHeaderToObj, errorResponseFromStatus } from "@/lib/api.js"

import * as PostSchema from "@/client/openapi/schemas/v1/entry/post"
import getFormDataFile from "@/lib/formdata.js"
import { extractLinkUrisFromFacets } from "@/lib/richtext"
import { extractUrl } from "@/client/openapi/client"

export const POST: APIRoute = async ({ request }: { request: Request }) => {
    try {
        const rawHead = PostSchema.RequestHeaderSchema.safeParse(
            convertHeaderToObj(request.headers),
        )
        if (!rawHead.success) {
            console.warn(
                "createEntry: invalid headers: " +
                    JSON.stringify(rawHead.error),
            )
            return errorResponseFromStatus(400)
        }

        let session: ComAtprotoServerRefreshSession.OutputSchema
        let service: string
        ;({ session, service } = parseSessionFromRequest(request))
        if (!session || !service) {
            return errorResponseFromStatus(401)
        }
        const agent = new AtpAgent({ service })
        await agent.resumeSession({
            refreshJwt: session.refreshJwt,
            accessJwt: session.accessJwt,
            handle: session.handle,
            did: session.did,
            active: true,
        })
        // session = await agent.com.atproto.server
        //     .refreshSession(undefined, {
        //         headers: {
        //             authorization: `Bearer ${session.refreshJwt}`,
        //         },
        //     })
        //     .then(res => res.data)

        const contentType = request.headers.get("content-type") || ""
        let rawBody: any = {}

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData()

            const textVal = formData.get("text")
            rawBody.text = textVal !== null ? String(textVal) : undefined

            const langs = formData.getAll("langs")
            if (langs && langs.length > 0) {
                rawBody.langs = langs.map((v: any) => String(v))
            }

            const image = await getFormDataFile(formData, "image")
            if (image) {
                const uploadRes = await agent.com.atproto.repo.uploadBlob(
                    image.buffer,
                    {
                        encoding: image.mime,
                        headers: {
                            authorization: `Bearer ${session.accessJwt}`,
                        },
                    },
                )
                rawBody.image = uploadRes.data
            }
        } else {
            return errorResponseFromStatus(400)
        }

        const body = PostSchema.RequestBodySchema.safeParse(rawBody)
        if (!body.success) {
            console.error(
                "createEntry: invalid request body: " + JSON.stringify(body),
            )
            return errorResponseFromStatus(400)
        }
        const rt = new RichText({ text: body.data.text })
        await rt.detectFacets(agent)

        const response = await agent.post({
            $type: "app.bsky.feed.post",
            text: rt.text,
            facets: rt.facets,
            langs: body.data.langs,
            // embed: body.data.image
            //     ? {
            //           $type: "app.bsky.embed.images",
            //           images: [
            //               {
            //                   image: body.data.image,
            //                   alt: "Uploaded image",
            //               },
            //           ],
            //       }
            //     : undefined,
        })
        // // app.bsky.feed.postコレクションに最低限のレコードをPUTするサンプル
        // const record = {
        //     $type: "app.bsky.feed.post",
        //     text: body.data.text || "sample post",
        //     createdAt: new Date().toISOString(),
        //     langs: body.data.langs,
        //     embed: body.data.image
        //         ? {
        //               $type: "app.bsky.embed.images",
        //               images: [
        //                   {
        //                       image: body.data.image,
        //                       alt: "Uploaded image",
        //                   },
        //               ],
        //           }
        //         : undefined,
        // }

        // const validation = validateAppBskyFeedPost(record)
        // if (!validation?.success) {
        //     console.error(validation)
        //     return errorResponseFromStatus(400)
        // }
        // const response = await agent.app.bsky.feed.post.create(
        //     {
        //         repo: session.did,
        //     },
        //     validation.value,
        //     {
        //         authorization: `Bearer ${session.accessJwt}`,
        //     },
        // )
        const rkey = response.uri.split("/").slice(-1)[0]
        const appViewUrl =
            service === "https://bsky.social" ? "https://bsky.app" : service

        const bskyUrl = `${appViewUrl}/profile/${session.handle}/post/${rkey}`

        return new Response(
            JSON.stringify({
                bsky: { url: bskyUrl },
                skyshare: { uri: "" },
            }),
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

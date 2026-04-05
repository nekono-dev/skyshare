import type { APIRoute } from "astro"

import { DevNekonoSkyshareEntry } from "@/client/atproto"
import {
    RichText,
    AtpAgent,
    ComAtprotoServerRefreshSession,
} from "@atproto/api"
import { parseSessionFromRequest } from "@/lib/cookies.js"
import { convertHeaderToObj, errorResponseFromStatus } from "@/lib/api.js"
import { extractLinkUrisFromFacets } from "@/lib/richtext"

import * as PostSchema from "@/client/openapi/schemas/v1/entry/post"
import { bskyPostUrlgen, skyshareEntryUrlgen } from "@/lib/url"
import { parseAtUri } from "@/lib/url"

type ImageMeta = {
    width: number
    height: number
}

const parseImageMeta = (value: string | null): ImageMeta[] | null => {
    if (!value) {
        return []
    }

    try {
        const parsed = JSON.parse(value)
        if (!Array.isArray(parsed)) {
            return null
        }

        const imageMeta = parsed.map(item => {
            const width = Number(item?.width)
            const height = Number(item?.height)
            if (
                !Number.isFinite(width) ||
                !Number.isInteger(width) ||
                width <= 0 ||
                !Number.isFinite(height) ||
                !Number.isInteger(height) ||
                height <= 0
            ) {
                throw new Error("invalid image meta")
            }

            return { width, height }
        })

        return imageMeta
    } catch {
        return null
    }
}

// const errorResponse = (status: number, error: string): Response =>
//     new Response(JSON.stringify({ error }), {
//         status,
//         headers: { "Content-Type": "application/json" },
//     })

const uploadBlob = async (agent: AtpAgent, blob: Blob) => {
    const mime = blob.type || "application/octet-stream"
    const buffer = new Uint8Array(await blob.arrayBuffer())
    const uploadRes = await agent.uploadBlob(buffer, {
        encoding: mime,
    })
    return uploadRes.data.blob
}

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

        const contentType = request.headers.get("content-type") || ""
        let rawBody: any = {}
        let imageMeta: ImageMeta[] = []
        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData()

            const textVal = formData.get("text")
            rawBody.text = textVal !== null ? String(textVal) : undefined

            const langs = formData.getAll("langs")
            if (langs && langs.length > 0) {
                rawBody.langs = langs.map((v: any) => String(v))
            }

            const ogMetaRaw = formData.get("ogMeta")
            if (ogMetaRaw) {
                try {
                    rawBody.ogMeta = JSON.parse(String(ogMetaRaw))
                } catch {
                    console.warn("createEntry: ogMeta is not valid JSON")
                    return errorResponseFromStatus(400)
                }
            }

            const imagesRaw = formData.getAll("images")
            const imageFiles = imagesRaw.filter(
                v => typeof (v as any)?.arrayBuffer === "function",
            ) as Blob[]
            if (imageFiles.length > 0) {
                rawBody.images = imageFiles
            }

            const imagesMetaRaw = formData.get("imagesMeta")
            if (imagesMetaRaw !== null) {
                rawBody.imagesMeta = String(imagesMetaRaw)
                const parsedMeta = parseImageMeta(String(imagesMetaRaw))
                if (parsedMeta === null) {
                    console.warn("createEntry: imagesMeta is not valid JSON")
                    return errorResponseFromStatus(400)
                }
                imageMeta = parsedMeta
            }

            const ogImage = formData.get("ogImage")
            if (
                ogImage &&
                typeof (ogImage as any)?.arrayBuffer === "function"
            ) {
                rawBody.ogImage = ogImage as Blob
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

        const hasImages = (body.data.images?.length ?? 0) > 0
        const hasOgpMeta = Boolean(body.data.ogMeta)
        const hasOgpImage = Boolean(body.data.ogImage)

        if (hasImages && hasOgpMeta) {
            console.error(
                "createEntry: request has both images and ogMeta, which is not allowed",
            )
            return errorResponseFromStatus(400)
        }

        if (!hasImages && imageMeta.length > 0) {
            console.error("createEntry: imagesMeta provided without images")
            return errorResponseFromStatus(400)
        }

        if (hasImages && !hasOgpImage) {
            console.error("createEntry: image post requires ogImage")
            return errorResponseFromStatus(400)
        }

        if (hasOgpMeta && !hasOgpImage) {
            console.error("createEntry: ogp post requires ogImage")
            return errorResponseFromStatus(400)
        }

        if (!hasImages && hasOgpImage && !hasOgpMeta) {
            console.error("createEntry: ogp post requires ogMeta")
            return errorResponseFromStatus(400)
        }

        const widths = imageMeta.map(v => v.width)
        const heights = imageMeta.map(v => v.height)
        if (
            hasImages &&
            body.data.images &&
            (widths.length !== body.data.images.length ||
                heights.length !== body.data.images.length)
        ) {
            console.warn("createEntry: image size metadata count mismatch", {
                images: body.data.images.length,
                widths: widths.length,
                heights: heights.length,
            })
            return errorResponseFromStatus(400)
        }

        const uploadedImages =
            hasImages && body.data.images
                ? await Promise.all(
                      body.data.images.map(async image => {
                          return uploadBlob(agent, image)
                      }),
                  )
                : []

        const rt = new RichText({ text: body.data.text })
        await rt.detectFacets(agent)

        let embed: any = undefined
        if (uploadedImages.length > 0) {
            embed = {
                $type: "app.bsky.embed.images" as const,
                images: uploadedImages.map((blob, idx) => ({
                    image: blob,
                    alt: "",
                    aspectRatio:
                        widths[idx] && heights[idx]
                            ? {
                                  width: widths[idx],
                                  height: heights[idx],
                              }
                            : undefined,
                })),
            }
        } else if (hasOgpMeta && body.data.ogMeta) {
            const linkUris = extractLinkUrisFromFacets(rt.facets)
            const externalUri = linkUris[0]
            if (!externalUri) {
                console.error(
                    "createEntry: ogp post requires a link in the text",
                )
                return errorResponseFromStatus(400)
            }

            let thumb: any = undefined
            if (body.data.ogImage) {
                try {
                    thumb = await uploadBlob(agent, body.data.ogImage)
                } catch (err) {
                    console.error("createEntry: failed to upload og image", err)
                    return errorResponseFromStatus(500)
                }
            }

            embed = {
                $type: "app.bsky.embed.external" as const,
                external: {
                    uri: externalUri,
                    title: body.data.ogMeta.title,
                    description: body.data.ogMeta.description,
                    thumb,
                },
            }
        }

        let response: { uri: string; cid: string }
        try {
            response = await agent.post({
                $type: "app.bsky.feed.post",
                text: rt.text,
                facets: rt.facets,
                langs: body.data.langs,
                embed,
            })
        } catch (err) {
            console.error("createEntry: app.bsky.feed.post failed", err)
            return errorResponseFromStatus(500)
        }

        const rkey = response.uri.split("/").slice(-1)[0]
        const bskyUrl = bskyPostUrlgen(session.handle, rkey)

        const userName = await agent
            .getProfile({ actor: session.did })
            .then(res => res.data.displayName || session.handle)
        let skyshareUri = ""
        if (hasImages && body.data.ogImage) {
            try {
                const visual = await uploadBlob(agent, body.data.ogImage)
                const createdAt = new Date().toISOString()
                const headingText = body.data.text.trim()
                const record = {
                    $type: "dev.nekono.skyshare.entry",
                    source: {
                        uri: response.uri,
                        cid: response.cid,
                    },
                    manifest: {
                        $type: "dev.nekono.skyshare.defs#manifest",
                        visual,
                        heading: `${userName} 's Post`,
                        caption:
                            headingText.length > 0 ? headingText : undefined,
                    },
                    createdAt,
                }

                const validation = DevNekonoSkyshareEntry.validateRecord(record)
                if (!validation?.success) {
                    console.error(
                        "createEntry: dev.nekono.skyshare.entry validation failed",
                        validation,
                    )
                    return errorResponseFromStatus(500)
                }

                const createRecordRes =
                    await agent.com.atproto.repo.createRecord({
                        repo: session.did,
                        collection: "dev.nekono.skyshare.entry",
                        record: validation.value,
                    })
                const parsedSkyshareUri = parseAtUri(createRecordRes.data.uri)
                if (parsedSkyshareUri) {
                    skyshareUri = skyshareEntryUrlgen(
                        parsedSkyshareUri.repo,
                        parsedSkyshareUri.rkey,
                    )
                }
            } catch (err) {
                console.error(
                    "createEntry: dev.nekono.skyshare.entry create failed",
                    err,
                )
                return errorResponseFromStatus(500)
            }
        }

        return new Response(
            JSON.stringify({
                bsky: { url: bskyUrl },
                skyshare: { uri: skyshareUri },
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            },
        )
    } catch (err: any) {
        console.error("createEntry: create entry error", err)
        return errorResponseFromStatus(500)
    }
}

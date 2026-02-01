// import { DevNekonoSkyshareEntry, AppBskyFeedPost } from "../client/atproto"
// import type {
//     InputSchema as ComAtprotoRepoCreateRecordInputSchema,
//     OutputSchema as ComAtprotoRepoCreateRecordOutputSchema,
// } from "../client/atproto/types/com/atproto/repo/createRecord"
// import type {
//     InputSchema as ComAtprotoServerCreateSessionInputSchema,
//     OutputSchema as ComAtprotoServerCreateSessionOutputSchema,
// } from "../client/atproto/types/com/atproto/server/createSession"
// import type {
//     InputSchema as ComAtprotoServerRefreshSessionInputSchema,
//     OutputSchema as ComAtprotoServerRefreshSessionOutputShema,
// } from "../client/atproto/types/com/atproto/server/refreshSession"

// import {
//     AppBskyFeedPostMainSchema,
//     type AppBskyFeedPostMain,
// } from "../client/atproto/app/bsky/feed/post"
// import {
//     createRecord,
//     ComAtprotoRepoCreateRecordMainInputSchema,
// } from "../client/atproto/com/atproto/repo/createRecord"

// export const createSession = async (
//     service: string,
//     body: ComAtprotoServerCreateSessionInputSchema,
// ) =>
//     xrpcCall<
//         ComAtprotoServerCreateSessionInputSchema,
//         ComAtprotoServerCreateSessionOutputSchema
//     >("com.atproto.server.createSession", {
//         body,
//         service,
//         method: "POST",
//     })
// export const refreshSession = async (service: string, refreshJwt: string) =>
//     xrpcCall<
//         ComAtprotoServerRefreshSessionInputSchema,
//         ComAtprotoServerRefreshSessionOutputShema
//     >("com.atproto.repo.refreshSession", {
//         headers: {
//             authorization: `Bearer ${refreshJwt}`,
//         },
//         service,
//         method: "POST",
//     })

// export const createRecordBsky = async (
//     service: string,
//     did: string,
//     accessJwt: string,
//     record: AppBskyFeedPostMain,
// ) => {
//     const recordValidated = AppBskyFeedPostMainSchema.parse(record)
//     const validated = ComAtprotoRepoCreateRecordMainInputSchema.parse({
//         repo: did,
//         collection: "app.bsky.feed.post",
//         record: recordValidated,
//     })
//     console.log("Creating record in bsky.feed.post:", validated)
//     return await createRecord(
//         service,
//         {
//             repo: did,
//             collection: "app.bsky.feed.post",
//             record: validated.record,
//         },
//         accessJwt,
//     )
// }

// export const createRecordSkyshare = async (
//     service: string,
//     accessJwt: string,
//     record: any,
// ) => {
//     const validation = DevNekonoSkyshareEntry.validateRecord(record)
//     if (!validation?.success) {
//         throw validation.error
//     }
//     // return await createRecord(accessJwt, service, validation.value)
// }

// export const createRecord = async (
//     service: string,
//     accessJwt: string,
//     body: RemoveIndexSignature<ComAtprotoRepoCreateRecordInputSchema>,
// ) =>
//     xrpcCall<
//         ComAtprotoRepoCreateRecordInputSchema,
//         ComAtprotoRepoCreateRecordOutputSchema
//     >("com.atproto.repo.createRecord", {
//         headers: {
//             authorization: `Bearer ${accessJwt}`,
//         },
//         service,
//         body,
//         method: "POST",
//     })

// export type XrpcOpts = {
//     service: string
//     headers?: HeadersInit
// }
// export async function xrpcCall<I, O>(
//     nsid: string,
//     opts: XrpcOpts & {
//         body?: I
//         params?: Record<string, string>
//         method: "GET" | "POST"
//     },
// ): Promise<O> {
//     const url = new URL(`/xrpc/${nsid}`, opts.service)

//     if (opts.params) {
//         for (const [k, v] of Object.entries(opts.params)) {
//             url.searchParams.set(k, v)
//         }
//     }

//     const res = await fetch(url.toString(), {
//         method: opts.method,
//         headers: {
//             "content-type": "application/json",
//             ...opts.headers,
//         },
//         body: opts.body ? JSON.stringify(opts.body) : undefined,
//     })

//     if (!res.ok) {
//         throw new Error(`XRPC error ${res.status}`)
//     }

//     return res.json() as Promise<O>
// }

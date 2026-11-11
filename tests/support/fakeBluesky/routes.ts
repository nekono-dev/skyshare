/**
 * Defines fake Bluesky responses shared by E2E and route tests.
 * Authorization state and written records live in the request store.
 */
import type { FakeBlueskyFixtures } from "./types"

export type FakeReply = {
    readonly status: number
    readonly body?: unknown
    readonly headers?: Record<string, string>
}

/** A written record keyed by AT URI; getRecord and getPosts read these values. */
export type FakeRecord = { readonly cid: string; readonly value: unknown }

/**
 * Holds pending authorization requests and written records.
 * `par` maps request URIs to PAR requests; `records` stores values written by applyWrites and putRecord.
 */
export type FakeStore = {
    readonly par: Map<string, Record<string, string>>
    readonly records: Map<string, FakeRecord>
}
export const createFakeStore = (): FakeStore => ({
    par: new Map(),
    records: new Map(),
})

export type FakeRequest = {
    readonly method: string
    readonly url: URL
    readonly fixtures: FakeBlueskyFixtures
    readonly body: string
    readonly store: FakeStore
}

/** Route definitions include only endpoints used by the E2E flows. */
type Route = {
    readonly method: string
    readonly match: (url: URL) => boolean
    readonly handle: (req: FakeRequest) => FakeReply
}

/** Syntactically valid fixed CID; no image payload is stored. */
// A syntactically valid TID used as the commit revision.
const FAKE_REV = "3jzfcijpj2z2a"
const FAKE_CID = "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku"

const json = (status: number, body: unknown): FakeReply => ({
    status,
    body,
    headers: { "content-type": "application/json" },
})
const pathIs = (path: string) => (url: URL) => url.pathname === path
const formOf = (body: string): URLSearchParams => new URLSearchParams(body)
const newRequestUri = () =>
    `urn:ietf:params:oauth:request_uri:${crypto.randomUUID()}`

const ROUTES: readonly Route[] = [
    {
        method: "GET",
        match: pathIs("/.well-known/oauth-authorization-server"),
        handle: ({ url }) =>
            json(200, {
                issuer: url.origin,
                authorization_endpoint: `${url.origin}/oauth/authorize`,
                token_endpoint: `${url.origin}/oauth/token`,
                pushed_authorization_request_endpoint: `${url.origin}/oauth/par`,
                dpop_signing_alg_values_supported: ["ES256"],
                token_endpoint_auth_methods_supported: [
                    "private_key_jwt",
                    "none",
                ],
            }),
    },
    {
        method: "GET",
        match: pathIs("/.well-known/oauth-protected-resource"),
        handle: ({ url }) =>
            json(200, {
                resource: url.origin,
                authorization_servers: [url.origin],
            }),
    },
    {
        // Accept the authorization request up front; authorize resolves it by request_uri.
        method: "POST",
        match: pathIs("/oauth/par"),
        handle: ({ body, store }) => {
            const requestUri = newRequestUri()
            store.par.set(requestUri, Object.fromEntries(formOf(body)))
            return json(201, { request_uri: requestUri, expires_in: 300 })
        },
    },
    {
        // Skip user consent and return an authorization code to the requested redirect URI.
        method: "GET",
        match: pathIs("/oauth/authorize"),
        handle: ({ url, store }) => {
            const pending = store.par.get(
                url.searchParams.get("request_uri") ?? "",
            )
            if (!pending?.redirect_uri)
                return json(400, { error: "invalid_request" })
            const back = new URL(pending.redirect_uri)
            back.searchParams.set("code", "code-fixture")
            back.searchParams.set("state", pending.state ?? "")
            back.searchParams.set("iss", url.origin)
            return { status: 302, headers: { location: back.toString() } }
        },
    },
    {
        method: "POST",
        match: pathIs("/oauth/token"),
        handle: ({ fixtures }) =>
            json(200, {
                token_type: "DPoP",
                access_token: "access-fixture",
                refresh_token: "refresh-fixture",
                sub: fixtures.did,
                expires_in: 3600,
            }),
    },
    {
        // The PLC DID document points the service PDS to this fake origin.
        method: "GET",
        // DID paths arrive URL-encoded, so decode them before matching.
        match: url => decodeURIComponent(url.pathname).startsWith("/did:"),
        handle: ({ url, fixtures }) => {
            const path = decodeURIComponent(url.pathname)
            if (path !== `/${fixtures.did}`)
                return json(404, { error: "NotFound" })
            return json(200, {
                id: fixtures.did,
                alsoKnownAs: [`at://${fixtures.handle}`],
                service: [
                    {
                        id: "#atproto_pds",
                        type: "AtprotoPersonalDataServer",
                        serviceEndpoint: url.origin,
                    },
                ],
            })
        },
    },
    {
        method: "POST",
        match: pathIs("/xrpc/com.atproto.server.createSession"),
        handle: ({ fixtures }) =>
            json(200, {
                accessJwt: "access-fixture",
                refreshJwt: "refresh-fixture",
                did: fixtures.did,
                handle: fixtures.handle,
                active: true,
            }),
    },
    {
        // App-password sessions refresh on each request, so return the same response shape.
        method: "POST",
        match: pathIs("/xrpc/com.atproto.server.refreshSession"),
        handle: ({ fixtures }) =>
            json(200, {
                accessJwt: "access-fixture",
                refreshJwt: "refresh-fixture",
                did: fixtures.did,
                handle: fixtures.handle,
                active: true,
            }),
    },
    {
        method: "GET",
        match: pathIs("/xrpc/app.bsky.actor.getProfile"),
        handle: ({ fixtures }) =>
            json(200, {
                did: fixtures.did,
                handle: fixtures.handle,
                displayName: "Alice",
            }),
    },
    {
        method: "GET",
        match: pathIs("/xrpc/com.atproto.server.getSession"),
        handle: ({ fixtures }) =>
            json(200, {
                did: fixtures.did,
                handle: fixtures.handle,
                active: true,
            }),
    },
    {
        method: "POST",
        match: pathIs("/xrpc/com.atproto.repo.applyWrites"),
        handle: ({ body, fixtures, store }) => {
            const writes = (JSON.parse(body || "{}").writes ?? []) as {
                $type?: string
                collection: string
                rkey: string
                value?: unknown
            }[]
            const results = writes.map((w, i) => {
                const uri = `at://${fixtures.did}/${w.collection}/${w.rkey}`
                if (w.$type?.endsWith("#delete")) {
                    store.records.delete(uri)
                    return {
                        $type: "com.atproto.repo.applyWrites#deleteResult",
                    }
                }
                const cid = FAKE_CID
                store.records.set(uri, { cid, value: w.value })
                return {
                    $type: "com.atproto.repo.applyWrites#createResult",
                    uri,
                    cid,
                }
            })
            return json(200, {
                commit: { cid: FAKE_CID, rev: FAKE_REV },
                results,
            })
        },
    },
    {
        method: "POST",
        match: pathIs("/xrpc/com.atproto.repo.putRecord"),
        handle: ({ body, fixtures, store }) => {
            const req = JSON.parse(body || "{}") as {
                collection: string
                rkey: string
                record?: unknown
            }
            const uri = `at://${fixtures.did}/${req.collection}/${req.rkey}`
            store.records.set(uri, { cid: FAKE_CID, value: req.record })
            return json(200, { uri, cid: FAKE_CID })
        },
    },
    {
        // Return a stored PDS record or RecordNotFound when it is absent.
        method: "GET",
        match: pathIs("/xrpc/com.atproto.repo.getRecord"),
        handle: ({ url, fixtures, store }) => {
            const uri = `at://${url.searchParams.get("repo") ?? ""}/${url.searchParams.get("collection") ?? ""}/${url.searchParams.get("rkey") ?? ""}`
            const record = store.records.get(uri)
            if (!record) return json(400, { error: "RecordNotFound" })
            return json(200, { uri, cid: record.cid, value: record.value })
        },
    },
    {
        // Return stored posts in the author, record, and count shape expected by AppView.
        method: "GET",
        match: pathIs("/xrpc/app.bsky.feed.getPosts"),
        handle: ({ url, fixtures, store }) => {
            const posts = url.searchParams.getAll("uris").flatMap(uri => {
                const record = store.records.get(uri)
                if (!record) return []
                return [
                    {
                        uri,
                        cid: record.cid,
                        author: {
                            did: fixtures.did,
                            handle: fixtures.handle,
                            displayName: "Alice",
                        },
                        record: record.value,
                        indexedAt: new Date(0).toISOString(),
                        likeCount: 0,
                        repostCount: 0,
                        replyCount: 0,
                        quoteCount: 0,
                    },
                ]
            })
            return json(200, { posts })
        },
    },
    {
        // E2E users have no timeline posts, so return an empty feed.
        method: "GET",
        match: pathIs("/xrpc/app.bsky.feed.getAuthorFeed"),
        handle: () => json(200, { feed: [] }),
    },
    {
        method: "POST",
        match: pathIs("/xrpc/com.atproto.repo.uploadBlob"),
        handle: () =>
            json(200, {
                blob: {
                    $type: "blob",
                    // Use a valid CID for lexicon validation without serving image bytes.
                    ref: { $link: FAKE_CID },
                    mimeType: "image/png",
                    size: 79,
                },
            }),
    },
]

/** Returns a route response, or `undefined` when the caller should return 404. */
export const respondTo = (input: {
    readonly method: string
    readonly url: URL
    readonly fixtures: FakeBlueskyFixtures
    readonly body?: string
    readonly store: FakeStore
}): FakeReply | undefined => {
    const route = ROUTES.find(
        r => r.method === input.method && r.match(input.url),
    )
    return route?.handle({
        url: input.url,
        fixtures: input.fixtures,
        body: input.body ?? "",
        store: input.store,
    } as FakeRequest)
}

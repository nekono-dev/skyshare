// 偽の Bluesky の応答の定義（HTTP に依存しない）。E2E の偽サーバーと route 層の outboundService が同じ定義を使う。
// 認可の往復（PAR → authorize → token）の状態と、書き込まれたレコードは、ストア（この定義の中の記録）で持つ。
import type { FakeBlueskyFixtures } from "./types"

export type FakeReply = {
    readonly status: number
    readonly body?: unknown
    readonly headers?: Record<string, string>
}

/** 書き込まれたレコード（AT URI → cid と値）。取得の経路（getRecord・getPosts）が読む */
export type FakeRecord = { readonly cid: string; readonly value: unknown }

/**
 * 認可の往復の状態と、書き込まれたレコード。
 * `par`: PAR で受けた要求を request_uri で引けるように保つ。`records`: applyWrites と putRecord で書かれた値。
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

/** 経路の定義。E2E の六つの流れが呼ぶ endpoint だけを置く */
type Route = {
    readonly method: string
    readonly match: (url: URL) => boolean
    readonly handle: (req: FakeRequest) => FakeReply
}

/** 画像の CID（形式の正しい固定値。画像の実体は持たない） */
// 形式の正しい TID（コミットの rev に使う）
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
        // 認可の要求を事前に受け付ける。以降の authorize は request_uri で引く
        method: "POST",
        match: pathIs("/oauth/par"),
        handle: ({ body, store }) => {
            const requestUri = newRequestUri()
            store.par.set(requestUri, Object.fromEntries(formOf(body)))
            return json(201, { request_uri: requestUri, expires_in: 300 })
        },
    },
    {
        // 利用者の認可の画面を省略し、要求の redirect_uri へ認可コードを返す
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
        // PLC の DID 文書。サービスの PDS は、この fake の origin を指す
        method: "GET",
        // DID の経路は URL エンコードされて届く（%3A）ため、復号してから見る
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
        // アプリパスワードのセッションは要求のたびに更新されるため、同じ形の応答を返す
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
        // 書き込まれたレコードを返す（PDS の取得）。無ければ RecordNotFound
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
        // AppView の投稿の取得。書き込まれた投稿を、閲覧に要る形（author・record・件数）で返す
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
        // 自分の投稿の一覧（タイムライン）。E2E の利用者は投稿を一覧に出すまで持たないため、空の一覧を返す
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
                    // 実在する形の CID（lexicon の検査を通す）。画像の実体は配信しない
                    ref: { $link: FAKE_CID },
                    mimeType: "image/png",
                    size: 79,
                },
            }),
    },
]

/**
 * 経路に対する応答を返す。定義されていなければ `undefined`（呼び出し側は 404 にする）。
 * Input: method、URL（origin はこの値で決まる）、fixtures、本文、ストア
 */
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

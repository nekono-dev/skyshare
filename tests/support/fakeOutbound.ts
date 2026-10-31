// route 層（workerd）の外部通信の差し替え（要件 5.1・10.5）。
// miniflare の outboundService として登録し、Bluesky の応答を偽の定義から返す。定義がなければ 404 を返し、実ネットワークへは出ない。
import { createFakeStore, respondTo } from "./fakeBluesky/routes"
import type { FakeBlueskyFixtures } from "./fakeBluesky/types"

/** route 層のテスト用の固定の識別子（架空の値） */
const fixtures: FakeBlueskyFixtures = {
    did: "did:plc:testfixturealice0000000000",
    handle: "alice.test",
}

/** 認可の往復の状態は、route 層のテストの間で共有する（テストのファイルごとに D1 と同様に分かれる） */
const store = createFakeStore()

/** outboundService の本体。workerd からの外部 fetch を受け、偽の応答を返す */
export const fakeOutbound = async (request: Request): Promise<Response> => {
    const body =
        request.method === "GET" || request.method === "HEAD"
            ? ""
            : await request.text()
    const reply = respondTo({
        method: request.method,
        url: new URL(request.url),
        fixtures,
        body,
        store,
    })
    if (!reply)
        return new Response(
            JSON.stringify({ error: "NotFound", message: "no fake route" }),
            { status: 404 },
        )
    return new Response(
        reply.body === undefined ? null : JSON.stringify(reply.body),
        {
            status: reply.status,
            headers: { "content-type": "application/json", ...reply.headers },
        },
    )
}

/**
 * PDS の XRPC と、その認可サーバーのトークンの端点を模した fetch。
 * 呼び出しを記録し、書き込まれたレコードを保持する。
 *
 * - `https://pds/oauth/token` への要求は `nsid: "oauth.token"` として記録し、フォームの項目を `body` に入れる。
 *   更新用トークンの要求には、新しいアクセストークンと回転した更新用トークンを返す。
 * - XRPC の要求の `token` には、`Bearer` と `DPoP` のどちらの方式でも、トークンの値だけを入れる。
 *   `dpop` には、送られた DPoP の証明を入れる。
 */
export type PdsCall = { nsid: string; body: any; token?: string; dpop?: string }

export type FakePds = {
    fetch: typeof fetch
    calls: PdsCall[]
    /** uri -> 書き込まれたレコード（同じ uri への再書き込みは上書き） */
    records: Map<string, any>
    /** 通信の応答を差し替える。null を返すと既定の応答になる */
    override?: (
        call: PdsCall,
        count: number,
    ) => Response | null | Promise<Response | null>
}

export const createFakePds = (did: string): FakePds => {
    const pds: FakePds = {
        calls: [],
        records: new Map(),
        fetch: (async (url: string, init: RequestInit) => {
            const path = new URL(url).pathname
            const isToken = path === "/oauth/token"
            const nsid = isToken ? "oauth.token" : path.replace("/xrpc/", "")
            const raw = init.body
            const headers = (init.headers ?? {}) as Record<string, string>
            const body =
                raw instanceof Uint8Array || raw instanceof ArrayBuffer
                    ? { bytes: (raw as ArrayBuffer).byteLength }
                    : isToken
                      ? Object.fromEntries(new URLSearchParams(raw as string))
                      : raw
                        ? JSON.parse(raw as string)
                        : undefined
            const token = headers.authorization?.replace(/^(Bearer|DPoP) /, "")
            const call = { nsid, body, token, dpop: headers.dpop }
            pds.calls.push(call)
            const overridden = await pds.override?.(call, pds.calls.length)
            if (overridden) return overridden
            const json = (o: object) =>
                new Response(JSON.stringify(o), { status: 200 })
            switch (nsid) {
                case "oauth.token":
                    return json({
                        access_token: "ACCESS",
                        refresh_token: "NEW-REFRESH",
                        token_type: "DPoP",
                        sub: did,
                    })
                case "com.atproto.repo.uploadBlob":
                    return json({
                        blob: {
                            $type: "blob",
                            ref: { $link: `blob-${pds.calls.length}` },
                            mimeType: "image/png",
                            size: body?.bytes ?? 0,
                        },
                    })
                case "com.atproto.repo.putRecord": {
                    const uri = `at://${body.repo}/${body.collection}/${body.rkey}`
                    pds.records.set(uri, body.record)
                    return json({ uri, cid: `cid-${body.rkey}` })
                }
                default:
                    return new Response("{}", { status: 404 })
            }
        }) as unknown as typeof fetch,
    }
    return pds
}

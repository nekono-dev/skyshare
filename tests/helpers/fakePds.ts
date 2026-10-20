/**
 * PDS の XRPC を模した fetch。呼び出しを記録し、書き込まれたレコードを保持する。
 */
export type PdsCall = { nsid: string; body: any; token?: string }

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
            const nsid = new URL(url).pathname.replace("/xrpc/", "")
            const raw = init.body
            const body =
                raw instanceof Uint8Array || raw instanceof ArrayBuffer
                    ? { bytes: (raw as ArrayBuffer).byteLength }
                    : raw
                      ? JSON.parse(raw as string)
                      : undefined
            const token = (
                init.headers as Record<string, string>
            )?.authorization?.replace("Bearer ", "")
            const call = { nsid, body, token }
            pds.calls.push(call)
            const overridden = await pds.override?.(call, pds.calls.length)
            if (overridden) return overridden
            const json = (o: object) =>
                new Response(JSON.stringify(o), { status: 200 })
            switch (nsid) {
                case "com.atproto.server.refreshSession":
                    return json({
                        did,
                        accessJwt: "ACCESS",
                        refreshJwt: "NEW-REFRESH",
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

import { afterEach, describe, expect, it, vi } from "vitest"

import {
    createVideoUploadToken,
    isSupportedVideoPds,
} from "@/lib/atproto/videoAuth"

const didDocOf = (endpoint: string) => ({
    service: [
        {
            id: "#atproto_pds",
            type: "AtprotoPersonalDataServer",
            serviceEndpoint: endpoint,
        },
    ],
})

const makeAgent = (getServiceAuth: unknown) =>
    ({ com: { atproto: { server: { getServiceAuth } } } }) as any

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("isSupportedVideoPds", () => {
    it("bsky.social 系は対応PDS", () => {
        expect(isSupportedVideoPds("https://bsky.social")).toBe(true)
        expect(
            isSupportedVideoPds("https://amanita.us-east.host.bsky.network"),
        ).toBe(true)
    })

    it("独自ドメイン・紛らわしいホストは対応外", () => {
        expect(isSupportedVideoPds("https://example.com")).toBe(false)
        expect(isSupportedVideoPds("https://evilbsky.social")).toBe(false)
        expect(
            isSupportedVideoPds("https://host.bsky.network.example.com"),
        ).toBe(false)
        expect(isSupportedVideoPds("not a url")).toBe(false)
    })
})

describe("createVideoUploadToken", () => {
    it("aud・lxm・expを指定して getServiceAuth を呼ぶ", async () => {
        const getServiceAuth = vi
            .fn()
            .mockResolvedValue({ data: { token: "tok" } })
        const result = await createVideoUploadToken(
            makeAgent(getServiceAuth),
            {
                did: "did:plc:me",
                didDoc: didDocOf("https://amanita.us-east.host.bsky.network"),
            },
            1000,
        )
        expect(getServiceAuth).toHaveBeenCalledWith({
            aud: "did:web:amanita.us-east.host.bsky.network",
            lxm: "com.atproto.repo.uploadBlob",
            exp: 1000 + 1800,
        })
        expect(result).toEqual({
            ok: true,
            token: "tok",
            did: "did:plc:me",
            expiresAt: 2800,
        })
    })

    it("didDoc が無ければ PLC ディレクトリから PDS を解決する", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValue(
                    new Response(
                        JSON.stringify(didDocOf("https://bsky.social")),
                    ),
                ),
        )
        const getServiceAuth = vi
            .fn()
            .mockResolvedValue({ data: { token: "tok" } })
        const result = await createVideoUploadToken(
            makeAgent(getServiceAuth),
            { did: "did:plc:me" },
            0,
        )
        expect(result.ok).toBe(true)
        expect(getServiceAuth.mock.calls[0][0].aud).toBe("did:web:bsky.social")
    })

    it("PDS を解決できなければ 500", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response("", { status: 404 })),
        )
        const result = await createVideoUploadToken(
            makeAgent(vi.fn()),
            { did: "did:plc:me" },
            0,
        )
        expect(result).toEqual({ ok: false, status: 500 })
    })

    it("対応外PDSは 400 で getServiceAuth を呼ばない", async () => {
        const getServiceAuth = vi.fn()
        const result = await createVideoUploadToken(
            makeAgent(getServiceAuth),
            { did: "did:plc:me", didDoc: didDocOf("https://example.com") },
            0,
        )
        expect(result).toEqual({ ok: false, status: 400 })
        expect(getServiceAuth).not.toHaveBeenCalled()
    })

    it("getServiceAuth が失敗したら 500", async () => {
        const result = await createVideoUploadToken(
            makeAgent(vi.fn().mockRejectedValue(new Error("boom"))),
            { did: "did:plc:me", didDoc: didDocOf("https://bsky.social") },
            0,
        )
        expect(result).toEqual({ ok: false, status: 500 })
    })
})

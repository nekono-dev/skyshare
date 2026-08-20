import { afterEach, describe, expect, it, vi } from "vitest"

import {
    readPdsServiceFromDidDoc,
    resolvePdsServiceForDid,
} from "@/lib/atproto/did"

describe("readPdsServiceFromDidDoc", () => {
    it("atproto PDS のserviceEndpointを抽出する", () => {
        expect(
            readPdsServiceFromDidDoc({
                service: [
                    {
                        id: "#atproto_pds",
                        type: "AtprotoPersonalDataServer",
                        serviceEndpoint: "https://example.social",
                    },
                ],
            }),
        ).toBe("https://example.social")
    })

    it("該当するserviceが無ければ undefined", () => {
        expect(
            readPdsServiceFromDidDoc({
                service: [
                    { id: "#other", type: "Other", serviceEndpoint: "x" },
                ],
            }),
        ).toBeUndefined()
    })

    it("serviceが配列でない/didDocが不正なら undefined", () => {
        expect(readPdsServiceFromDidDoc({})).toBeUndefined()
        expect(readPdsServiceFromDidDoc(null)).toBeUndefined()
        expect(readPdsServiceFromDidDoc("not-an-object")).toBeUndefined()
    })

    it("serviceEndpointが空文字なら undefined", () => {
        expect(
            readPdsServiceFromDidDoc({
                service: [
                    {
                        id: "#atproto_pds",
                        type: "AtprotoPersonalDataServer",
                        serviceEndpoint: "",
                    },
                ],
            }),
        ).toBeUndefined()
    })
})

describe("resolvePdsServiceForDid", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("did:plc: 以外は fetch を呼ばず undefined", async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)

        expect(
            await resolvePdsServiceForDid("did:web:example.com"),
        ).toBeUndefined()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("レスポンスが失敗(ok=false)なら undefined", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))

        expect(await resolvePdsServiceForDid("did:plc:abc")).toBeUndefined()
    })

    it("正常なDID Documentからserviceを解決する", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    service: [
                        {
                            id: "#atproto_pds",
                            type: "AtprotoPersonalDataServer",
                            serviceEndpoint: "https://example.social",
                        },
                    ],
                }),
            }),
        )

        expect(await resolvePdsServiceForDid("did:plc:abc")).toBe(
            "https://example.social",
        )
    })
})

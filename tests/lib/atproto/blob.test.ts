import { describe, expect, it, vi } from "vitest"

import { uploadBlob } from "@/lib/atproto/blob"

describe("uploadBlob", () => {
    it("blob.type を encoding に反映して uploadBlob を呼ぶ", async () => {
        const uploadBlobFn = vi
            .fn()
            .mockResolvedValue({ data: { blob: { $type: "blob", ref: "x" } } })
        const agent = { uploadBlob: uploadBlobFn }

        const result = await uploadBlob(
            agent,
            new Blob(["data"], { type: "image/jpeg" }),
        )

        expect(uploadBlobFn).toHaveBeenCalledWith(expect.any(Uint8Array), {
            encoding: "image/jpeg",
        })
        expect(result).toEqual({ $type: "blob", ref: "x" })
    })

    it("typeが空ならapplication/octet-streamにフォールバックする", async () => {
        const uploadBlobFn = vi.fn().mockResolvedValue({ data: { blob: {} } })
        const agent = { uploadBlob: uploadBlobFn }

        await uploadBlob(agent, new Blob(["data"]))

        expect(uploadBlobFn).toHaveBeenCalledWith(expect.any(Uint8Array), {
            encoding: "application/octet-stream",
        })
    })
})

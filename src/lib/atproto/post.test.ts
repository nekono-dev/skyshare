import { describe, expect, it, vi } from "vitest"

import { createBskyPost } from "@/lib/atproto/post"

describe("createBskyPost", () => {
    it("selfLabel指定時はlabelsをselfLabels形式に変換してpostへ渡す", async () => {
        const postFn = vi
            .fn()
            .mockResolvedValue({ uri: "at://x", cid: "bafy" })
        const agent = { post: postFn }

        const result = await createBskyPost(
            agent,
            "hello",
            undefined,
            ["ja"],
            undefined,
            "sexual",
        )

        expect(postFn).toHaveBeenCalledWith(
            expect.objectContaining({
                text: "hello",
                langs: ["ja"],
                labels: {
                    $type: "com.atproto.label.defs#selfLabels",
                    values: [{ val: "sexual" }],
                },
                via: "Skyshare",
            }),
        )
        expect(result).toEqual({ uri: "at://x", cid: "bafy" })
    })

    it("selfLabel未指定ならlabelsはundefined", async () => {
        const postFn = vi.fn().mockResolvedValue({ uri: "at://x", cid: "bafy" })
        const agent = { post: postFn }

        await createBskyPost(agent, "hello", undefined, undefined, undefined, undefined)

        expect(postFn).toHaveBeenCalledWith(
            expect.objectContaining({ labels: undefined }),
        )
    })
})

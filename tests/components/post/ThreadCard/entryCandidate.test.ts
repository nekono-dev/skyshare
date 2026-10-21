import { describe, expect, it } from "vitest"
import {
    findEntryCarrier,
    resolveEntryVisualSourcePost,
} from "@/components/post/ThreadCard/entryCandidate"
import type { ThreadGroup, TimelinePost } from "@/lib/entry/posts"

const author = { did: "did:plc:abc", handle: "alice.bsky.social" }

const makePost = (
    rkey: string,
    overrides: Partial<TimelinePost> = {},
): TimelinePost => ({
    uri: `at://did:plc:abc/app.bsky.feed.post/${rkey}`,
    cid: `cid-${rkey}`,
    url: `https://bsky.app/profile/alice.bsky.social/post/${rkey}`,
    indexedAt: "2026-01-01T00:00:00Z",
    author,
    text: rkey,
    images: [],
    ...overrides,
})

const skyshareEntry = {
    uri: "https://skyshare.example/x",
    cid: "entrycid",
    createdAt: "2026-01-01T00:00:00Z",
    sourceUri: "at://did:plc:abc/app.bsky.feed.post/root",
    sourceCid: "cid-root",
}

const image = { url: "https://example.com/a.png", alt: "", cid: "imgcid" }

describe("resolveEntryVisualSourcePost", () => {
    it("単独投稿(replies:[])はnullを返す", () => {
        const group: ThreadGroup = {
            rootPost: makePost("root", { images: [image] }),
            replies: [],
        }
        expect(resolveEntryVisualSourcePost(group)).toBeNull()
    })

    it("ルートが画像を持ち、entryが無い場合はルート投稿を返す", () => {
        const root = makePost("root", { images: [image] })
        const group: ThreadGroup = {
            rootPost: root,
            replies: [makePost("mid")],
        }
        expect(resolveEntryVisualSourcePost(group)).toBe(root)
    })

    it("ルート投稿自身にentryがあってもルート投稿を返す(entryの有無はフックのdisplayで判定し、削除後に作成ボタンを復帰させるため)", () => {
        const root = makePost("root", { images: [image], skyshareEntry })
        const group: ThreadGroup = {
            rootPost: root,
            replies: [makePost("mid")],
        }
        expect(resolveEntryVisualSourcePost(group)).toBe(root)
    })

    it("[timeline/AC-7] repliesの投稿に既にentryがあっても、ルート投稿を返す(実装前に中間投稿へentryが作成されていたケース)", () => {
        const root = makePost("root", { images: [image] })
        const group: ThreadGroup = {
            rootPost: root,
            replies: [makePost("mid", { skyshareEntry })],
        }
        expect(resolveEntryVisualSourcePost(group)).toBe(root)
    })

    it("ルート・repliesのいずれも画像を持たない場合はnullを返す", () => {
        const group: ThreadGroup = {
            rootPost: makePost("root"),
            replies: [makePost("mid"), makePost("tail")],
        }
        expect(resolveEntryVisualSourcePost(group)).toBeNull()
    })

    it("[timeline/AC-5] ルートが画像を持たない場合、repliesのうち時系列上最も古い画像投稿を返す", () => {
        const mid = makePost("mid", { images: [image] })
        const tail = makePost("tail", { images: [image] })
        const group: ThreadGroup = {
            rootPost: makePost("root"),
            replies: [mid, tail],
        }
        expect(resolveEntryVisualSourcePost(group)).toBe(mid)
    })
})

describe("findEntryCarrier", () => {
    it("単独投稿(replies:[])はnullを返す", () => {
        const group: ThreadGroup = {
            rootPost: makePost("root", { skyshareEntry }),
            replies: [],
        }
        expect(findEntryCarrier(group)).toBeNull()
    })

    it("グループ内のどの投稿にもentryが無い場合はnullを返す", () => {
        const group: ThreadGroup = {
            rootPost: makePost("root"),
            replies: [makePost("mid")],
        }
        expect(findEntryCarrier(group)).toBeNull()
    })

    it("ルート投稿にentryがある場合、ルート投稿を返す", () => {
        const root = makePost("root", { skyshareEntry })
        const group: ThreadGroup = {
            rootPost: root,
            replies: [makePost("mid")],
        }
        expect(findEntryCarrier(group)).toBe(root)
    })
})

describe("resolveEntryVisualSourcePost（動画）", () => {
    const video = {
        cid: "videocid",
        playlistUrl: "https://video.bsky.app/watch/d/c/playlist.m3u8",
        thumbnailUrl: "https://video.bsky.app/watch/d/c/thumbnail.jpg",
        alt: "",
    }

    it("ルートが動画投稿ならルートを返す", () => {
        const root = makePost("root", { video })
        const group: ThreadGroup = {
            rootPost: root,
            replies: [makePost("mid", { images: [image] })],
        }
        expect(resolveEntryVisualSourcePost(group)).toBe(root)
    })

    it("ルートがメディア無しで reply が動画投稿ならその reply を返す", () => {
        const reply = makePost("mid", { video })
        const group: ThreadGroup = {
            rootPost: makePost("root"),
            replies: [reply],
        }
        expect(resolveEntryVisualSourcePost(group)).toBe(reply)
    })

    it("画像と動画が混在する場合はルートに近い方を返す", () => {
        const first = makePost("mid1", { video })
        const group: ThreadGroup = {
            rootPost: makePost("root"),
            replies: [first, makePost("mid2", { images: [image] })],
        }
        expect(resolveEntryVisualSourcePost(group)).toBe(first)
    })

    it("利用不可の動画だけの投稿は素材にならない", () => {
        const group: ThreadGroup = {
            rootPost: makePost("root", { unsupportedVideo: video }),
            replies: [makePost("mid")],
        }
        expect(resolveEntryVisualSourcePost(group)).toBeNull()
    })
})

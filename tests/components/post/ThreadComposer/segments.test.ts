import { describe, expect, it, test } from "vitest"
import {
    addSegment,
    canRemoveSegment,
    createEmptySegment,
    draftPostsToSegments,
    hasPendingVideo,
    isSegmentPostable,
    pendingVideoState,
    removeSegment,
    scheduleDetailToSegments,
    segmentsToDraftPosts,
    type SegmentState,
    type VideoEntry,
} from "@/components/post/ThreadComposer/segments"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/post"

describe("createEmptySegment", () => {
    it("空のセグメントを作る", () => {
        const segment = createEmptySegment("ja")
        expect(segment.text).toBe("")
        expect(segment.languageCode).toBe("ja")
        expect(segment.selfLabel).toBeUndefined()
        expect(segment.imageEntry).toBeNull()
        expect(segment.ogpResult).toBeNull()
        expect(segment.videoEntry).toBeNull()
    })

    it("呼び出しごとに一意なidを発行する", () => {
        const a = createEmptySegment("ja")
        const b = createEmptySegment("ja")
        expect(a.id).not.toBe(b.id)
    })
})

describe("addSegment", () => {
    it("[thread-composer/AC-1] 末尾にセグメントを1件追加する", () => {
        const segments = [createEmptySegment("ja")]
        const next = addSegment(segments, "en")
        expect(next).toHaveLength(2)
        expect(next[1].languageCode).toBe("en")
    })

    it("[thread-composer/AC-1] MAX_THREAD_POST_COUNTに達している場合は追加しない", () => {
        const segments = Array.from({ length: MAX_THREAD_POST_COUNT }, () =>
            createEmptySegment("ja"),
        )
        const next = addSegment(segments, "ja")
        expect(next).toHaveLength(MAX_THREAD_POST_COUNT)
        expect(next).toBe(segments)
    })
})

describe("canRemoveSegment / removeSegment", () => {
    it("[thread-composer/AC-5] 先頭(0件目)は削除できない", () => {
        expect(canRemoveSegment(0)).toBe(false)
        const segments = [createEmptySegment("ja"), createEmptySegment("ja")]
        const next = removeSegment(segments, 0)
        expect(next).toBe(segments)
        expect(next).toHaveLength(2)
    })

    it("[thread-composer/AC-5] 2件目以降は削除できる", () => {
        expect(canRemoveSegment(1)).toBe(true)
        const first = createEmptySegment("ja")
        const second = createEmptySegment("ja")
        const third = createEmptySegment("ja")
        const next = removeSegment([first, second, third], 1)
        expect(next).toEqual([first, third])
    })
})

describe("segmentsToDraftPosts / draftPostsToSegments", () => {
    it("[thread-composer/AC-9] セグメント配列を下書きposts配列へ変換する（labelsは選択時のみ）", () => {
        const segments: SegmentState[] = [
            {
                ...createEmptySegment("ja"),
                text: "1件目",
                selfLabel: "spoiler",
            },
            { ...createEmptySegment("ja"), text: "2件目" },
        ]
        const posts = segmentsToDraftPosts(segments)
        expect(posts).toEqual([
            { text: "1件目", labels: ["spoiler"] },
            { text: "2件目", labels: undefined },
        ])
    })

    it("[thread-composer/AC-9] 下書きposts配列からセグメント配列を復元する（画像等は空で復元される）", () => {
        const restored = draftPostsToSegments(
            [{ text: "1件目", labels: ["spoiler"] }, { text: "2件目" }],
            "en",
        )
        expect(restored).toHaveLength(2)
        expect(restored[0].text).toBe("1件目")
        expect(restored[0].selfLabel).toBe("spoiler")
        expect(restored[0].languageCode).toBe("en")
        expect(restored[0].imageEntry).toBeNull()
        expect(restored[0].ogpResult).toBeNull()
        expect(restored[1].text).toBe("2件目")
        expect(restored[1].selfLabel).toBeUndefined()
    })

    it("[thread-composer/AC-9] 往復させても本文とlabelsが保たれる", () => {
        const original = segmentsToDraftPosts([
            { ...createEmptySegment("ja"), text: "本文A" },
            { ...createEmptySegment("ja"), text: "本文B", selfLabel: "!warn" },
        ])
        const roundTripped = segmentsToDraftPosts(
            draftPostsToSegments(original, "ja"),
        )
        expect(roundTripped).toEqual(original)
    })
})

const videoEntry = (upload: VideoEntry["upload"]): VideoEntry => ({
    fileName: "a.mp4",
    width: 640,
    height: 360,
    durationSec: 5,
    alt: "",
    posterPreview: "blob:x",
    thumbnailPreview: "blob:y",
    posterBlob: new Blob(["p"]),
    cropState: {
        crop: { x: 0, y: 0 },
        zoom: 1,
        cropPixels: null,
    },
    thumbnailBlob: new Blob(["t"]),
    upload,
})

const DONE: VideoEntry["upload"] = {
    state: "done",
    blob: {
        $type: "blob",
        ref: { $link: "bafkreivideo" },
        mimeType: "video/mp4",
        size: 10,
    },
}

describe("動画segmentの投稿条件", () => {
    const base = createEmptySegment("ja")

    it("完了した動画があればテキストが空でも投稿条件を満たす", () => {
        expect(
            isSegmentPostable({ ...base, videoEntry: videoEntry(DONE) }),
        ).toBe(true)
    })

    it("アップロード中・失敗の動画だけでは投稿条件を満たさない", () => {
        const uploading = videoEntry({
            state: "uploading",
            progress: { phase: "uploading", percent: 10 },
        })
        expect(isSegmentPostable({ ...base, videoEntry: uploading })).toBe(
            false,
        )
    })
})

describe("pendingVideoState / hasPendingVideo", () => {
    const withVideo = (entry: VideoEntry | null): SegmentState => ({
        ...createEmptySegment("ja"),
        text: "x",
        videoEntry: entry,
    })
    const uploading = videoEntry({
        state: "uploading",
        progress: { phase: "processing", percent: 50 },
    })
    const failed = videoEntry({
        state: "error",
        messageKey: "video.error.dailyLimit",
    })

    it("動画が無い・完了済みなら未完了なし", () => {
        expect(pendingVideoState([withVideo(null)])).toBeNull()
        expect(pendingVideoState([withVideo(videoEntry(DONE))])).toBeNull()
        expect(hasPendingVideo([withVideo(videoEntry(DONE))])).toBe(false)
    })

    it("実行中なら uploading、失敗が残っていれば error（失敗を優先）", () => {
        expect(pendingVideoState([withVideo(uploading)])).toBe("uploading")
        expect(pendingVideoState([withVideo(failed)])).toBe("error")
        expect(
            pendingVideoState([withVideo(uploading), withVideo(failed)]),
        ).toBe("error")
        expect(hasPendingVideo([withVideo(uploading)])).toBe(true)
    })

    it("取り外す（videoEntry が null）と解消する", () => {
        expect(pendingVideoState([withVideo(null), withVideo(null)])).toBeNull()
    })
})

describe("scheduleDetailToSegments", () => {
    test("thread-composer/AC-16: 予約の内容から本文・画像と代替テキスト・リンクカード・制限・自己ラベル・言語が戻る", () => {
        const img0 = new Blob(["a"], { type: "image/png" })
        const img1 = new Blob(["b"], { type: "image/png" })
        const og = new Blob(["og"], { type: "image/jpeg" })
        const visual = new Blob(["v"], { type: "image/jpeg" })
        const gate = {
            replyAudience: "nobody" as const,
            allowMentioned: false,
            allowFollower: false,
            allowFollowing: false,
            listUris: [],
            allowQuote: false,
        }
        const segments = scheduleDetailToSegments(
            {
                id: "s1",
                runAt: "2027-03-02T10:00:00.000Z",
                posts: [
                    {
                        text: "first",
                        langs: ["en"],
                        selfLabels: "nudity",
                        gate,
                        images: [0, 1],
                        imagesMeta: [
                            { width: 10, height: 20, alt: "代替A" },
                            { width: 30, height: 40, alt: "" },
                        ],
                    },
                    {
                        text: "second",
                        ogMeta: {
                            title: "T",
                            description: "D",
                            url: "https://example.com/",
                        },
                        ogImage: 2,
                    },
                ],
                createEntry: true,
                visual: 3,
            },
            [img0, img1, og, visual],
            "ja",
        )
        expect(segments).toHaveLength(2)
        const [a, b] = segments
        expect(a!.text).toBe("first")
        expect(a!.languageCode).toBe("en")
        expect(a!.selfLabel).toBe("nudity")
        expect(a!.postGate).toEqual(gate)
        expect(a!.imageEntry?.originalBlobs).toEqual([img0, img1])
        expect(a!.imageEntry?.thumbnailBlob).toBe(visual)
        expect(a!.imageEntry?.meta).toEqual([
            { width: 10, height: 20, alt: "代替A" },
            { width: 30, height: 40, alt: "" },
        ])
        expect(b!.languageCode).toBe("ja")
        expect(b!.imageEntry).toBeNull()
        expect(b!.ogpResult).toEqual({
            meta: { title: "T", description: "D" },
            imageBlob: og,
            sourceUrl: "https://example.com/",
        })
    })

    test("代表画像が無い予約では、先頭の画像を代表画像にする", () => {
        const img = new Blob(["a"], { type: "image/png" })
        const [segment] = scheduleDetailToSegments(
            {
                id: "s1",
                runAt: "2027-03-02T10:00:00.000Z",
                posts: [
                    {
                        text: "x",
                        images: [0],
                        imagesMeta: [{ width: 1, height: 1, alt: "" }],
                    },
                ],
            },
            [img],
            "ja",
        )
        expect(segment!.imageEntry?.thumbnailBlob).toBe(img)
    })
})

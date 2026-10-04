import { describe, expect, it } from "vitest"

import { en } from "@/lib/i18n/messages/en"
import { ja } from "@/lib/i18n/messages/ja"
import {
    mapServiceErrorName,
    mapVideoError,
    type VideoErrorCode,
} from "@/lib/video/videoErrors"

const ALL_CODES: VideoErrorCode[] = [
    "notMp4",
    "tooLarge",
    "tooLong",
    "unreadable",
    "badAspectRatio",
    "dailyLimit",
    "forbidden",
    "tooManyUploads",
    "overloaded",
    "processingFailed",
    "timeout",
    "unsupportedPds",
    "network",
    "unknown",
]

describe("mapVideoError", () => {
    it.each(ALL_CODES)(
        "%s は ja・en の両方に定義されたキーへ対応する",
        code => {
            const key = mapVideoError(code)
            expect(key).toBe(`video.error.${code}`)
            expect(key in ja).toBe(true)
            expect(key in (en as Record<string, string>)).toBe(true)
        },
    )
})

describe("mapServiceErrorName", () => {
    it.each([
        ["VideoTooLarge", "tooLarge"],
        ["BadAspectRatio", "badAspectRatio"],
        ["DailyLimitExceeded", "dailyLimit"],
        ["UploadForbidden", "forbidden"],
        ["TooManyOpenUploads", "tooManyUploads"],
        ["ServiceOverloaded", "overloaded"],
        ["Something", "unknown"],
        [undefined, "unknown"],
    ])("%s → %s", (name, code) => {
        expect(mapServiceErrorName(name)).toBe(code)
    })
})

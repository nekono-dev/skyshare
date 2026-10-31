/**
 * 動画の長さの表示の特性化テスト（src-duplicates 1.3・要件 3.2）。
 * 秒と分の 2 桁表示（0〜99 の値の文字列）を、現行の値で固定する。
 */
import { describe, expect, it } from "vitest"
import { formatVideoDuration } from "@/lib/video/formatVideoDuration"

describe("動画の長さの表示（秒は 2 桁、1 時間以上は分も 2 桁）", () => {
    it.each([
        ["最小は 0:01", 0, "0:01"],
        ["小数は四捨五入（0.4 は最小の 0:01）", 0.4, "0:01"],
        ["秒の 1 桁は 0 埋め", 5, "0:05"],
        ["秒の上限は 0:59", 59, "0:59"],
        ["分の 1 桁は 0 埋めしない", 60, "1:00"],
        ["分の 2 桁", 600, "10:00"],
        ["1 時間は 1:00:00", 3600, "1:00:00"],
        ["1 時間以上の分と秒は 2 桁", 3661, "1:01:01"],
        ["1 時間以上で分が 0 のときの秒", 3605, "1:00:05"],
    ])("%s", (_name, sec, expected) => {
        expect(formatVideoDuration(sec)).toBe(expected)
    })
})

/**
 * ビルド時の公開結果取得の旗・記憶・バインディング取得を確かめる。
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import {
    createPublishedSurveysGetter,
    resetPublishedSurveysMemo,
} from "@/lib/survey/publicResults/buildData"
import { SurveyResultsLoadError } from "@/lib/survey/publicResults/loadPublished"

describe("getPublishedSurveys", () => {
    beforeEach(() => resetPublishedSurveysMemo())

    it("does not obtain a binding when the flag is disabled or missing", async () => {
        const bindingGetter = vi.fn()
        const loader = vi.fn()

        await expect(
            createPublishedSurveysGetter("false", bindingGetter, loader).get(),
        ).resolves.toEqual([])
        await expect(
            createPublishedSurveysGetter(
                undefined,
                bindingGetter,
                loader,
            ).get(),
        ).resolves.toEqual([])
        expect(bindingGetter).not.toHaveBeenCalled()
        expect(loader).not.toHaveBeenCalled()
    })

    it("loads once and returns the first result on later calls", async () => {
        const result = [{ id: "result" }]
        const binding = { get: vi.fn() }
        const bindingGetter = vi.fn().mockResolvedValue(binding)
        const loader = vi.fn().mockResolvedValue(result)
        const getter = createPublishedSurveysGetter(
            "true",
            bindingGetter,
            loader,
        ).get

        await expect(getter()).resolves.toBe(result)
        await expect(getter()).resolves.toBe(result)
        expect(bindingGetter).toHaveBeenCalledTimes(1)
        expect(loader).toHaveBeenCalledTimes(1)
    })

    it("memoizes a failure", async () => {
        const error = new SurveyResultsLoadError("invalid")
        const bindingGetter = vi.fn().mockResolvedValue({ get: vi.fn() })
        const loader = vi.fn().mockRejectedValue(error)
        const getter = createPublishedSurveysGetter(
            "true",
            bindingGetter,
            loader,
        ).get

        await expect(getter()).rejects.toBe(error)
        await expect(getter()).rejects.toBe(error)
        expect(loader).toHaveBeenCalledTimes(1)
    })

    it("rejects with a typed read failure when the binding is missing", async () => {
        await expect(
            createPublishedSurveysGetter(
                "true",
                vi.fn().mockResolvedValue(undefined),
            ).get(),
        ).rejects.toMatchObject({
            name: "SurveyResultsLoadError",
            kind: "read",
        })
    })

    it("treats an absent index object as no published surveys through the real loader", async () => {
        const bucket = { get: vi.fn().mockResolvedValue(null) }

        await expect(
            createPublishedSurveysGetter(
                "true",
                vi.fn().mockResolvedValue(bucket),
            ).get(),
        ).resolves.toEqual([])
        expect(bucket.get).toHaveBeenCalledWith("index.json")
    })

    it("passes the stored object size to the loader so the size limit applies", async () => {
        const bucket = {
            get: vi.fn().mockResolvedValue({
                etag: "etag",
                // 申告の大きさが上限（64 KiB）を超える。本文は小さい
                size: 70_000,
                text: async () =>
                    JSON.stringify({ schemaVersion: 1, surveys: [] }),
            }),
        }

        await expect(
            createPublishedSurveysGetter(
                "true",
                vi.fn().mockResolvedValue(bucket),
            ).get(),
        ).rejects.toMatchObject({
            name: "SurveyResultsLoadError",
            kind: "limit",
        })
    })

    it("clears the memo when reset", async () => {
        const bindingGetter = vi.fn().mockResolvedValue({ get: vi.fn() })
        const loader = vi.fn().mockResolvedValue([])
        const getter = createPublishedSurveysGetter(
            "true",
            bindingGetter,
            loader,
        )
        await getter.get()
        getter.reset()
        await getter.get()
        expect(bindingGetter).toHaveBeenCalledTimes(2)
        resetPublishedSurveysMemo()
    })
})

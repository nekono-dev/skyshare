import { beforeEach, describe, expect, test, vi } from "vitest"

const client = vi.hoisted(() => ({
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    getSchedule: vi.fn(),
    getScheduleImage: vi.fn(),
}))
vi.mock("@/client/openapi/client", () => client)

import {
    cancelSchedule,
    fetchScheduleForEdit,
    imageIndexesOf,
    submitSchedule,
} from "@/lib/schedule/submitSchedule"

const runAt = new Date("2027-03-02T10:00:00Z")

beforeEach(() => {
    for (const fn of Object.values(client)) fn.mockReset()
    process.env.TZ = "Asia/Tokyo"
})

describe("submitSchedule", () => {
    test("新規は作成だけを、編集中は置き換えだけを、実行日時つきで1回呼ぶ", async () => {
        client.createSchedule.mockResolvedValue({ status: 200, data: {} })
        client.updateSchedule.mockResolvedValue({ status: 200, data: {} })
        const body = { posts: [{ text: "a" }] } as never
        expect(await submitSchedule({ kind: "create", runAt }, body)).toEqual({
            ok: true,
        })
        expect(client.createSchedule).toHaveBeenCalledTimes(1)
        expect(client.createSchedule.mock.calls[0]![0].runAt).toBe(
            "2027-03-02T19:00:00+09:00",
        )
        expect(client.updateSchedule).not.toHaveBeenCalled()

        await submitSchedule({ kind: "update", id: "s1", runAt }, body)
        expect(client.updateSchedule).toHaveBeenCalledTimes(1)
        expect(client.updateSchedule.mock.calls[0]![0]).toBe("s1")
        expect(client.createSchedule).toHaveBeenCalledTimes(1)
    })

    test("失敗は識別子に応じた文言キーになり、通信の失敗は error.network になる", async () => {
        client.createSchedule.mockResolvedValue({
            status: 409,
            data: { error: "ScheduleCredentialRequired" },
        })
        expect(
            await submitSchedule({ kind: "create", runAt }, {} as never),
        ).toEqual({
            ok: false,
            messageKey: "schedule.error.credentialRequired",
        })
        client.deleteSchedule.mockRejectedValue(new Error("offline"))
        expect(await cancelSchedule("s1")).toEqual({
            ok: false,
            messageKey: "error.network",
        })
    })
})

describe("fetchScheduleForEdit", () => {
    const detail = {
        id: "s1",
        runAt: "2027-03-02T10:00:00.000Z",
        posts: [{ text: "a", images: [0, 1] }, { ogImage: 2 }],
        visual: 3,
    }

    test("内容に含まれる画像の番号をすべて集めて取得し、番号の位置に並べる", async () => {
        expect(imageIndexesOf(detail as never)).toEqual([0, 1, 2, 3])
        client.getSchedule.mockResolvedValue({ status: 200, data: detail })
        client.getScheduleImage.mockImplementation(
            async (_id: string, index: number) => ({
                status: 200,
                data: new Blob([String(index)]),
            }),
        )
        const loaded = await fetchScheduleForEdit("s1")
        expect(loaded.ok).toBe(true)
        if (!loaded.ok) return
        expect(loaded.runAt.toISOString()).toBe(detail.runAt)
        expect(await loaded.images[2]!.text()).toBe("2")
        expect(client.getScheduleImage).toHaveBeenCalledTimes(4)
    })

    test("画像が1枚でも取得できなければ全体を失敗にする", async () => {
        client.getSchedule.mockResolvedValue({ status: 200, data: detail })
        client.getScheduleImage.mockImplementation(
            async (_id: string, index: number) =>
                index === 1
                    ? { status: 404, data: {} }
                    : { status: 200, data: new Blob(["x"]) },
        )
        expect(await fetchScheduleForEdit("s1")).toEqual({
            ok: false,
            messageKey: "schedule.error.notFound",
        })
    })

    test("実行中の予約は schedule.error.running になる", async () => {
        client.getSchedule.mockResolvedValue({
            status: 409,
            data: { error: "ScheduleRunning" },
        })
        expect(await fetchScheduleForEdit("s1")).toEqual({
            ok: false,
            messageKey: "schedule.error.running",
        })
    })
})

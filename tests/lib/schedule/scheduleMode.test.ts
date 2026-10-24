import { describe, expect, test } from "vitest"
import {
    applyRunAtChange,
    cancelAction,
    editScheduleMode,
    initialScheduleMode,
    runAtOf,
    submitLabelKey,
    submitTarget,
} from "@/lib/schedule/scheduleMode"

const d1 = new Date("2027-03-02T10:00:00Z")
const d2 = new Date("2027-03-03T10:00:00Z")

describe("予約の状態の遷移", () => {
    test("日時を設定すると新規の予約になり、解除すると通常の入力に戻る", () => {
        const set = applyRunAtChange(initialScheduleMode, d1)
        expect(set).toEqual({
            mode: { kind: "new", runAt: d1 },
            cancelScheduleId: null,
        })
        expect(applyRunAtChange(set.mode, null)).toEqual({
            mode: { kind: "plain" },
            cancelScheduleId: null,
        })
    })

    test("編集中の日時の変更は識別子を保ち、解除は予約の取消になる", () => {
        const editing = editScheduleMode("s1", d1)
        expect(applyRunAtChange(editing, d2).mode).toEqual({
            kind: "editing",
            id: "s1",
            runAt: d2,
        })
        expect(applyRunAtChange(editing, null)).toEqual({
            mode: { kind: "detached" },
            cancelScheduleId: "s1",
        })
        // 取り消した後に日時を設定し直すと、新規の予約になる
        expect(applyRunAtChange({ kind: "detached" }, d2).mode).toEqual({
            kind: "new",
            runAt: d2,
        })
    })

    test("送信先と日時は状態で決まる", () => {
        expect(submitTarget(initialScheduleMode)).toEqual({ kind: "post" })
        expect(submitTarget({ kind: "new", runAt: d1 })).toEqual({
            kind: "create",
            runAt: d1,
        })
        expect(submitTarget(editScheduleMode("s1", d1))).toEqual({
            kind: "update",
            id: "s1",
            runAt: d1,
        })
        expect(submitTarget({ kind: "detached" })).toEqual({ kind: "post" })
        expect(runAtOf({ kind: "detached" })).toBeNull()
    })

    test("schedule-form/AC-8: 日時を設定すると、投稿は予約に、すべて投稿はすべて予約になる", () => {
        expect(submitLabelKey(initialScheduleMode, false)).toBe(
            "post.composer.submit",
        )
        expect(submitLabelKey(initialScheduleMode, true)).toBe(
            "post.composer.submitAll",
        )
        expect(submitLabelKey({ kind: "new", runAt: d1 }, false)).toBe(
            "schedule.submit",
        )
        expect(submitLabelKey(editScheduleMode("s1", d1), true)).toBe(
            "schedule.submitAll",
        )
        expect(submitLabelKey({ kind: "detached" }, false)).toBe(
            "post.composer.submit",
        )
    })

    test("キャンセルの動作は、編集中は3択、取消後は本文があれば常に下書きの確認、それ以外は変更の有無で決まる", () => {
        expect(cancelAction(editScheduleMode("s1", d1), false, true)).toBe(
            "editChoice",
        )
        expect(cancelAction({ kind: "detached" }, false, true)).toBe(
            "draftConfirm",
        )
        expect(cancelAction({ kind: "detached" }, false, false)).toBe("close")
        expect(cancelAction({ kind: "new", runAt: d1 }, true, true)).toBe(
            "draftConfirm",
        )
        expect(cancelAction({ kind: "new", runAt: d1 }, false, true)).toBe(
            "close",
        )
        expect(cancelAction(initialScheduleMode, true, true)).toBe(
            "draftConfirm",
        )
    })
})

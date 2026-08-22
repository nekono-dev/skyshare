import { describe, expect, it } from "vitest"

import {
    reconcileShareToggles,
    type ShareTogglesState,
} from "@/lib/settings/shareTogglesReducer"

/**
 * テスト用の基底状態を組み立てる。
 *
 * Input:
 * - `overrides`: 基底状態から上書きしたいフィールド
 *
 * Output:
 * - 4トグルすべてを明示した `ShareTogglesState`
 */
const buildState = (
    overrides: Partial<ShareTogglesState> = {},
): ShareTogglesState => ({
    crosspostToTaittsuu: false,
    popupIntentInsteadOfWebshare: false,
    showXWhenCrosspost: false,
    noAutoPopupAfterPost: false,
    ...overrides,
})

describe("reconcileShareToggles", () => {
    describe("popupIntentInsteadOfWebshare", () => {
        it("ONにする場合、他のトグルには影響しない", () => {
            const state = buildState({ crosspostToTaittsuu: true })
            const next = reconcileShareToggles(state, {
                field: "popupIntentInsteadOfWebshare",
                next: true,
            })
            expect(next).toEqual({
                ...state,
                popupIntentInsteadOfWebshare: true,
            })
        })

        it("OFFにする場合、crosspostToTaittsuu/showXWhenCrosspost/noAutoPopupAfterPostを強制OFFにする", () => {
            const state = buildState({
                popupIntentInsteadOfWebshare: true,
                crosspostToTaittsuu: true,
                showXWhenCrosspost: true,
                noAutoPopupAfterPost: true,
            })
            const next = reconcileShareToggles(state, {
                field: "popupIntentInsteadOfWebshare",
                next: false,
            })
            expect(next).toEqual(
                buildState({
                    popupIntentInsteadOfWebshare: false,
                    crosspostToTaittsuu: false,
                    showXWhenCrosspost: false,
                    noAutoPopupAfterPost: false,
                }),
            )
        })
    })

    describe("crosspostToTaittsuu", () => {
        it("ONにする場合、popupIntentInsteadOfWebshareを強制ONにする", () => {
            const state = buildState()
            const next = reconcileShareToggles(state, {
                field: "crosspostToTaittsuu",
                next: true,
            })
            expect(next.popupIntentInsteadOfWebshare).toBe(true)
            expect(next.crosspostToTaittsuu).toBe(true)
        })

        it("ONにする場合、showXWhenCrosspostが既にONならnoAutoPopupAfterPostを強制ONにする", () => {
            const state = buildState({ showXWhenCrosspost: true })
            const next = reconcileShareToggles(state, {
                field: "crosspostToTaittsuu",
                next: true,
            })
            expect(next.noAutoPopupAfterPost).toBe(true)
        })

        it("ONにする場合、showXWhenCrosspostがOFFならnoAutoPopupAfterPostは変更しない（元がfalse）", () => {
            const state = buildState({
                showXWhenCrosspost: false,
                noAutoPopupAfterPost: false,
            })
            const next = reconcileShareToggles(state, {
                field: "crosspostToTaittsuu",
                next: true,
            })
            expect(next.noAutoPopupAfterPost).toBe(false)
        })

        it("ONにする場合、showXWhenCrosspostがOFFならnoAutoPopupAfterPostは変更しない（元がtrueでも維持）", () => {
            const state = buildState({
                showXWhenCrosspost: false,
                noAutoPopupAfterPost: true,
            })
            const next = reconcileShareToggles(state, {
                field: "crosspostToTaittsuu",
                next: true,
            })
            expect(next.noAutoPopupAfterPost).toBe(true)
        })

        it("OFFにする場合、showXWhenCrosspostも既にOFFなら（＝両方OFF）noAutoPopupAfterPostを強制OFFにする", () => {
            const state = buildState({
                crosspostToTaittsuu: true,
                showXWhenCrosspost: false,
                noAutoPopupAfterPost: true,
            })
            const next = reconcileShareToggles(state, {
                field: "crosspostToTaittsuu",
                next: false,
            })
            expect(next.crosspostToTaittsuu).toBe(false)
            expect(next.noAutoPopupAfterPost).toBe(false)
        })

        it("OFFにする場合、showXWhenCrosspostがONならnoAutoPopupAfterPostは維持する", () => {
            const state = buildState({
                crosspostToTaittsuu: true,
                showXWhenCrosspost: true,
                noAutoPopupAfterPost: true,
            })
            const next = reconcileShareToggles(state, {
                field: "crosspostToTaittsuu",
                next: false,
            })
            expect(next.crosspostToTaittsuu).toBe(false)
            expect(next.noAutoPopupAfterPost).toBe(true)
        })

        it("OFFにする場合、popupIntentInsteadOfWebshareには影響しない", () => {
            const state = buildState({
                crosspostToTaittsuu: true,
                popupIntentInsteadOfWebshare: true,
            })
            const next = reconcileShareToggles(state, {
                field: "crosspostToTaittsuu",
                next: false,
            })
            expect(next.popupIntentInsteadOfWebshare).toBe(true)
        })
    })

    describe("showXWhenCrosspost", () => {
        it("ONにする場合、popupIntentInsteadOfWebshareとnoAutoPopupAfterPostを強制ONにする", () => {
            const state = buildState()
            const next = reconcileShareToggles(state, {
                field: "showXWhenCrosspost",
                next: true,
            })
            expect(next.showXWhenCrosspost).toBe(true)
            expect(next.popupIntentInsteadOfWebshare).toBe(true)
            expect(next.noAutoPopupAfterPost).toBe(true)
        })

        it("ONにする場合、CrosspostToTaittsuuの状態によらずnoAutoPopupAfterPostを強制ONにする", () => {
            const state = buildState({ crosspostToTaittsuu: true })
            const next = reconcileShareToggles(state, {
                field: "showXWhenCrosspost",
                next: true,
            })
            expect(next.noAutoPopupAfterPost).toBe(true)
            expect(next.crosspostToTaittsuu).toBe(true)
        })

        it("OFFにする場合、crosspostToTaittsuuも既にOFFなら（＝両方OFF）noAutoPopupAfterPostを強制OFFにする", () => {
            const state = buildState({
                showXWhenCrosspost: true,
                crosspostToTaittsuu: false,
                noAutoPopupAfterPost: true,
            })
            const next = reconcileShareToggles(state, {
                field: "showXWhenCrosspost",
                next: false,
            })
            expect(next.showXWhenCrosspost).toBe(false)
            expect(next.noAutoPopupAfterPost).toBe(false)
        })

        it("OFFにする場合、crosspostToTaittsuuがONならnoAutoPopupAfterPostは維持する", () => {
            const state = buildState({
                showXWhenCrosspost: true,
                crosspostToTaittsuu: true,
                noAutoPopupAfterPost: true,
            })
            const next = reconcileShareToggles(state, {
                field: "showXWhenCrosspost",
                next: false,
            })
            expect(next.showXWhenCrosspost).toBe(false)
            expect(next.noAutoPopupAfterPost).toBe(true)
        })
    })

    describe("noAutoPopupAfterPost", () => {
        it("ONにする場合、crosspostToTaittsuu/showXWhenCrosspostがともにOFFならshowXWhenCrosspostとpopupIntentInsteadOfWebshareを強制ONにする", () => {
            const state = buildState({
                crosspostToTaittsuu: false,
                showXWhenCrosspost: false,
            })
            const next = reconcileShareToggles(state, {
                field: "noAutoPopupAfterPost",
                next: true,
            })
            expect(next).toEqual(
                buildState({
                    crosspostToTaittsuu: false,
                    showXWhenCrosspost: true,
                    popupIntentInsteadOfWebshare: true,
                    noAutoPopupAfterPost: true,
                }),
            )
        })

        it("ONにする場合、crosspostToTaittsuuのみONなら他は変更しない", () => {
            const state = buildState({
                crosspostToTaittsuu: true,
                showXWhenCrosspost: false,
                popupIntentInsteadOfWebshare: true,
            })
            const next = reconcileShareToggles(state, {
                field: "noAutoPopupAfterPost",
                next: true,
            })
            expect(next).toEqual({ ...state, noAutoPopupAfterPost: true })
        })

        it("ONにする場合、showXWhenCrosspostのみONなら他は変更しない", () => {
            const state = buildState({
                crosspostToTaittsuu: false,
                showXWhenCrosspost: true,
                popupIntentInsteadOfWebshare: true,
            })
            const next = reconcileShareToggles(state, {
                field: "noAutoPopupAfterPost",
                next: true,
            })
            expect(next).toEqual({ ...state, noAutoPopupAfterPost: true })
        })

        it("ONにする場合、両方ONなら他は変更しない", () => {
            const state = buildState({
                crosspostToTaittsuu: true,
                showXWhenCrosspost: true,
                popupIntentInsteadOfWebshare: true,
            })
            const next = reconcileShareToggles(state, {
                field: "noAutoPopupAfterPost",
                next: true,
            })
            expect(next).toEqual({ ...state, noAutoPopupAfterPost: true })
        })

        it("OFFにする場合、showXWhenCrosspostを強制OFFにする", () => {
            const state = buildState({
                showXWhenCrosspost: true,
                noAutoPopupAfterPost: true,
            })
            const next = reconcileShareToggles(state, {
                field: "noAutoPopupAfterPost",
                next: false,
            })
            expect(next.showXWhenCrosspost).toBe(false)
            expect(next.noAutoPopupAfterPost).toBe(false)
        })

        it("OFFにする場合、crosspostToTaittsuuには影響しない", () => {
            const state = buildState({
                crosspostToTaittsuu: true,
                showXWhenCrosspost: true,
                noAutoPopupAfterPost: true,
            })
            const next = reconcileShareToggles(state, {
                field: "noAutoPopupAfterPost",
                next: false,
            })
            expect(next.crosspostToTaittsuu).toBe(true)
        })

        it("OFFにする場合、showXWhenCrosspostが既にOFFなら変化しない", () => {
            const state = buildState({
                showXWhenCrosspost: false,
                noAutoPopupAfterPost: false,
            })
            const next = reconcileShareToggles(state, {
                field: "noAutoPopupAfterPost",
                next: false,
            })
            expect(next).toEqual(state)
        })
    })
})

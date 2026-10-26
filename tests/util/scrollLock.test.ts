import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// document.body.style と window の最小の代替（Node 環境には DOM が無いため）
const stubDom = (scrollY: number) => {
    const style: Record<string, string> = {
        position: "",
        top: "",
        left: "",
        right: "",
        width: "",
    }
    const scrollTo = vi.fn()
    vi.stubGlobal("document", { body: { style } })
    vi.stubGlobal("window", { scrollY, scrollTo })
    return { style, scrollTo }
}

describe("scrollLock", () => {
    beforeEach(() => {
        vi.resetModules()
    })
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("[browser-utils/2.1,2.2] 最初の要求で body を現在位置に固定し、最後の解除で元の位置へ戻す", async () => {
        const { acquireScrollLock, releaseScrollLock } =
            await import("@/util/scrollLock")
        const { style, scrollTo } = stubDom(120)
        acquireScrollLock()
        expect(style.position).toBe("fixed")
        expect(style.top).toBe("-120px")
        releaseScrollLock()
        expect(style.position).toBe("")
        expect(scrollTo).toHaveBeenCalledWith(0, 120)
    })

    it("[browser-utils/2.3] 入れ子の要求では、最初に保存した位置が保たれ、外側の解除まで固定が続く", async () => {
        const { acquireScrollLock, releaseScrollLock } =
            await import("@/util/scrollLock")
        const { style, scrollTo } = stubDom(300)
        acquireScrollLock()
        // 固定後は window.scrollY が 0 になるため、内側の要求が位置を上書きしないことを確認する
        vi.stubGlobal("window", { scrollY: 0, scrollTo })
        acquireScrollLock()
        releaseScrollLock()
        expect(style.position).toBe("fixed")
        releaseScrollLock()
        expect(style.position).toBe("")
        expect(scrollTo).toHaveBeenCalledWith(0, 300)
    })
})

/**
 * Markdown 内の mermaid ブロックの取り出し・構文検査・自動修正を検査する。
 */
import { JSDOM } from "jsdom"
import { beforeAll, describe, expect, it } from "vitest"
import {
    checkMarkdown,
    extractMermaidBlocks,
    fixMarkdown,
} from "../../../scripts/git/check-mermaid.mjs"

type Mermaid = { parse: (source: string) => Promise<unknown> }
let mermaid: Mermaid

beforeAll(async () => {
    const dom = new JSDOM("<!doctype html><body></body>")
    Object.assign(globalThis, {
        window: dom.window,
        document: dom.window.document,
    })
    mermaid = (await import("mermaid")).default as Mermaid
})

const fence = (body: string) => "```mermaid\n" + body + "\n```\n"

describe("extractMermaidBlocks", () => {
    it("reports the opening fence line of each block", () => {
        const blocks = extractMermaidBlocks(
            "text\n\n" +
                fence("flowchart LR\n A-->B") +
                "\n" +
                fence("graph TD\n C-->D"),
        )
        expect(blocks.map(block => block.line)).toEqual([3, 8])
    })

    it("ignores code fences of other languages", () => {
        expect(extractMermaidBlocks("```yaml\na: b\n```\n")).toEqual([])
    })

    it("flags an unclosed fence", () => {
        const blocks = extractMermaidBlocks(
            "```mermaid\nflowchart LR\n A-->B\n",
        )
        expect(blocks[0]?.unclosed).toBe(true)
    })
})

describe("checkMarkdown", () => {
    it("accepts a valid diagram", async () => {
        expect(
            await checkMarkdown(mermaid, fence("flowchart LR\n A-->B")),
        ).toEqual([])
    })

    it("reports the line of an invalid diagram", async () => {
        const errors = await checkMarkdown(
            mermaid,
            "intro\n" + fence("flowchart LR\n A[x (y)] --> B"),
        )
        expect(errors.map(error => error.line)).toEqual([2])
    })
})

describe("fixMarkdown", () => {
    it("quotes labels that contain symbols so the diagram parses", async () => {
        const source = fence(
            "flowchart LR\n A[run (x)] -- release/** --> B{a/b}",
        )
        const fixed = await fixMarkdown(mermaid, source)
        expect(fixed).toContain('A["run (x)"]')
        expect(await checkMarkdown(mermaid, fixed)).toEqual([])
    })

    it("leaves a valid diagram unchanged", async () => {
        const source = fence("flowchart LR\n A-->B")
        expect(await fixMarkdown(mermaid, source)).toBe(source)
    })

    it("leaves a diagram it cannot repair unchanged", async () => {
        const source = fence("flowchart LR\n A --> --> B")
        expect(await fixMarkdown(mermaid, source)).toBe(source)
    })
})

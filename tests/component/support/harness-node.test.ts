/**
 * Verifies that component tests without a DOM annotation use the Node environment.
 */
import { describe, expect, it } from "vitest"

describe("component harness (node)", () => {
    it("runs without a DOM by default", () => {
        expect(typeof document).toBe("undefined")
    })
})

/**
 * Cleans up the DOM after each component test.
 */
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => {
    cleanup()
})

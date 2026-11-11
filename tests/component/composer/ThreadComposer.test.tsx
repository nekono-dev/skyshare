/**
 * Verifies thread composer rendering and interactions.
 */
// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// Failed API responses are sufficient because these tests cover rendering and local interactions.
vi.mock("@/client/openapi/client", () => {
  const failed = async () => ({ status: 404, data: {} })
  return new Proxy(
    {},
    { get: (_target, name) => (name === "then" ? undefined : failed) },
  )
})

import ThreadComposer from "@/components/composer/ThreadComposer"

const ADD_LABEL = "Add to thread"
const REMOVE_LABEL = "Delete this segment"

const bodies = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("[contenteditable]"))

describe("ThreadComposer rendering and interactions", () => {
  it("starts with one empty input, disables posting, and hides removal for the first segment", () => {
    const { container } = render(<ThreadComposer variant="page" />)

    expect(bodies(container)).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Post" })).toHaveProperty(
      "disabled",
      true,
    )
    expect(screen.queryByRole("button", { name: REMOVE_LABEL })).toBeNull()
  })

  it("adds inputs and allows removing inactive segments after the first", () => {
    const { container } = render(<ThreadComposer variant="page" />)

    fireEvent.click(screen.getByRole("button", { name: ADD_LABEL }))
    fireEvent.click(screen.getByRole("button", { name: ADD_LABEL }))
    expect(bodies(container)).toHaveLength(3)

    // Active segments have no summary, so removal is available only on inactive segments after the first.
    fireEvent.click(screen.getByRole("button", { name: REMOVE_LABEL }))
    expect(bodies(container)).toHaveLength(2)
  })

  it("shows an error and preserves the text when submission fails", async () => {
    const { container } = render(<ThreadComposer variant="page" />)
    const [body] = bodies(container)
    body.textContent = "本文"
    fireEvent.input(body)

    fireEvent.submit(container.querySelector("form") as HTMLFormElement)

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).not.toBe(""),
    )
    expect(bodies(container)[0].textContent).toBe("本文")
  })
})

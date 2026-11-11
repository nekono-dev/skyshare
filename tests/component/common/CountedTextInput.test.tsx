/**
 * Verifies value updates and character count display for the counted text input.
 */
// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import CountedTextInput from "@/components/common/input/CountedTextInput"

const counters = [
  {
    key: "chars",
    label: "文字",
    count: (text: string) => text.length,
    maxAssumed: 10,
  },
]

/** Minimal controlled input harness used by these tests. */
const Harness = ({ onChange }: { onChange: (next: string) => void }) => {
  const [value, setValue] = useState("")
  return (
    <CountedTextInput
      value={value}
      onChange={next => {
        setValue(next)
        onChange(next)
      }}
      multiline
      counters={counters}
      placeholder="本文"
    />
  )
}

describe("CountedTextInput", () => {
  it("reports each typed value to the parent", () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText("本文"), {
      target: { value: "abc" },
    })
    expect(onChange).toHaveBeenLastCalledWith("abc")
  })

  it("shows the count of the current text", () => {
    render(<Harness onChange={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText("本文"), {
      target: { value: "abcd" },
    })
    expect(screen.getByText(/4/)).toBeTruthy()
  })

  it("starts each render with an empty input after cleanup from the previous test", () => {
    render(<Harness onChange={() => {}} />)
    expect(
      (screen.getByPlaceholderText("本文") as HTMLTextAreaElement).value,
    ).toBe("")
  })
})

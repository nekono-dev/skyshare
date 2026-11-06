// @vitest-environment happy-dom
// 文字数カウンタ付きの入力（component 層・要件 1.4）: 入力の伝達と、カウンタの表示
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

/** 親の状態を持つ最小の利用例（実際の利用と同じく、onChange で値を更新する） */
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

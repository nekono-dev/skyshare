// @vitest-environment happy-dom
// component 層の基盤の確認: happy-dom のファイルは DOM を使え、テスト後に片付けられる
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

const Probe = () => <p>probe</p>

describe("component harness (dom)", () => {
  it("renders into a DOM", () => {
    render(<Probe />)
    expect(screen.getByText("probe")).toBeTruthy()
  })

  it("starts each test with an empty document", () => {
    expect(document.body.textContent).toBe("")
  })
})

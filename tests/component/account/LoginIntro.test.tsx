/**
 * ログイン案内に公開アンケート結果へのリンクを出し分ける。
 */
// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import LoginIntro from "@/components/account/LoginIntro"
import { setLocaleSetting } from "@/lib/i18n/store"

beforeEach(() => setLocaleSetting("ja"))
afterEach(() => {
  cleanup()
  setLocaleSetting("ja")
})

describe("LoginIntro", () => {
  it("shows the survey results sentence and link when enabled", () => {
    render(<LoginIntro showSurveyResults />)

    expect(
      screen.getByRole("link", { name: "こちら" }).getAttribute("href"),
    ).toBe("/surveys/")
    expect(screen.getByText(/ログイン時のアンケートの結果は/)).toBeTruthy()
  })

  it("omits the survey results sentence and link when disabled", () => {
    render(<LoginIntro showSurveyResults={false} />)

    expect(screen.queryByRole("link", { name: "こちら" })).toBeNull()
    expect(screen.queryByText(/ログイン時のアンケートの結果は/)).toBeNull()
  })
})

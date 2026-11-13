/**
 * 選択肢の割合バーの表示とトークン利用を確認する。
 */
// @vitest-environment happy-dom
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import PercentBar from "@/components/survey/SurveyResults/SurveyResultCard/PercentBar"

const renderBar = (props: {
  label: string
  percent: number
  highlight: boolean
}) => render(<PercentBar {...props} />)

describe("PercentBar", () => {
  it("highlights the maximum option and sizes its fill to the percentage", () => {
    const { container } = renderBar({
      label: "選択肢 A",
      percent: 42.5,
      highlight: true,
    })
    const meter = screen.getByRole("meter", { name: "選択肢 A" })
    const fill = container.querySelector('[data-top="true"]') as HTMLElement

    expect(fill).toBeTruthy()
    expect(fill.style.width).toBe("42.5%")
    expect(screen.getByText("42.5%")).toBeTruthy()
    expect(meter.getAttribute("aria-valuemin")).toBe("0")
    expect(meter.getAttribute("aria-valuemax")).toBe("100")
    expect(meter.getAttribute("aria-valuenow")).toBe("42.5")
  })

  it("shows a non-highlighted percentage in a gray fill", () => {
    const { container } = renderBar({
      label: "選択肢 B",
      percent: 25,
      highlight: false,
    })

    expect(container.querySelector('[data-top="false"]')).toBeTruthy()
    expect(screen.getByText("25%")).toBeTruthy()
  })

  it("does not draw a fill for zero and keeps the number on the track", () => {
    const { container } = renderBar({
      label: "選択肢 C",
      percent: 0,
      highlight: false,
    })
    const meter = screen.getByRole("meter", { name: "選択肢 C" })

    expect(container.querySelector("[data-top]")).toBeNull()
    expect(screen.getByText("0%")).toBeTruthy()
    expect(meter.getAttribute("aria-valuenow")).toBe("0")
  })

  it("uses only variables defined by the shared token file and no literal colors", () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        "src/components/survey/SurveyResults/SurveyResultCard/PercentBar/index.module.css",
      ),
      "utf8",
    )
    const tokens = readFileSync(
      resolve(process.cwd(), "src/styles/tokens.css"),
      "utf8",
    )
    const usedTokens = [...css.matchAll(/var\(--([\w-]+)/g)].map(
      match => `--${match[1]}`,
    )
    const definedTokens = new Set(
      [...tokens.matchAll(/--([\w-]+)\s*:/g)].map(match => `--${match[1]}`),
    )

    expect(usedTokens.length).toBeGreaterThan(0)
    expect(usedTokens.every(token => definedTokens.has(token))).toBe(true)
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/i)
  })

  it("makes the number of the highlighted bar large and bold so white on the brand blue meets the large-text contrast", () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        "src/components/survey/SurveyResults/SurveyResultCard/PercentBar/index.module.css",
      ),
      "utf8",
    )
    const rule = /\.fill\[data-top="true"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? ""
    const size = /font-size:\s*([\d.]+)rem/.exec(rule)?.[1]
    const weight = /font-weight:\s*(\d+)/.exec(rule)?.[1]

    // 大きな太字の基準は 14pt（約 18.7px = 1.1667rem）以上の太字
    expect(Number(size)).toBeGreaterThanOrEqual(1.1667)
    expect(Number(weight)).toBeGreaterThanOrEqual(700)
  })

  it("keeps the minimum bar width wide enough for the widest number at the highlighted size", () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        "src/components/survey/SurveyResults/SurveyResultCard/PercentBar/index.module.css",
      ),
      "utf8",
    )
    const fillRule = /\.fill\s*\{([^}]*)\}/.exec(css)?.[1] ?? ""
    const minWidth = Number(/min-width:\s*([\d.]+)rem/.exec(fillRule)?.[1])
    const fontSize = Number(
      /font-size:\s*([\d.]+)rem/.exec(
        /\.fill\[data-top="true"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "",
      )?.[1],
    )
    // 太字の字幅の概算（em）: 数字 0.556、% 0.889、小数点 0.278。最も広い表記は 2 桁 + 小数 1 桁 + %
    const widest = (3 * 0.556 + 0.278 + 0.889) * fontSize

    expect(Number.isFinite(minWidth)).toBe(true)
    expect(minWidth).toBeGreaterThanOrEqual(widest)
  })
})

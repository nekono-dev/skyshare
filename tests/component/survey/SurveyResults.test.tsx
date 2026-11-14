/**
 * 公開アンケート結果の一覧とカードの表示を確認する。
 */
// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import SurveyResults from "@/components/survey/SurveyResults"
import { setLocaleSetting } from "@/lib/i18n/store"
import type { SurveyResult } from "@/lib/survey/results/schema"

const surveys: (SurveyResult & { title: string; description: string })[] = [
  {
    schemaVersion: 1,
    id: "newer",
    title: "Hidden survey title",
    description: "Hidden survey description",
    opensAt: "2026-09-01T00:00:00+09:00",
    closesAt: "2026-10-01T00:00:00+09:00",
    questions: [
      {
        id: "question-tie",
        kind: "multiple",
        title: { ja: "好きな色", en: "Favorite color" },
        options: [
          { id: "blue", label: { ja: "青", en: "Blue" }, percent: 50 },
          { id: "red", label: { ja: "赤", en: "Red" }, percent: 50 },
          { id: "green", label: { ja: "緑", en: "Green" }, percent: 10 },
        ],
      },
      {
        id: "question-zero",
        kind: "single",
        title: { ja: "好きな季節", en: "Favorite season" },
        options: [
          { id: "spring", label: { ja: "春", en: "Spring" }, percent: 0 },
          { id: "summer", label: { ja: "夏", en: "Summer" }, percent: 0 },
        ],
      },
    ],
  },
  {
    schemaVersion: 1,
    id: "older",
    title: "Older hidden title",
    description: "Older hidden description",
    opensAt: "2025-08-01T00:00:00Z",
    closesAt: "2025-08-15T00:00:00Z",
    questions: [
      {
        id: "older-question",
        kind: "single",
        title: { ja: "古い質問", en: "Older question" },
        options: [
          {
            id: "older-option",
            label: { ja: "古い選択肢", en: "Older option" },
            percent: 100,
          },
        ],
      },
    ],
  },
]

beforeEach(() => {
  setLocaleSetting("ja")
})

afterEach(() => {
  cleanup()
  setLocaleSetting("ja")
})

describe("SurveyResults", () => {
  it("renders the heading, periods, localized question rows, and tied maximum markers", () => {
    const { container } = render(<SurveyResults surveys={surveys} />)
    const heading = screen.getByRole("heading", { name: "アンケートの結果" })
    const cards = container.querySelectorAll("article")
    const meters = screen.getAllByRole("meter")

    expect(heading).toBeTruthy()
    expect(cards).toHaveLength(2)
    expect(screen.getByText("2026/09/01 〜 09/30")).toBeTruthy()
    expect(screen.getByText("2025/08/01 〜 08/14")).toBeTruthy()
    expect((cards[0] as HTMLElement).textContent).toContain(
      "2026/09/01 〜 09/30",
    )
    expect((cards[1] as HTMLElement).textContent).toContain(
      "2025/08/01 〜 08/14",
    )
    expect(screen.getByRole("heading", { name: "好きな色" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "好きな季節" })).toBeTruthy()
    expect(screen.getByText("青")).toBeTruthy()
    expect(screen.getByText("赤")).toBeTruthy()
    expect(screen.getAllByText("50%")).toHaveLength(2)
    expect(meters.map(meter => meter.getAttribute("aria-label"))).toEqual([
      "青",
      "赤",
      "緑",
      "春",
      "夏",
      "古い選択肢",
    ])
    expect(container.querySelectorAll('[data-top="true"]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-top="false"]')).toHaveLength(1)
    expect(
      screen
        .getByRole("heading", { name: "好きな季節" })
        .closest("section")
        ?.querySelector('[data-top="true"]'),
    ).toBeNull()
    expect(
      within(cards[0] as HTMLElement).getByText("2026/09/01 〜 09/30"),
    ).toBeTruthy()
  })

  it("omits survey titles, descriptions, counts, and multiple-choice notes", () => {
    const { container } = render(<SurveyResults surveys={surveys} />)
    const text = container.textContent ?? ""

    expect(text).not.toContain("newer")
    expect(text).not.toContain("Hidden survey title")
    expect(text).not.toContain("Hidden survey description")
    expect(text).not.toContain("Older hidden title")
    expect(text).not.toContain("Older hidden description")
    expect(text).not.toContain("respondent")
    expect(text).not.toContain("回答者")
    expect(text).not.toContain("複数選択")
    expect(text).not.toContain("multiple choice")
    expect(text).not.toContain("件")
  })

  it("switches display language without remounting", () => {
    const { container } = render(<SurveyResults surveys={surveys} />)
    const originalCard = container.querySelector("article")

    act(() => setLocaleSetting("en"))

    expect(screen.getByRole("heading", { name: "Survey results" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Favorite color" })).toBeTruthy()
    expect(screen.getByText("Blue")).toBeTruthy()
    expect(screen.getByText("2026/09/01 – 09/30")).toBeTruthy()
    expect(container.querySelector("article")).toBe(originalCard)
  })

  it("keeps every question heading id unique and referenced by its own section even when survey and question ids would concatenate to the same string", () => {
    const question = (id: string, ja: string, en: string) => ({
      id,
      kind: "single" as const,
      title: { ja, en },
      options: [{ id: "x", label: { ja: "選択", en: "Choice" }, percent: 10 }],
    })
    const colliding: SurveyResult[] = [
      {
        schemaVersion: 1,
        id: "a",
        opensAt: "2026-09-01T00:00:00+09:00",
        closesAt: "2026-10-01T00:00:00+09:00",
        questions: [question("b-question-c", "質問その一", "Question one")],
      },
      {
        schemaVersion: 1,
        id: "a-question-b",
        opensAt: "2026-08-01T00:00:00+09:00",
        closesAt: "2026-09-01T00:00:00+09:00",
        questions: [question("c", "質問その二", "Question two")],
      },
    ]
    const { container } = render(<SurveyResults surveys={colliding} />)

    const headings = [...container.querySelectorAll("section h2")]
    const ids = headings.map(heading => heading.id)

    expect(headings).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    for (const section of container.querySelectorAll("section")) {
      const heading = section.querySelector("h2")!
      expect(section.getAttribute("aria-labelledby")).toBe(heading.id)
    }
  })
})

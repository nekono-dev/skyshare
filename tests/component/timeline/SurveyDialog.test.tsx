/**
 * アンケートダイアログの固定見出しと質問文の表示を検証する。
 */
// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SurveyDialogBody } from "@/components/timeline/Timeline/SurveyGate/SurveyDialog"
import { createTranslator } from "@/lib/i18n/translate"
import type { Survey } from "@/lib/survey/definition"

const survey = {
  id: "survey-dialog-test",
  opensAt: "2026-11-01T00:00:00Z",
  closesAt: "2026-12-01T00:00:00Z",
  questions: [
    {
      id: "question",
      kind: "single",
      title: { ja: "質問の見出し", en: "Question heading" },
      options: [
        { id: "yes", label: { ja: "はい", en: "Yes" } },
        { id: "no", label: { ja: "いいえ", en: "No" } },
      ],
    },
  ],
} satisfies Survey

describe("SurveyDialogBody", () => {
  it.each([
    ["ja", "アンケートにご協力ください", "質問の見出し"],
    ["en", "Please help with our survey", "Question heading"],
  ] as const)(
    "shows fixed copy and question titles in %s",
    (locale, heading, question) => {
      const translator = createTranslator(locale)
      render(
        <SurveyDialogBody
          survey={survey}
          draft={{}}
          locale={locale}
          t={translator.t}
          raw={translator.raw}
          titleId="survey-title"
          busy={false}
          failed={false}
          action={{ kind: "incomplete" }}
          onSelect={() => {}}
          onAction={() => {}}
        />,
      )

      expect(screen.getByRole("heading", { name: heading })).toBeTruthy()
      expect(screen.getByText(question)).toBeTruthy()
      expect(
        screen.getByRole("dialog").firstElementChild?.querySelector("p"),
      ).toBeNull()
      expect(screen.queryByText("ご協力ください")).toBeNull()
      expect(screen.queryByText("Please help us")).toBeNull()
    },
  )

  it.each([
    ["ja", "プライバシーポリシー"],
    ["en", "Privacy Policy"],
  ] as const)(
    "links the privacy policy text in the irreversible notice in %s",
    (locale, linkText) => {
      const translator = createTranslator(locale)
      render(
        <SurveyDialogBody
          survey={survey}
          draft={{}}
          locale={locale}
          t={translator.t}
          raw={translator.raw}
          titleId="survey-title"
          busy={false}
          failed={false}
          action={{ kind: "incomplete" }}
          onSelect={() => {}}
          onAction={() => {}}
        />,
      )

      const link = screen.getByRole("link", { name: linkText })
      expect(link.getAttribute("href")).toBe("/privacy/")
      expect(link.getAttribute("target")).toBe("_blank")
      expect(link.getAttribute("rel")).toBe("noreferrer")
      expect(link.closest("p")?.textContent).toContain(linkText)
    },
  )
})

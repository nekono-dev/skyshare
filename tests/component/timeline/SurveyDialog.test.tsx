/**
 * アンケートダイアログの固定見出しと質問文の表示を検証する。
 */
// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
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
    ["ja", "アンケートへのご協力ありがとうございます", "質問の見出し"],
    ["en", "Thank you for helping with our survey", "Question heading"],
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
          onDismiss={() => {}}
        />,
      )

      expect(screen.getByRole("heading", { name: heading })).toBeTruthy()
      expect(screen.getByText(question)).toBeTruthy()
      expect(
        screen.getByRole("dialog").firstElementChild?.querySelector("p"),
      ).toBeNull()
    },
  )

  it.each([
    ["ja", "プライバシーポリシー"],
    ["en", "Privacy Policy"],
  ] as const)(
    "links the privacy policy text in the privacy notice in %s",
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
          onDismiss={() => {}}
        />,
      )

      const link = screen.getByRole("link", { name: linkText })
      expect(link.getAttribute("href")).toBe("/privacy/")
      expect(link.getAttribute("target")).toBe("_blank")
      expect(link.getAttribute("rel")).toBe("noreferrer")
      expect(link.closest("p")?.textContent).toContain(linkText)
    },
  )

  it.each([
    ["ja", "回答期限: 11/30 まで"],
    ["en", "Respond by 2026/12/01 0:00 (JST)"],
  ] as const)("shows the deadline in %s", (locale, text) => {
    const translator = createTranslator(locale)
    render(
      <SurveyDialogBody
        survey={{ ...survey, closesAt: "2026-12-01T00:00:00+09:00" }}
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
        onDismiss={() => {}}
      />,
    )

    expect(screen.getByText(text)).toBeTruthy()
  })

  it("notifies a dismissal on a backdrop click and on Escape, not on a card click", () => {
    const translator = createTranslator("ja")
    const onDismiss = vi.fn()
    render(
      <SurveyDialogBody
        survey={survey}
        draft={{}}
        locale="ja"
        t={translator.t}
        raw={translator.raw}
        titleId="survey-title"
        busy={false}
        failed={false}
        action={{ kind: "incomplete" }}
        onSelect={() => {}}
        onAction={() => {}}
        onDismiss={onDismiss}
      />,
    )

    const dialog = screen.getByRole("dialog")
    fireEvent.mouseDown(dialog)
    fireEvent.mouseUp(dialog)
    expect(onDismiss).not.toHaveBeenCalled()

    const backdrop = screen.getByRole("presentation")
    fireEvent.mouseDown(backdrop)
    fireEvent.mouseUp(backdrop)
    expect(onDismiss).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: "Escape" })
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })
})

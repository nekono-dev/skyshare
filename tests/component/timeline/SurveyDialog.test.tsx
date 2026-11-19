/**
 * アンケートダイアログの固定見出しと質問文の表示を検証する。
 */
// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  SurveyDialog,
  SurveyDialogBody,
} from "@/components/timeline/Timeline/SurveyGate/SurveyDialog"
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
      // flex の箱の直下に文と a を並べると別々の列になるため、1 つの要素にまとめる
      expect(link.closest("p")?.children).toHaveLength(1)
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

  it("offers a decline button that uses dismissal and keeps submit labeled consistently", () => {
    const translator = createTranslator("ja")
    const onDismiss = vi.fn()
    const onAction = vi.fn()
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
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    )

    expect(screen.getByRole("button", { name: "送信する" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "回答しない" }))
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onAction).not.toHaveBeenCalled()
  })

  it("disables the decline button while busy", () => {
    const translator = createTranslator("ja")
    render(
      <SurveyDialogBody
        survey={survey}
        draft={{ question: ["yes"] }}
        locale="ja"
        t={translator.t}
        raw={translator.raw}
        titleId="survey-title"
        busy
        failed={false}
        action={{ kind: "submit", answers: { question: "yes" } }}
        onSelect={() => {}}
        onAction={() => {}}
        onDismiss={() => {}}
      />,
    )

    expect(
      screen
        .getByRole("button", { name: "回答しない" })
        .hasAttribute("disabled"),
    ).toBe(true)
    expect(screen.getByRole("button", { name: "送信する" }).textContent).toBe(
      "送信する",
    )
  })
})

describe("SurveyDialog", () => {
  it.each([true, false])(
    "handles backdrop, Escape, and decline according to busy=%s",
    busy => {
      const onDecline = vi.fn()
      const renderDialog = () =>
        render(
          <SurveyDialog
            survey={survey}
            busy={busy}
            failed={false}
            onSubmit={() => {}}
            onDecline={onDecline}
          />,
        )

      const trigger = (action: "backdrop" | "escape" | "button") => {
        const view = renderDialog()
        if (action === "backdrop") {
          const backdrop = screen.getByRole("presentation")
          fireEvent.mouseDown(backdrop)
          fireEvent.mouseUp(backdrop)
        } else if (action === "escape") {
          fireEvent.keyDown(document, { key: "Escape" })
        } else {
          // 表示言語は環境で決まるため、どちらの言語の名前でも探す
          fireEvent.click(
            screen.getByRole("button", {
              name: /^(回答しない|Prefer not to answer)$/,
            }),
          )
        }
        expect(onDecline).toHaveBeenCalledTimes(busy ? 0 : 1)
        view.unmount()
        onDecline.mockClear()
      }

      trigger("backdrop")
      trigger("escape")
      trigger("button")
    },
  )
})

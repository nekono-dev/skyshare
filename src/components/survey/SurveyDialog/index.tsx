/**
 * SurveyDialog（回答必須のアンケートダイアログ）。
 *
 * 責務と処理概要:
 * - 検証済みのアンケートを `Overlay` の上に `role="dialog"` のカードとして描画する。
 * - 選択状態（`SurveyDraft`）を内部に持ち、部品から受けた選択を `answerDraft` の規則で補正して保持する。
 *   言語の切り替えでは再マウントしないため、選択は保たれる。
 * - 送信の操作は、「回答しない」を含む間は「閉じる」（`onDecline`）、完了していれば送信（`onSubmit`）、
 *   未完了の間は押せない。送信中は質問と操作をすべて押せなくする。
 * - 背景クリック・Esc では閉じない（`Overlay` の `onClose` は何もしない）。
 * - 固定の文言は `survey.*` の辞書から、質問・選択肢の文言は設定から、表示言語で取り出す。
 * - 本体（`SurveyDialogBody`）は選択状態を持たず、渡された値だけで描画する（描画の確認を node 環境で行えるようにするため）。
 *
 * 純粋関数の責務:
 * - `applySelectionChange`: 1 問の選択を補正した新しい選択状態を返す（入力の状態は書き換えない）。
 * - `resolveSubmitAction`: 送信の操作が何をするか（未完了・閉じる・送信）を決める。
 */
import React, { useId, useState } from "react"
import ChoiceQuestion from "@/components/common/ChoiceQuestion"
import Overlay from "@/components/common/Overlay"
import { useLocale, useT } from "@/lib/i18n/react"
import type { Locale } from "@/lib/i18n/locale"
import type { Translator } from "@/lib/i18n/translate"
import {
  changeSelection,
  draftHasDecline,
  emptyDraft,
  isDraftComplete,
  questionHasDecline,
  toAnswers,
  type SurveyDraft,
} from "@/lib/survey/answerDraft"
import { localize, type Survey } from "@/lib/survey/definition"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/** 送信の操作が何をするかの判定結果 */
export type SurveySubmitAction =
  /** 未完了。送信の操作は押せない */
  | { kind: "incomplete" }
  /** 「回答しない」を含む。送信せず閉じる */
  | { kind: "decline" }
  /** 完了。送信の回答を通知する */
  | { kind: "submit"; answers: Record<string, string | string[]> }

/**
 * 1 問の選択を、質問の規則で補正した新しい選択状態を返す。
 *
 * Input:
 * - `survey`: 検証済みのアンケート
 * - `draft`: 現在の選択状態
 * - `questionId`: 変更された質問の識別子
 * - `next`: 部品から受けた次の選択
 *
 * Output:
 * - 補正後の新しい選択状態。質問が見つからないときは `draft` をそのまま返す。
 *
 * 例: 複数選択で `[x]` の状態に「回答しない」を新たに選ぶと、その 1 件だけの `[none]` になる。
 */
export const applySelectionChange = (
  survey: Survey,
  draft: SurveyDraft,
  questionId: string,
  next: readonly string[],
): SurveyDraft => {
  const question = survey.questions.find(item => item.id === questionId)
  if (!question) return draft
  return {
    ...draft,
    [questionId]: changeSelection(question, draft[questionId] ?? [], next),
  }
}

/**
 * 送信の操作が何をするかを決める。
 *
 * Input:
 * - `survey`: 検証済みのアンケート
 * - `draft`: 現在の選択状態
 *
 * Output:
 * - 「回答しない」を含めば `decline`（未完了でも閉じられる）。
 *   それ以外で完了していれば `submit`（送信本文つき）。未完了なら `incomplete`。
 *
 * 例: 1 問目で「回答しない」を選んだ後は、2 問目が空でも `decline` になる。
 */
export const resolveSubmitAction = (
  survey: Survey,
  draft: SurveyDraft,
): SurveySubmitAction => {
  if (draftHasDecline(survey, draft)) return { kind: "decline" }
  if (!isDraftComplete(survey, draft)) return { kind: "incomplete" }
  return { kind: "submit", answers: toAnswers(survey, draft) }
}

/**
 * 送信の操作を押したときに、判定結果に応じた通知を 1 件だけ行う。
 *
 * Input:
 * - `action`: 送信の操作の判定結果
 * - `busy`: 送信中か。真のときは何も通知しない
 * - `handlers`: 送信（回答を渡す）と辞退（閉じる）の通知
 *
 * Output:
 * - `decline` なら `onDecline` を 1 回。`submit` なら `onSubmit` を回答つきで 1 回。
 *   `incomplete` と送信中は何も呼ばない。
 *
 * 例: `dispatchSubmitAction({ kind: "decline" }, false, handlers)` は `onDecline` だけを呼ぶ。
 */
export const dispatchSubmitAction = (
  action: SurveySubmitAction,
  busy: boolean,
  handlers: {
    onSubmit: (answers: Record<string, string | string[]>) => void
    onDecline: () => void
  },
): void => {
  if (busy) return
  if (action.kind === "decline") handlers.onDecline()
  else if (action.kind === "submit") handlers.onSubmit(action.answers)
}

/** 本体へ渡す値。選択状態と送信の判定は呼び出し側（`SurveyDialog`）が持つ。 */
export type SurveyDialogBodyProps = {
  survey: Survey
  /** 現在の選択状態（質問 ID → 選択中の選択肢 ID） */
  draft: SurveyDraft
  /** 表示言語。アンケートの文言の選択に使う */
  locale: Locale
  /** 固定の文言の翻訳関数 */
  t: Translator["t"]
  /** タイトルの要素の識別子（ダイアログの名前に使う） */
  titleId: string
  /** 送信中。質問と操作を押せなくする */
  busy: boolean
  /** 直近の送信が失敗したか。真なら失敗の文言を示す */
  failed: boolean
  /** 送信の操作の判定結果 */
  action: SurveySubmitAction
  /** 質問の選択が変わったときの通知 */
  onSelect: (questionId: string, next: string[]) => void
  /** 送信の操作を押したときの通知（判定結果に応じて閉じる・送信する） */
  onAction: () => void
}

/** 背景・Esc で閉じないための Overlay の閉じる処理。何もしない。 */
const ignoreClose = () => {}

/**
 * アンケートダイアログの見た目を描画する（選択状態は持たない）。
 *
 * Input: `SurveyDialogBodyProps`
 * Output: 背景（閉じない）の上にタイトル付きのカードを描画する。送信の操作は末尾に置き、
 *   取り消せない旨と案内は送信の操作の直前に示す。
 *
 * 例: `action.kind === "decline"` のときは「閉じる」の操作になり、`onAction` を呼ぶ。
 */
export const SurveyDialogBody: React.FC<SurveyDialogBodyProps> = ({
  survey,
  draft,
  locale,
  t,
  titleId,
  busy,
  failed,
  action,
  onSelect,
  onAction,
}) => {
  const declined = action.kind === "decline"
  const description = survey.description
  const actionLabel = declined ? t("survey.close") : t("survey.submit")
  const hint =
    action.kind === "decline"
      ? t("survey.declineHint")
      : action.kind === "incomplete"
        ? t("survey.incomplete")
        : null

  return (
    <Overlay open onClose={ignoreClose} contentClassName={ui["width-md"]}>
      <div
        className={`${ui["base-card"]} ${ui["dialog-card"]} ${styles["card"]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles["scroll"]}>
          <h2 id={titleId} className={ui.subject}>
            {localize(survey.title, locale)}
          </h2>
          {description ? (
            <p className={ui.text}>{localize(description, locale)}</p>
          ) : null}
          {survey.questions.map(question => (
            <ChoiceQuestion
              key={question.id}
              kind={question.kind}
              legend={localize(question.title, locale)}
              choices={question.options.map(option => ({
                id: option.id,
                label: localize(option.label, locale),
              }))}
              selectedIds={draft[question.id] ?? []}
              maxSelect={
                question.kind === "multiple" &&
                !questionHasDecline(question, draft)
                  ? question.maxSelect
                  : undefined
              }
              disabled={busy}
              onChange={next => onSelect(question.id, next)}
              className={styles["question"]}
            />
          ))}
        </div>
        <div className={styles["footer"]}>
          <p className={ui.text}>{t("survey.irreversible")}</p>
          {hint ? <p className={ui.text}>{hint}</p> : null}
          {failed ? (
            <p role="alert" className={styles["error"]}>
              {t("survey.submitFailed")}
            </p>
          ) : null}
          <div className={ui["dialog-actions"]}>
            <button
              type="button"
              className={`${ui["base-button"]} ${ui["text-button"]} ${declined ? ui["gray-button"] : ui["blue-button"]}`}
              disabled={busy || action.kind === "incomplete"}
              onClick={onAction}
            >
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  )
}

export type SurveyDialogProps = {
  survey: Survey
  /** 送信中。質問と操作を押せなくする */
  busy: boolean
  /** 直近の送信が失敗したか。真なら失敗の文言を示す */
  failed: boolean
  /** 完了した回答を通知する（送信本文は単一が文字列、複数が配列） */
  onSubmit: (answers: Record<string, string | string[]>) => void
  /** 「回答しない」を含む状態の閉じる操作 */
  onDecline: () => void
}

/**
 * 回答必須のアンケートダイアログ。選択状態を持ち、送信・辞退を通知する。
 *
 * Input: `SurveyDialogProps`（検証済みのアンケート・送信中・失敗・通知の関数）
 * Output: `SurveyDialogBody` に選択状態と通知を結びつけて描画する
 *
 * 例: `<SurveyDialog survey={survey} busy={false} failed={false} onSubmit={save} onDecline={close} />`
 */
export const SurveyDialog: React.FC<SurveyDialogProps> = ({
  survey,
  busy,
  failed,
  onSubmit,
  onDecline,
}) => {
  const locale = useLocale()
  const { t } = useT()
  const titleId = useId()
  const [draft, setDraft] = useState<SurveyDraft>(() => emptyDraft(survey))
  const action = resolveSubmitAction(survey, draft)

  const handleSelect = (questionId: string, next: string[]) => {
    setDraft(prev => applySelectionChange(survey, prev, questionId, next))
  }

  const handleAction = () => {
    dispatchSubmitAction(action, busy, { onSubmit, onDecline })
  }

  return (
    <SurveyDialogBody
      survey={survey}
      draft={draft}
      locale={locale}
      t={t}
      titleId={titleId}
      busy={busy}
      failed={failed}
      action={action}
      onSelect={handleSelect}
      onAction={handleAction}
    />
  )
}

export default SurveyDialog

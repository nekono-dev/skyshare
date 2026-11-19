/**
 * アンケートの選択状態を管理し、質問と回答・辞退の操作をダイアログとして表示する。
 * 言語を切り替えても選択を保ち、背景クリック・Esc・ボタンで辞退できる。
 */
import React, { useId, useState } from "react"
import ChoiceQuestion from "@/components/common/select/ChoiceQuestion"
import Overlay from "@/components/common/dialog/Overlay"
import { renderSlots } from "@/components/i18n/renderSlots"
import { useLocale, useT } from "@/components/i18n/useTranslation"
import type { Locale } from "@/lib/i18n/locale"
import type { Translator } from "@/lib/i18n/translate"
import {
  emptyDraft,
  isDraftComplete,
  toAnswers,
  type SurveyDraft,
} from "@/lib/survey/answerDraft"
import { localize, type Survey } from "@/lib/survey/definition"
import { formatSurveyDeadline } from "@/lib/survey/publicResults/presentation"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/** 送信の操作が何をするかの判定結果 */
export type SurveySubmitAction =
  /** 未完了。送信の操作は押せない */
  | { kind: "incomplete" }
  /** 完了。送信の回答を通知する */
  | { kind: "submit"; answers: Record<string, string | string[]> }

/**
 * 1 問の選択を反映した新しい選択状態を返す。
 *
 * Input:
 * - `survey`: 検証済みのアンケート
 * - `draft`: 現在の選択状態
 * - `questionId`: 変更された質問の識別子
 * - `next`: 部品から受けた次の選択
 *
 * Output:
 * - 反映後の新しい選択状態。質問が見つからないときは `draft` をそのまま返す。
 *
 * 例: 複数選択で `[x]` の状態から `[x,y]` を選ぶと、その選択を反映する。
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
    [questionId]: [...next],
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
 * - すべて回答済みなら `submit`（送信本文つき）。未完了なら `incomplete`。
 *
 * 例: 1 問目だけ選択済みで2問目が空なら `incomplete` になる。
 */
export const resolveSubmitAction = (
  survey: Survey,
  draft: SurveyDraft,
): SurveySubmitAction => {
  if (!isDraftComplete(survey, draft)) return { kind: "incomplete" }
  return { kind: "submit", answers: toAnswers(survey, draft) }
}

/**
 * 送信の操作を押したときに、判定結果に応じた通知を 1 件だけ行う。
 *
 * Input:
 * - `action`: 送信の操作の判定結果
 * - `busy`: 送信中か。真のときは何も通知しない
 * - `handlers`: 送信（回答を渡す）の通知
 *
 * Output:
 * - `submit` なら `onSubmit` を回答つきで 1 回。
 *   `incomplete` と送信中は何も呼ばない。
 *
 * 例: 完了した回答の操作は `onSubmit` を 1 回呼ぶ。
 */
export const dispatchSubmitAction = (
  action: SurveySubmitAction,
  busy: boolean,
  handlers: {
    onSubmit: (answers: Record<string, string | string[]>) => void
  },
): void => {
  if (busy) return
  if (action.kind === "submit") handlers.onSubmit(action.answers)
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
  /** プレースホルダ未置換の文言（リンクを文中に差し込む文言に使う） */
  raw: Translator["raw"]
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
  /** 有効な回答を送信する操作の通知 */
  onAction: () => void
  /** 背景のクリック、Esc、辞退ボタンで閉じようとしたときの通知 */
  onDismiss: () => void
}

/**
 * アンケートダイアログの見た目を描画する（選択状態は持たない）。
 *
 * Input: `SurveyDialogBodyProps`
 * Output: 背景の上にタイトルと回答期限つきのカードを描画する。送信の操作は末尾に置き、
 *   個人情報の取り扱いの案内の後に送信と辞退の操作を示す。
 *
 * 例: 辞退ボタンは `onDismiss` を呼び、送信操作は `onAction` を呼ぶ。
 */
// 選択状態を持たないため、ブラウザ API に依存せず Node 環境でも描画を検証できる。
export const SurveyDialogBody: React.FC<SurveyDialogBodyProps> = ({
  survey,
  draft,
  locale,
  t,
  raw,
  titleId,
  busy,
  failed,
  action,
  onSelect,
  onAction,
  onDismiss,
}) => {
  return (
    <Overlay open onClose={onDismiss} contentClassName={ui["width-md"]}>
      <div
        className={`${ui["base-card"]} ${ui["dialog-card"]} ${styles["card"]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles["head"]}>
          <h2 id={titleId} className={styles["title"]}>
            {t("survey.title")}
          </h2>
          <div className={styles["deadline"]}>
            {t("survey.deadline", {
              date: formatSurveyDeadline(survey.closesAt, locale),
            })}
          </div>
        </div>
        <div className={styles["scroll"]}>
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
                question.kind === "multiple" ? question.maxSelect : undefined
              }
              disabled={busy}
              onChange={next => onSelect(question.id, next)}
              className={styles["question"]}
            />
          ))}
        </div>
        <div className={styles["footer"]}>
          <div className={styles["notes"]}>
            <p className={styles["note"]}>
              {/* flex の箱の直下に文と a を置くと別々の列になり折り返しが崩れるため、1 つの span にまとめる */}
              <span>
                {renderSlots(raw("survey.privacy"), {
                  link: (
                    <a href="/privacy/" target="_blank" rel="noreferrer">
                      {t("privacy.link")}
                    </a>
                  ),
                })}
              </span>
            </p>
          </div>
          {failed ? (
            <p role="alert" className={styles["error"]}>
              {t("survey.submitFailed")}
            </p>
          ) : null}
          <div className={`${ui["dialog-actions"]} ${styles["actions"]}`}>
            <button
              type="button"
              className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
              disabled={busy || action.kind === "incomplete"}
              onClick={onAction}
            >
              {t("survey.submit")}
            </button>
          </div>
          <button
            type="button"
            className={styles["decline"]}
            disabled={busy}
            onClick={onDismiss}
          >
            {t("survey.decline")}
          </button>
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
  /** 回答せずにダイアログを閉じる操作 */
  onDecline: () => void
}

/**
 * アンケートダイアログ。選択状態を持ち、送信・辞退を通知する。
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
  const { t, raw } = useT()
  const titleId = useId()
  const [draft, setDraft] = useState<SurveyDraft>(() => emptyDraft(survey))
  const action = resolveSubmitAction(survey, draft)

  const handleSelect = (questionId: string, next: string[]) => {
    setDraft(prev => applySelectionChange(survey, prev, questionId, next))
  }

  const handleAction = () => {
    dispatchSubmitAction(action, busy, { onSubmit })
  }

  // 背景・Esc・辞退ボタンは共通の通知を使い、送信中は閉じない。
  const handleDismiss = () => {
    if (!busy) onDecline()
  }

  return (
    <SurveyDialogBody
      survey={survey}
      draft={draft}
      locale={locale}
      t={t}
      raw={raw}
      titleId={titleId}
      busy={busy}
      failed={failed}
      action={action}
      onSelect={handleSelect}
      onAction={handleAction}
      onDismiss={handleDismiss}
    />
  )
}

export default SurveyDialog

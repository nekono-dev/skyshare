/**
 * 不具合の報告・新機能の提案のフォーム。
 *
 * 責務と処理概要:
 * - ページを開いたらログイン中のアカウントを確かめ、未ログインならフォームを出さずにログインを案内する。
 * - 種別（不具合・新機能の提案）をラジオボタンで切り替え、種別ごとの入力欄を出し分ける。
 *   送信の仕組みは種別によらず共通（`toFeedbackRequest` → `createFeedback`）。
 * - 文章の入力欄はすべて文字数カウンタ付きの入力欄（`CountedTextInput`）にし、上限は受付と共有する。
 * - ハンドルと環境の情報が自動で収集されて開発者に共有され、GitHub で公開されることを注記し、
 *   送る値を一覧で示す（一覧の値は送信の本文に載る値と同じ）。
 * - 送信に成功したら作成された Issue へのリンクを示して入力を空にし、失敗したら文言を示して入力を残す。
 */
import { useEffect, useState } from "react"
import { createFeedback } from "@/client/openapi/client"
import CountedTextInput, {
  type CounterSpec,
} from "@/components/common/CountedTextInput"
import Loading from "@/components/common/Loading"
import RadioButton from "@/components/common/RadioButton"
import { getSessionOnce } from "@/lib/account/activeAccountSession"
import {
  emptyDraft,
  isDraftSubmittable,
  toFeedbackRequest,
  type FeedbackDraft,
  type FeedbackKind,
} from "@/lib/feedback/feedbackDraft"
import {
  FEEDBACK_LIMITS,
  REPRODUCIBILITY_VALUES,
  countFeedbackLength,
} from "@/lib/feedback/limits"
import { errorMessageKeyFromStatus } from "@/lib/i18n/errorMessage"
import { useT } from "@/lib/i18n/react"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import { buildInfo } from "@/lib/site/buildInfo"
import {
  collectClientEnvironment,
  type ClientEnvironment,
} from "@/util/clientEnvironment"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

/** ログインの確認の状態。ログイン中ならハンドルを持つ */
type Account =
  { state: "loading" } | { state: "guest" } | { state: "ready"; handle: string }

const KINDS: FeedbackKind[] = ["bug", "enhancement"]

/**
 * 失敗した送信のステータスから、表示する文言のキーを選ぶ。
 *
 * Input:
 * - `status`: 受付の API の応答のステータス
 *
 * Output:
 * - 429 は時間を置く旨、503 は受け付けの停止、他は共通の文言のキー
 */
const submitErrorKey = (status: number): PlainMessageKey => {
  if (status === 429) return "feedback.error.rateLimited"
  if (status === 503) return "feedback.error.unavailable"
  return errorMessageKeyFromStatus(status)
}

export const Component = () => {
  const { t } = useT()
  const [account, setAccount] = useState<Account>({ state: "loading" })
  const [environment, setEnvironment] = useState<ClientEnvironment | null>(null)
  const [draft, setDraft] = useState<FeedbackDraft>(() => emptyDraft())
  const [sending, setSending] = useState(false)
  const [errorKey, setErrorKey] = useState<PlainMessageKey | "">("")
  const [created, setCreated] = useState<{
    number: number
    url: string
  } | null>(null)

  // ログイン中のアカウントを確かめる。通信の失敗も未ログインとして案内する
  useEffect(() => {
    let cancelled = false
    getSessionOnce()
      .then(res => {
        if (cancelled) return
        const active =
          res.status === 200
            ? res.data.accounts.find(item => item.isActive)
            : undefined
        setAccount(
          active
            ? { state: "ready", handle: active.handle }
            : { state: "guest" },
        )
      })
      .catch(() => {
        if (!cancelled) setAccount({ state: "guest" })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 送る値の一覧に表示するため、ページを開いた時点で環境の情報を集めておく
  useEffect(() => {
    let cancelled = false
    void collectClientEnvironment(window).then(env => {
      if (!cancelled) setEnvironment(env)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /** 入力の1項目を更新する。入力し直したら前回の結果の表示を消す */
  const update = <K extends keyof FeedbackDraft>(
    key: K,
    value: FeedbackDraft[K],
  ) => {
    setDraft(current => ({ ...current, [key]: value }))
    setCreated(null)
    setErrorKey("")
  }

  /** 件名・本文の欄のカウンタ（書記素で数え、上限を超えたら誤りの色にする） */
  const counter = (max: number): CounterSpec[] => [
    {
      key: "length",
      label: t("feedback.counter"),
      count: text => countFeedbackLength(text),
      maxAssumed: max,
      errorAt: max,
    },
  ]

  /** 送信する。成功したら入力を空にし（種別は残す）、失敗したら入力を残して文言を示す */
  const submit = async () => {
    if (!environment || !isDraftSubmittable(draft)) return
    setSending(true)
    setErrorKey("")
    setCreated(null)
    try {
      const res = await createFeedback(
        toFeedbackRequest(draft, environment, buildInfo),
      )
      if (res.status !== 200) {
        setErrorKey(submitErrorKey(res.status))
        return
      }
      setCreated(res.data)
      setDraft(emptyDraft(draft.kind))
    } catch {
      setErrorKey("error.network")
    } finally {
      setSending(false)
    }
  }

  if (account.state === "loading") return <Loading />

  if (account.state === "guest") {
    return (
      <div
        className={`${ui["base-card"]} ${ui["base-padding"]}`}
        data-testid="feedback-login-required"
      >
        <p className={ui.text}>{t("feedback.loginRequired")}</p>
        <a href="/login/" className={ui.text}>
          {t("feedback.loginLink")}
        </a>
      </div>
    )
  }

  const canSubmit =
    !sending && environment !== null && isDraftSubmittable(draft)
  const collected: { label: string; value: string }[] = [
    { label: t("feedback.collected.account"), value: `@${account.handle}` },
    { label: t("feedback.collected.version"), value: buildInfo.version },
    {
      label: t("feedback.collected.commit"),
      value: buildInfo.commit?.slice(0, 7) ?? "-",
    },
    { label: t("feedback.collected.os"), value: environment?.os ?? "-" },
    {
      label: t("feedback.collected.browser"),
      value: environment?.browser ?? "-",
    },
    {
      label: t("feedback.collected.standalone"),
      value: environment
        ? t(
            environment.standalone
              ? "feedback.collected.yes"
              : "feedback.collected.no",
          )
        : "-",
    },
    {
      label: t("feedback.collected.userAgent"),
      value: environment?.userAgent ?? "-",
    },
  ]

  return (
    <form
      className={styles.form}
      data-testid="feedback-form"
      onSubmit={e => {
        e.preventDefault()
        void submit()
      }}
    >
      <section className={`${ui["base-card"]} ${ui["base-padding"]}`}>
        <p className={ui.text}>{t("feedback.lead")}</p>

        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>{t("feedback.kind.label")}</legend>
          <div className={styles["radio-row"]}>
            {KINDS.map(kind => (
              <RadioButton
                key={kind}
                name="feedback-kind"
                checked={draft.kind === kind}
                label={t(`feedback.kind.${kind}`)}
                disabled={sending}
                onSelect={() => update("kind", kind)}
              />
            ))}
          </div>
        </fieldset>

        <div className={styles.field}>
          <label htmlFor="feedback-title" className={styles.label}>
            {t(`feedback.title.${draft.kind}`)}
          </label>
          <CountedTextInput
            id="feedback-title"
            value={draft.title}
            onChange={next => update("title", next)}
            disabled={sending}
            counters={counter(FEEDBACK_LIMITS.title)}
          />
        </div>

        {draft.kind === "bug" ? (
          <>
            <div className={styles.field}>
              <label htmlFor="feedback-steps" className={styles.label}>
                {t("feedback.steps.label")}
              </label>
              <CountedTextInput
                id="feedback-steps"
                multiline
                autoGrow
                rows={5}
                maxRows={15}
                value={draft.steps}
                onChange={next => update("steps", next)}
                placeholder={t("feedback.steps.placeholder")}
                disabled={sending}
                counters={counter(FEEDBACK_LIMITS.text)}
              />
            </div>
            <fieldset className={styles.fieldset}>
              <legend className={styles.label}>
                {t("feedback.reproducibility.label")}
              </legend>
              <div className={styles["radio-grid"]}>
                {REPRODUCIBILITY_VALUES.map(value => (
                  <RadioButton
                    key={value}
                    name="feedback-reproducibility"
                    checked={draft.reproducibility === value}
                    label={t(`feedback.reproducibility.${value}`)}
                    disabled={sending}
                    onSelect={() => update("reproducibility", value)}
                  />
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <>
            <div className={styles.field}>
              <label htmlFor="feedback-description" className={styles.label}>
                {t("feedback.description.label")}
              </label>
              <CountedTextInput
                id="feedback-description"
                multiline
                autoGrow
                rows={5}
                maxRows={15}
                value={draft.description}
                onChange={next => update("description", next)}
                placeholder={t("feedback.description.placeholder")}
                disabled={sending}
                counters={counter(FEEDBACK_LIMITS.text)}
              />
            </div>
            <div className={styles.field}>
              <label
                htmlFor="feedback-technical-notes"
                className={styles.label}
              >
                {t("feedback.technicalNotes.label")}
              </label>
              <CountedTextInput
                id="feedback-technical-notes"
                multiline
                autoGrow
                rows={3}
                maxRows={15}
                value={draft.technicalNotes}
                onChange={next => update("technicalNotes", next)}
                placeholder={t("feedback.technicalNotes.placeholder")}
                disabled={sending}
                counters={counter(FEEDBACK_LIMITS.text)}
              />
            </div>
          </>
        )}
      </section>

      <section
        className={`${ui["base-card"]} ${ui["base-padding"]} ${styles.notice}`}
        data-testid="feedback-notice"
      >
        <h2 className={ui.subject}>{t("feedback.notice.title")}</h2>
        <p className={ui.text}>{t("feedback.notice.body")}</p>
        <p className={ui.text}>
          <strong>{t("feedback.notice.public")}</strong>
        </p>
        <dl className={styles.collected} data-testid="feedback-collected">
          {collected.map(item => (
            <div key={item.label} className={styles["collected-row"]}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        <a
          href="/privacy/"
          className={ui.text}
          target="_blank"
          rel="noreferrer"
        >
          {t("privacy.link")}
        </a>
      </section>

      <div className={styles.actions}>
        <div className={styles.error} role="alert" aria-live="polite">
          {errorKey ? t(errorKey) : ""}
        </div>
        {created && (
          <div className={styles.success} role="status">
            <p>{t("feedback.success")}</p>
            <a href={created.url} target="_blank" rel="noreferrer">
              {t("feedback.successLink", { number: created.number })}
            </a>
          </div>
        )}
        <button
          type="submit"
          className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
          disabled={!canSubmit}
        >
          {sending ? t("feedback.submitting") : t("feedback.submit")}
        </button>
      </div>
    </form>
  )
}

export default Component

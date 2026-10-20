import React, { useEffect, useRef, useState } from "react"
import {
  createSchedule,
  getScheduleCredential,
  getScheduleLimits,
} from "@/client/openapi/client"
import type { CreateScheduleBody } from "@/client/openapi/model"
import CredentialForm from "@/components/schedule/CredentialForm"
import { getActiveAccountHandle } from "@/lib/account/activeAccountSession"
import { useT } from "@/lib/i18n/react"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import {
  checkRunAt,
  defaultRunAt,
  toLocalInputValue,
  toRunAtIso,
  type RunAtLimits,
} from "@/lib/schedule/runAtInput"
import {
  nextDialogState,
  type DialogEvent,
  type DialogState,
} from "@/lib/schedule/scheduleDialogState"
import { scheduleErrorKey } from "@/lib/schedule/scheduleErrorKey"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

/**
 * 予約日時の入力と、予約用の認証情報の登録を行うダイアログ。
 *
 * 責務と処理概要:
 * - 状態は Editing → (Registering) → Submitting → Done。遷移は `nextDialogState` が決める。
 * - 開くたびに、制限値と認証情報の登録状態を取得する。範囲の数値は画面に持たず、
 *   取得した制限値だけで日時を判定する。
 * - 非モーダルの `<dialog>`（`show()`）で開く。パスワード欄を持つフォームを、
 *   パスワードマネージャの候補表示がトップレイヤーに隠れないようにするため。
 * - 送信中は確定操作を受け付けない。状態の更新を待たずに重複を防ぐため `useRef` でも持つ。
 */

type Props = {
  open: boolean
  /** 投稿フォームの内容を、予約の作成の入力（`runAt` を除く）に変換する */
  buildRequest: () => Promise<Omit<CreateScheduleBody, "runAt"> | null>
  onScheduled: (id: string) => void
  onClose: () => void
}

export const Component = ({
  open,
  buildRequest,
  onScheduled,
  onClose,
}: Props) => {
  const { t } = useT()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const submittingRef = useRef(false)
  const [state, setState] = useState<DialogState>("Editing")
  const [limits, setLimits] = useState<RunAtLimits | null>(null)
  const [limitsFailed, setLimitsFailed] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [handle, setHandle] = useState("")
  const [runAt, setRunAt] = useState("")
  const [errorKey, setErrorKey] = useState<PlainMessageKey | "">("")
  const [reloadCount, setReloadCount] = useState(0)

  const dispatch = (event: DialogEvent) =>
    setState(current => nextDialogState(current, event))

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.show()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // 開くたびに、入力・状態・制限値・認証情報の登録状態を初期化して取得する
  useEffect(() => {
    if (!open) return
    setState("Editing")
    setErrorKey("")
    setRunAt(toLocalInputValue(defaultRunAt(new Date())))
    setLimitsFailed(false)
    let cancelled = false
    void (async () => {
      try {
        const [limitsRes, credentialRes, ownHandle] = await Promise.all([
          getScheduleLimits(),
          getScheduleCredential(),
          getActiveAccountHandle(),
        ])
        if (cancelled) return
        if (limitsRes.status !== 200) {
          setLimitsFailed(true)
          return
        }
        setLimits(limitsRes.data)
        setRegistered(
          credentialRes.status === 200 && credentialRes.data.registered,
        )
        setHandle(ownHandle ?? "")
      } catch {
        if (!cancelled) setLimitsFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, reloadCount])

  const rangeStatus =
    limits && runAt ? checkRunAt(new Date(runAt), new Date(), limits) : "ok"
  const rangeMessage =
    limits && rangeStatus === "tooSoon"
      ? t("schedule.range.tooSoon", {
          minutes: Math.ceil(limits.minLeadSeconds / 60),
        })
      : limits && rangeStatus === "tooLate"
        ? t("schedule.range.tooLate", {
            days: Math.floor(limits.maxLeadSeconds / 86400),
          })
        : ""
  const canSubmit =
    !!limits && !!runAt && rangeStatus === "ok" && state === "Editing"

  const submit = async (credentialRegistered: boolean) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setErrorKey("")
    dispatch({ type: "submit", credentialRegistered })
    try {
      const request = await buildRequest()
      if (!request) {
        dispatch({ type: "createFailed" })
        setErrorKey("schedule.error.invalid")
        return
      }
      const res = await createSchedule({
        ...request,
        runAt: toRunAtIso(runAt),
      } as CreateScheduleBody)
      if (res.status !== 200) {
        dispatch({ type: "createFailed" })
        const code = "error" in res.data ? res.data.error : undefined
        if (code === "ScheduleCredentialRequired") setRegistered(false)
        setErrorKey(scheduleErrorKey(res.status, code))
        return
      }
      dispatch({ type: "created" })
      onScheduled(res.data.id)
    } catch {
      dispatch({ type: "createFailed" })
      setErrorKey("error.network")
    } finally {
      submittingRef.current = false
    }
  }

  const onConfirm = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit || submittingRef.current) return
    if (!registered) {
      dispatch({ type: "submit", credentialRegistered: false })
      return
    }
    void submit(true)
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={t("schedule.dialog.title")}
      onClose={onClose}
      onKeyDown={e => {
        if (e.key === "Escape" && state !== "Submitting") onClose()
      }}
    >
      {open ? (
        <div
          className={`${ui["base-card"]} ${ui["width-md"]} ${styles.content}`}
        >
          {state === "Registering" ? (
            <CredentialForm
              handle={handle}
              onRegistered={() => {
                setRegistered(true)
                dispatch({ type: "registered" })
                void submit(true)
              }}
              onCancel={() => dispatch({ type: "registerFailed" })}
            />
          ) : state === "Done" ? (
            <>
              <p>{t("schedule.dialog.done")}</p>
              <div className={styles.actions}>
                <a
                  href="/schedules/"
                  className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
                >
                  {t("schedule.dialog.goList")}
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
                >
                  {t("schedule.dialog.close")}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={onConfirm} className={styles.content}>
              <h2 className={ui.subject}>{t("schedule.dialog.title")}</h2>
              <div>
                <label htmlFor="schedule-run-at">
                  {t("schedule.dialog.runAt")}
                </label>
                <div className={ui["base-input-box"]}>
                  <input
                    className={ui["base-input-field"]}
                    id="schedule-run-at"
                    type="datetime-local"
                    value={runAt}
                    onChange={e => setRunAt(e.target.value)}
                    disabled={state === "Submitting"}
                  />
                </div>
              </div>
              {rangeMessage && (
                <div className={styles.error} role="alert">
                  {rangeMessage}
                </div>
              )}
              {limitsFailed && (
                <div className={styles.error} role="alert">
                  {t("schedule.dialog.limitsFailed")}{" "}
                  <button
                    type="button"
                    onClick={() => setReloadCount(count => count + 1)}
                    className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
                  >
                    {t("schedule.dialog.reload")}
                  </button>
                </div>
              )}
              <div className={styles.error} aria-live="polite">
                {errorKey ? t(errorKey) : ""}
              </div>
              <div className={styles.actions}>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
                >
                  {state === "Submitting"
                    ? t("schedule.dialog.sending")
                    : t("schedule.dialog.submit")}
                </button>
                <button
                  type="button"
                  disabled={state === "Submitting"}
                  onClick={onClose}
                  className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
                >
                  {t("schedule.dialog.cancel")}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </dialog>
  )
}
export default Component

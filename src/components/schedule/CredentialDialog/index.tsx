import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { putScheduleCredential } from "@/client/openapi/client"
import { getActiveAccountHandle } from "@/lib/account/activeAccountSession"
import { useT } from "@/lib/i18n/react"
import { renderSlots } from "@/lib/i18n/rich"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import { scheduleErrorKey } from "@/lib/schedule/scheduleErrorKey"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

/**
 * 予約用の認証情報（アプリパスワード）の入力のダイアログ。
 *
 * 責務と処理概要:
 * - 設定で予約投稿をオンにしたときに開き、`PUT /v2/schedules/credential` で登録する。
 * - 文言は、メインパスワードを入力しない注意・アプリパスワードの作成場所・プライバシーポリシーへの
 *   リンクの3行だけにする（詳しい説明はプライバシーポリシーに任せる）。
 * - 可視のユーザー名欄（`autocomplete="username"`）とパスワード欄（`current-password`）を
 *   同じフォームに1組だけ置き、パスワードマネージャの自動入力の対象にする。
 * - パスワードは非制御入力で扱い、送信後に空に戻す。ログ・URL・ストレージには出さない。
 *
 * 利用上の制約:
 * - 非モーダルの `<dialog>`（`show()`）で開き、開いている間だけフォームを描画する。
 *   トップレイヤーに置くとパスワードマネージャの候補が隠れるため、`showModal()` は使わない。
 * - 呼び出し側のカード（`overflow: hidden`）の中では背面の減光が描画されないため、
 *   `Overlay` と同じく `document.body` 直下へポータルで描画し、減光は専用の要素で敷く。
 */

type Props = {
  open: boolean
  /** 登録に成功したとき。呼び出し側がダイアログを閉じる */
  onRegistered: () => void
  onClose: () => void
}

export const Component = ({ open, onRegistered, onClose }: Props) => {
  const { t, raw } = useT()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [handle, setHandle] = useState("")
  const [errorKey, setErrorKey] = useState<PlainMessageKey | "">("")
  // ポータル先の document.body はクライアントでだけ参照できる（SSR では描画しない）
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // open に合わせて非モーダルのダイアログを開閉する（ポータルの描画後に参照できる）
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.show()
    if (!open && dialog.open) dialog.close()
  }, [open, mounted])

  // 開くたびにエラーを消し、ユーザー名欄の初期値（ログイン中のハンドル）を取得する
  useEffect(() => {
    if (!open) return
    setErrorKey("")
    let cancelled = false
    void getActiveAccountHandle()
      .then(own => {
        if (!cancelled) setHandle(own ?? "")
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open])

  /**
   * アプリパスワードを登録する。送信中の2回目の送信は無視する。
   * 失敗したらダイアログを開いたまま、パスワード欄を空にしてエラーを表示する。
   */
  const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setBusy(true)
    setErrorKey("")
    try {
      const password = passwordRef.current?.value ?? ""
      const res = await putScheduleCredential({ password })
      if (res.status !== 200) {
        setErrorKey(
          scheduleErrorKey(
            res.status,
            "error" in res.data ? res.data.error : undefined,
            "credential",
          ),
        )
        return
      }
      onRegistered()
    } catch {
      console.error("CredentialDialog: registration failed")
      setErrorKey("error.network")
    } finally {
      if (passwordRef.current) passwordRef.current.value = ""
      submittingRef.current = false
      setBusy(false)
    }
  }

  if (!mounted) return null
  return createPortal(
    <>
      {open && <div className={styles.backdrop} aria-hidden="true" />}
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-label={t("schedule.credential.title")}
        data-testid="schedule-credential-dialog"
        onClose={onClose}
        onKeyDown={e => {
          if (e.key === "Escape" && !busy) onClose()
        }}
      >
        {open ? (
          <form
            className={`${ui["base-card"]} ${styles.content}`}
            onSubmit={e => void onSubmit(e)}
          >
            <h2 className={ui.subject}>{t("schedule.credential.title")}</h2>
            <p className={styles.warning}>{t("schedule.credential.warning")}</p>
            <p className={styles.note}>{t("schedule.credential.howto")}</p>
            <p className={styles.note}>
              {renderSlots(raw("schedule.credential.privacy"), {
                link: (
                  <a
                    href="/privacy/#collected"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("privacy.link")}
                  </a>
                ),
              })}
            </p>
            <div>
              <label htmlFor="schedule-username">
                {t("schedule.credential.username")}
              </label>
              <div className={ui["base-input-box"]}>
                <input
                  className={ui["base-input-field"]}
                  id="schedule-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  defaultValue={handle}
                  key={handle}
                />
              </div>
            </div>
            <div>
              <label htmlFor="schedule-password">
                {t("schedule.credential.password")}
              </label>
              <div className={ui["base-input-box"]}>
                <input
                  className={ui["base-input-field"]}
                  id="schedule-password"
                  name="current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  ref={passwordRef}
                  disabled={busy}
                />
              </div>
            </div>
            <div className={styles.error} aria-live="polite">
              {errorKey ? t(errorKey) : ""}
            </div>
            <div className={styles.actions}>
              <button
                type="submit"
                disabled={busy}
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
              >
                {t("schedule.credential.submit")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
              >
                {t("schedule.credential.cancel")}
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>,
    document.body,
  )
}
export default Component

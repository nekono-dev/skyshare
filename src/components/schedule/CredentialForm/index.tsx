import React, { useRef, useState } from "react"
import { putScheduleCredential } from "@/client/openapi/client"
import { useT } from "@/lib/i18n/react"
import { renderSlots } from "@/lib/i18n/rich"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import { scheduleErrorKey } from "@/lib/schedule/scheduleErrorKey"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

/**
 * 予約用の認証情報（アプリパスワード）の登録フォーム。
 *
 * 責務と処理概要:
 * - 可視のユーザー名欄（`autocomplete="username"`）とパスワード欄（`current-password`）を
 *   同じフォームに1組だけ置き、パスワードマネージャの自動入力の対象にする。
 *   ほかのテキスト入力は同じフォームに置かない。
 * - パスワードは非制御入力で扱い、送信後に空に戻す。ログ・URL・ストレージには出さない。
 * - メインパスワードを入力しない注意と、アプリパスワードの作成方法を表示する。
 *
 * 利用上の制約:
 * - パスワード欄を持つため、呼び出し側は非モーダルのダイアログ内に、開いたときだけ描画すること。
 */

type Props = {
  /** ログイン中のアカウントのハンドル（ユーザー名欄の初期値） */
  handle: string
  onRegistered: () => void
  onCancel: () => void
}

export const Component = ({ handle, onRegistered, onCancel }: Props) => {
  const { t, raw } = useT()
  const passwordRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [errorKey, setErrorKey] = useState<PlainMessageKey | "">("")

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
    } catch (err) {
      console.error("CredentialForm: registration failed")
      setErrorKey("error.network")
    } finally {
      if (passwordRef.current) passwordRef.current.value = ""
      submittingRef.current = false
      setBusy(false)
    }
  }

  return (
    <form className={styles.content} onSubmit={e => void onSubmit(e)}>
      <h2 className={ui.subject}>{t("schedule.credential.title")}</h2>
      <p className={styles.note}>{t("schedule.credential.description")}</p>
      <p className={styles.warning}>{t("schedule.credential.warning")}</p>
      <p className={styles.note}>{t("schedule.credential.howto")}</p>
      <p className={styles.note}>
        {renderSlots(raw("privacy.scheduleNotice"), {
          link: (
            <a href="/privacy/#collected" target="_blank" rel="noreferrer">
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
      <div aria-live="polite" style={{ color: "#b00" }}>
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
          onClick={onCancel}
          className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
        >
          {t("schedule.dialog.cancel")}
        </button>
      </div>
    </form>
  )
}
export default Component

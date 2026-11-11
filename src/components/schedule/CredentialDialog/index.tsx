/**
 * 予約投稿の認可を開始するダイアログ。
 *
 * - 許可対象は現在のアクティブアカウントで、資格情報は端末に置かずサーバー側で保持する。
 * - OAuth 戻り先を開始元ページにし、投稿フォームから開いた場合は遷移を差し替えられる。
 */
import { useEffect, useRef, useState } from "react"
import { startScheduleAuthorization } from "@/client/openapi/client"
import Overlay from "@/components/common/dialog/Overlay"
import { getActiveAccountHandle } from "@/lib/session/activeAccountSession"
import { useT } from "@/components/i18n/useTranslation"
import { renderSlots } from "@/components/i18n/renderSlots"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  open: boolean
  onClose: () => void
  /** 認可の画面へ移る。テストで差し替えられるよう、既定は `location.assign` */
  navigate?: (url: string) => void
}

export const Component = ({
  open,
  onClose,
  navigate = url => window.location.assign(url),
}: Props) => {
  const { t, raw } = useT()
  const [handle, setHandle] = useState("")
  const [busy, setBusy] = useState(false)
  const [errorKey, setErrorKey] = useState<PlainMessageKey | "">("")
  const startingRef = useRef(false)

  // 開くたびにエラーを消し、許可するアカウント（ログイン中のハンドル）を取得する
  useEffect(() => {
    if (!open) return
    setErrorKey("")
    startingRef.current = false
    setBusy(false)
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

  /** 認可を開始し、認可の画面へ移る。2回目の押下は無視する */
  const start = async () => {
    if (startingRef.current) return
    startingRef.current = true
    setBusy(true)
    setErrorKey("")
    try {
      // 認可の画面から戻ったときに、許可を始めたこのページを開く
      const res = await startScheduleAuthorization({
        returnTo: `${window.location.pathname}${window.location.search}`,
      })
      if (res.status !== 200) {
        setErrorKey(
          res.status === 401
            ? "error.unauthorized"
            : "schedule.credential.startFailed",
        )
        return
      }
      navigate(res.data.url)
      // 画面が移るまでは押せないままにする
      return
    } catch {
      setErrorKey("error.network")
    }
    startingRef.current = false
    setBusy(false)
  }

  // 失敗で戻ったときは、再び押せるようにする
  useEffect(() => {
    if (errorKey) {
      startingRef.current = false
      setBusy(false)
    }
  }, [errorKey])

  return (
    <Overlay
      open={open}
      onClose={() => {
        if (!busy) onClose()
      }}
      backdropClassName={styles.backdrop}
      contentClassName={ui["width-sm"]}
    >
      <div
        className={`${ui["base-card"]} ${styles.content}`}
        role="dialog"
        aria-label={t("schedule.credential.title")}
        data-testid="schedule-credential-dialog"
      >
        <h2 className={ui.subject}>{t("schedule.credential.title")}</h2>
        <p className={styles.note}>{t("schedule.credential.intro")}</p>
        {handle && (
          <p className={styles.note} data-testid="schedule-credential-account">
            {t("schedule.credential.account", { handle: `@${handle}` })}
          </p>
        )}
        <p className={styles.note}>
          {renderSlots(raw("schedule.credential.privacy"), {
            link: (
              <a href="/privacy/#collected" target="_blank" rel="noreferrer">
                {t("privacy.link")}
              </a>
            ),
          })}
        </p>
        <div className={styles.error} aria-live="polite">
          {errorKey ? t(errorKey) : ""}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void start()}
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
      </div>
    </Overlay>
  )
}
export default Component

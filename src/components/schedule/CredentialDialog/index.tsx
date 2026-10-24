import { useEffect, useRef, useState } from "react"
import { startScheduleAuthorization } from "@/client/openapi/client"
import Overlay from "@/components/common/Overlay"
import { getActiveAccountHandle } from "@/lib/account/activeAccountSession"
import { useT } from "@/lib/i18n/react"
import { renderSlots } from "@/lib/i18n/rich"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

/**
 * 予約投稿を有効にするダイアログ（Bluesky の OAuth の認可へ送る）。
 *
 * 責務と処理概要:
 * - 設定で予約投稿をオンにしたときに開き、何をどのアカウントで許可するかを示す。
 * - ユーザー名・パスワードの入力欄は置かない。認可するアカウントは、ログイン中のアカウントに決まる。
 * - 許可が無効になったとき（`reauth`）は、再度の許可が必要である旨の見出しと文にする。
 * - 「Bluesky で許可する」で `POST /v2/schedules/credential/authorization` に今のページのパスを
 *   渡して呼び、返った認可の画面の URL へ移る。認可の画面から戻ると今のページが開き、
 *   全ページ共通の `AuthorizationReturn` が完了と結果の表示を行う。
 * - 投稿フォームから開いたときは、移る前に作成中の内容の扱いを確かめられるよう、
 *   移る処理（`navigate`）を投稿フォームが差し替える。
 * - スマホ幅では、投稿フォームと同様に画面の上部に固定する。
 */

type Props = {
  open: boolean
  onClose: () => void
  /** 許可が無効になった後の再度の許可として開く */
  reauth?: boolean
  /** 認可の画面へ移る。テストで差し替えられるよう、既定は `location.assign` */
  navigate?: (url: string) => void
}

export const Component = ({
  open,
  onClose,
  reauth = false,
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
        aria-label={t(
          reauth
            ? "schedule.credential.reauthTitle"
            : "schedule.credential.title",
        )}
        data-testid="schedule-credential-dialog"
      >
        <h2 className={ui.subject}>
          {t(
            reauth
              ? "schedule.credential.reauthTitle"
              : "schedule.credential.title",
          )}
        </h2>
        <p className={styles.note}>
          {t(
            reauth
              ? "schedule.credential.reauthIntro"
              : "schedule.credential.intro",
          )}
        </p>
        <p className={styles.note}>{t("schedule.credential.scope")}</p>
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

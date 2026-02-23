import React from "react"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"
import Overlay from "../Overlay"

type Props = {
  open: boolean
  onClose: () => void
  mode: "any" | "none"
  setMode: (m: "any" | "none") => void
  allowFollower: boolean
  setAllowFollower: (v: boolean) => void
  allowFollowing: boolean
  setAllowFollowing: (v: boolean) => void
  allowMentioned: boolean
  setAllowMentioned: (v: boolean) => void
}

export const PrivacyDialog: React.FC<Props> = ({
  open,
  onClose,
  mode,
  setMode,
  allowFollower,
  setAllowFollower,
  allowFollowing,
  setAllowFollowing,
  allowMentioned,
  setAllowMentioned,
}) => {
  if (!open) return null

  return (
    <Overlay open={open} onClose={onClose} contentClassName={styles.dialog}>
      <div role="dialog" aria-label="投稿への反応の設定">
        <div className={styles.popupHeader}>
          <h3>投稿への反応の設定</h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="閉じる"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className={styles.radioRow}>
          <label className={styles.radioBtn}>
            <input
              type="radio"
              name="privacy"
              checked={mode === "any"}
              onChange={() => setMode("any")}
            />
            <span>誰でも</span>
          </label>
          <label className={styles.radioBtn}>
            <input
              type="radio"
              name="privacy"
              checked={mode === "none"}
              onChange={() => {
                setMode("none")
                setAllowFollower(false)
                setAllowFollowing(false)
                setAllowMentioned(false)
              }}
            />
            <span>返信不可</span>
          </label>
        </div>

        <div className={styles.checkboxList}>
          <label className={styles.checkboxItem}>
            <input
              type="checkbox"
              checked={allowFollower}
              disabled={mode !== "any"}
              onChange={e => setAllowFollower(e.target.checked)}
            />
            <span>フォロワー</span>
          </label>

          <label className={styles.checkboxItem}>
            <input
              type="checkbox"
              checked={allowFollowing}
              disabled={mode !== "any"}
              onChange={e => setAllowFollowing(e.target.checked)}
            />
            <span>フォロー中の人</span>
          </label>

          <label className={styles.checkboxItem}>
            <input
              type="checkbox"
              checked={allowMentioned}
              disabled={mode !== "any"}
              onChange={e => setAllowMentioned(e.target.checked)}
            />
            <span>メンションした人</span>
          </label>
        </div>

        <div className={styles.popupFooter}>
          <button
            className={`${ui.baseButton} ${ui.blueButton}`}
            onClick={onClose}
            type="button"
          >
            保存
          </button>
        </div>
      </div>
    </Overlay>
  )
}

export default PrivacyDialog

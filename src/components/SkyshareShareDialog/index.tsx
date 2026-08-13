/**
 * skyshare entry 発行後に表示する共有ダイアログ。
 *
 * 責務と処理概要:
 * - 発行済みの skyshare entry URL と Bluesky 投稿本文から X intent テキストを組み立てる。
 * - 「X に投稿」選択時は intent ポップアップを開いてダイアログを閉じる。
 */
import Overlay from "@/components/Overlay"
import { buildXIntentText, openXIntentPopup } from "@/lib/xIntent"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

type Props = {
  open: boolean
  postText: string
  entryUrl: string | null
  onClose: () => void
}

/**
 * skyshare 共有ダイアログを描画する。
 *
 * Input:
 * - `open`: ダイアログの表示状態
 * - `postText`: X intent テキストの元になる投稿本文
 * - `entryUrl`: 発行済み skyshare entry の URL（未発行時は `null`）
 * - `onClose`: 「閉じる」選択時、および背景クリック時のコールバック
 *
 * Output:
 * - `open=false` の場合は何も描画しない
 * - `open=true` の場合、「X に投稿」「閉じる」の2択ダイアログ
 *
 * 例:
 * - 入力: `{ open: true, postText: "hello", entryUrl: "https://..." }`
 * - 出力: 「skyshareページを作成しました。」ダイアログ
 */
const Component = ({ open, postText, entryUrl, onClose }: Props) => {
  return (
    <Overlay
      open={open}
      onClose={onClose}
      contentClassName={styles.shareDialogOverlay}
    >
      <div
        className={`${ui.baseCard} ${styles.shareDialogCard}`}
        role="dialog"
        aria-label="skyshareページを共有"
      >
        <p className={ui.label}>skyshareページを作成しました。</p>
        <div className={styles.shareDialogActions}>
          <button
            type="button"
            className={`${ui.baseButton} ${ui.textButton} ${ui.blackButton}`}
            onClick={() => {
              if (!entryUrl) return
              openXIntentPopup(buildXIntentText(postText, entryUrl))
              onClose()
            }}
          >
            X に投稿
          </button>
          <button
            type="button"
            className={`${ui.baseButton} ${ui.textButton} ${ui.grayButton}`}
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>
    </Overlay>
  )
}

export default Component

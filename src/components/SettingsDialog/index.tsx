/**
 * 設定ページをダイアログとして表示するラッパーコンポーネント。
 *
 * 責務と処理概要:
 * - `Settings`（設定ページ本体）を `Overlay` 上のダイアログカードに載せ、
 *   `src/pages/settings.astro` を経由せずどの画面からも設定を開閉できるようにする。
 * - 表示内容・state管理は `Settings` 側にすべて委ね、本体は開閉制御と
 *   ダイアログ用の枠（閉じるボタン・見出し）のみを担う。
 */
import Overlay from "@/components/Overlay"
import Settings from "@/components/Settings"
import ui from "@/styles/ui.module.css"

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * 設定ダイアログを描画する。
 *
 * Input:
 * - `open`: ダイアログの表示状態
 * - `onClose`: 背景クリック/閉じるボタン押下時のコールバック
 *
 * Output:
 * - `open=false` の場合は何も描画しない
 * - `open=true` の場合、`Settings` を内包したダイアログ
 *
 * 例:
 * - 入力: `{ open: true, onClose: () => setOpen(false) }`
 * - 出力: 「設定」見出し・閉じるボタン付きの設定ダイアログ
 */
export const SettingsDialog = ({ open, onClose }: Props) => {
  return (
    <Overlay open={open} onClose={onClose} contentClassName={ui["width-md"]}>
      <div
        className={`${ui["base-card"]} ${ui["dialog-card"]} ${ui["base-padding"]}`}
        role="dialog"
        aria-label="設定"
        style={{ maxHeight: "80vh", overflow: "auto" }}
      >
        <div
          className={`${ui["base-component"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-center"]}`}
        >
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]} ${ui["toolbar-item-left"]}`}
            onClick={onClose}
          >
            閉じる
          </button>
          <div>設定</div>
        </div>

        <Settings />
      </div>
    </Overlay>
  )
}

export default SettingsDialog

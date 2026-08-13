/**
 * 下書き保存確認ダイアログ。
 *
 * 責務と処理概要:
 * - 投稿フォームでキャンセル時に未保存の本文がある場合、下書きとして保存するかを確認する。
 * - 「保存」「破棄」「編集を続ける」の3択を提示し、選択結果を呼び出し元へ委譲する。
 */
import React from "react"
import Loading from "@/components/Loading"
import Overlay from "@/components/Overlay"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

type Props = {
  open: boolean
  isSaving?: boolean
  onSave: () => void | Promise<void>
  onDiscard: () => void
  onContinueEditing: () => void
}

/**
 * 下書き保存確認ダイアログを描画する。
 *
 * Input:
 * - `open`: ダイアログの表示状態
 * - `isSaving`: 保存 API 実行中フラグ（ボタン disable とローディング表示に使用）
 * - `onSave`: 「下書きを保存」選択時のコールバック
 * - `onDiscard`: 「破棄」選択時のコールバック
 * - `onContinueEditing`: 「編集を続ける」選択時、および背景クリック時のコールバック
 *
 * Output:
 * - `open=false` の場合は何も描画しない
 * - `open=true` の場合、3択ボタン付きの確認ダイアログ
 *
 * 例:
 * - 入力: `{ open: true, onSave, onDiscard, onContinueEditing }`
 * - 出力: 「下書きを保存しますか？」ダイアログ
 */
export const Component: React.FC<Props> = ({
  open,
  isSaving = false,
  onSave,
  onDiscard,
  onContinueEditing,
}) => {
  return (
    <Overlay
      open={open}
      onClose={onContinueEditing}
      contentClassName={styles.draftConfirmOverlay}
    >
      <div
        className={`${ui.baseCard} ${ui.draftConfirmCard}`}
        role="dialog"
        aria-label="下書き保存確認"
      >
        {isSaving && <Loading overlay message="下書きを保存中..." />}
        <div className={ui.label}>下書きを保存しますか？</div>
        <div className={styles.draftConfirmActions}>
          <button
            type="button"
            className={`${ui.baseButton} ${ui.textButton} ${ui.blueButton}`}
            disabled={isSaving}
            onClick={() => {
              void onSave()
            }}
          >
            下書きを保存
          </button>
          <button
            type="button"
            className={`${ui.baseButton} ${ui.textButton} ${ui.redButton}`}
            disabled={isSaving}
            onClick={onDiscard}
          >
            破棄
          </button>
          <button
            type="button"
            className={`${ui.baseButton} ${ui.textButton} ${ui.grayButton}`}
            disabled={isSaving}
            onClick={onContinueEditing}
          >
            編集を続ける
          </button>
        </div>
      </div>
    </Overlay>
  )
}

export default Component

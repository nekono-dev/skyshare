/**
 * 投稿画像1枚分の alt テキスト（代替テキスト）を編集するダイアログ。
 *
 * 責務と処理概要:
 * - `value`（現在の alt テキスト）を編集フォームとして表示し、「適用」時のみ
 *   確定値を親へ通知する（Overlayの背景クリック/Escでの誤操作コミットを避けるため、
 *   `PostGateDialog` と同じく明示的なコミット方式にする）。
 * - テキスト入力は `CountedTextInput`（Entry編集フォーム・PostFormと共通のコンポーネント）を使い、
 *   複数行入力・文字数カウンタの見た目をアプリ全体で揃える。Blueskyのalt上限は1000文字。
 */
import { useEffect, useId, useState } from "react"
import CountedTextInput, {
  type CounterSpec,
} from "@/components/common/CountedTextInput"
import Overlay from "@/components/common/Overlay"
import { countGraphemes } from "@/util/textCount"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

type Props = {
  open: boolean
  onClose: () => void
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}

const altCounters: CounterSpec[] = [
  {
    key: "alt",
    label: "alt",
    count: countGraphemes,
    maxAssumed: 1000,
    errorAt: 1000,
  },
]

/**
 * alt テキスト編集ダイアログを描画する。
 *
 * Input:
 * - `open`: ダイアログの表示状態
 * - `onClose`: キャンセル（背景クリック/Esc/キャンセルボタン共通）
 * - `value`: ダイアログを開くたびの初期値
 * - `onChange`: 「適用」ボタン押下時に確定値を渡すコールバック
 * - `disabled`: true の場合、内部コントロールを操作不能にする
 *
 * Output:
 * - `open=false` の場合は何も描画しない
 * - `open=true` の場合、alt テキストを編集できるダイアログ
 *
 * 例:
 * - 入力: `{ open: true, value: "", onChange, onClose }`
 * - 出力: 空のテキスト入力欄を持つダイアログ
 */
export const ImageAltDialog = ({
  open,
  onClose,
  value,
  onChange,
  disabled = false,
}: Props) => {
  const inputId = useId()
  const [draft, setDraft] = useState(value)

  // ダイアログを開くたびに前回の編集内容を引きずらず、渡された値で同期する。
  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const handleApply = () => {
    onChange(draft)
    onClose()
  }

  return (
    <Overlay open={open} onClose={onClose} contentClassName={ui["width-sm"]}>
      <div
        className={`${ui["base-card"]} ${ui["dialog-card"]} ${ui["base-padding"]}`}
        role="dialog"
        aria-label="画像のaltテキスト編集"
      >
        <h2 className={ui.subject}>altテキスト</h2>

        <div className={ui["dialog-body"]}>
          <label className={styles["field-label"]} htmlFor={inputId}>
            画像の代替テキスト
            <CountedTextInput
              id={inputId}
              multiline
              rows={3}
              maxRows={8}
              autoGrow
              value={draft}
              onChange={setDraft}
              disabled={disabled}
              counters={altCounters}
              placeholder="画像の内容を説明するテキストを入力"
            />
          </label>
        </div>

        <div className={`${ui["dialog-actions"]} ${ui["dialog-actions-row"]}`}>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]}`}
            disabled={disabled}
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
            disabled={disabled}
            onClick={handleApply}
          >
            適用
          </button>
        </div>
      </div>
    </Overlay>
  )
}

export default ImageAltDialog

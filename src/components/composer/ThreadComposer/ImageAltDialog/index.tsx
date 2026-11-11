/**
 * 投稿画像 1 枚分の alt テキストを編集するダイアログ。
 *
 * - 適用操作でのみ変更を親へ通知し、閉じる操作による誤確定を防ぐ。
 * - Bluesky の alt テキスト上限に合わせ、文字数カウンターは 1000 文字を上限として扱う。
 */
import { useT } from "@/components/i18n/useTranslation"
import { useEffect, useId, useState } from "react"
import CountedTextInput, {
  type CounterSpec,
} from "@/components/common/input/CountedTextInput"
import Overlay from "@/components/common/dialog/Overlay"
import { countGraphemes } from "@/lib/share/textCount"
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
  const { t } = useT()
  const inputId = useId()
  const [draft, setDraft] = useState(value)

  // 開くたびに編集内容を破棄し、親から渡された値で同期する。
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
        aria-label={t("image.alt.dialogAria")}
      >
        <div className={ui["dialog-body"]}>
          <label className={styles["field-label"]} htmlFor={inputId}>
            <div className={`${ui["text"]}`}>{t("image.alt.prompt")}</div>
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
              placeholder={t("image.alt.placeholder")}
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
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
            disabled={disabled}
            onClick={handleApply}
          >
            {t("common.apply")}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

export default ImageAltDialog

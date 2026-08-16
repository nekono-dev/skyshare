/**
 * Skyshare entryのheading/captionを編集するフォーム。
 *
 * 責務と処理概要:
 * - Overlay 上に baseCard を重ね、`role="dialog"` の編集フォームを描画する。
 * - open のたびに初期値（item.heading / item.caption）から入力stateを再同期する。
 * - 保存ボタンから `PUT /v2/entry`（`updateEntry`）を呼び出し、成功時は
 *   `onSaved` で呼び出し元へ更新後の値を通知する。ダイアログを閉じるかどうかの
 *   判断は呼び出し元（EntryCard）に委ねる。
 *
 * 画面全体をオーバーレイしてユーザー操作を一時的に限定するフォームであり、
 * PostFormと同種の性質を持つが内容が個別具体的なためコンポーネントとしては汎化しない。
 * カード外枠・縦積みレイアウトはdialog.ui.module.cssを通じてPostForm/ChoiceDialogと共通化する。
 */
import { useEffect, useRef, useState } from "react"
import { updateEntry } from "@/client/openapi/client"
import CountedTextInput, {
  type CounterSpec,
} from "@/components/CountedTextInput"
import Loading from "@/components/Loading"
import Overlay from "@/components/Overlay"
import { countGraphemes } from "@/util/textCount"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

type Props = {
  open: boolean
  uri: string
  initialHeading?: string
  initialCaption?: string
  onClose: () => void
  onSaved: (next: { heading: string; caption: string }) => void
}

const headingCounters: CounterSpec[] = [
  {
    key: "heading",
    label: "見出し",
    count: countGraphemes,
    maxAssumed: 100,
    errorAt: 100,
  },
]
const captionCounters: CounterSpec[] = [
  {
    key: "caption",
    label: "キャプション",
    count: countGraphemes,
    maxAssumed: 300,
    errorAt: 300,
  },
]

/**
 * Entry編集フォームを描画する。
 *
 * Input:
 * - `open`: 表示状態
 * - `initialHeading`/`initialCaption`: 編集対象entryの現在値
 * - `onClose`: キャンセル時、および背景クリック時のコールバック
 *
 * Output:
 * - `open=false` の場合は何も描画しない
 * - `open=true` の場合、見出し・キャプション編集フォーム
 */
export const Component: React.FC<Props> = ({
  open,
  uri,
  initialHeading,
  initialCaption,
  onClose,
  onSaved,
}) => {
  const [heading, setHeading] = useState(initialHeading ?? "")
  const [caption, setCaption] = useState(initialCaption ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // 連打時、state 更新の再レンダーが反映される前に多重リクエストが走るのを防ぐ。
  const isSavingRef = useRef(false)

  useEffect(() => {
    if (!open) return
    setHeading(initialHeading ?? "")
    setCaption(initialCaption ?? "")
    setSaveError(null)
  }, [open, initialHeading, initialCaption])

  /**
   * 入力中の heading/caption を保存する。
   *
   * Output:
   * - なし（成功時は `onSaved` を呼び、失敗時はエラー文言を表示する）
   */
  const confirmSave = async () => {
    if (isSavingRef.current) {
      return
    }
    isSavingRef.current = true
    setIsSaving(true)
    setSaveError(null)

    try {
      const res = await updateEntry({ uri, heading, caption })
      if (res.status !== 200) {
        setSaveError("Entryの更新に失敗しました。")
        return
      }
      onSaved({ heading, caption })
    } catch (err) {
      console.error("EntryEditForm: failed to update entry", err)
      setSaveError("Entryの更新に失敗しました。")
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }

  return (
    <Overlay open={open} onClose={onClose} contentClassName={ui["width-md"]}>
      <div
        className={`${ui["base-card"]} ${ui["dialog-card"]}`}
        role="dialog"
        aria-label="Entry編集"
      >
        <div className={ui["dialog-body"]}>
          <label className={styles["field-label"]} htmlFor="entry-edit-heading">
            見出し
            <CountedTextInput
              id="entry-edit-heading"
              value={heading}
              onChange={setHeading}
              counters={headingCounters}
            />
          </label>
          <label className={styles["field-label"]} htmlFor="entry-edit-caption">
            キャプション
            <CountedTextInput
              id="entry-edit-caption"
              multiline
              rows={5}
              value={caption}
              onChange={setCaption}
              counters={captionCounters}
            />
          </label>
          {saveError ? (
            <p className={styles["error-text"]}>{saveError}</p>
          ) : null}
        </div>
        <div className={ui["dialog-actions"]}>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
            onClick={() => void confirmSave()}
            disabled={isSaving || heading.trim().length === 0}
          >
            保存
          </button>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]}`}
            onClick={onClose}
            disabled={isSaving}
          >
            キャンセル
          </button>
        </div>
      </div>
      {isSaving ? <Loading overlay message="保存中..." /> : null}
    </Overlay>
  )
}

export default Component

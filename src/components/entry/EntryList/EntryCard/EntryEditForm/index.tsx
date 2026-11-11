/**
 * Entry の見出しとキャプションを編集するオーバーレイフォーム。
 *
 * - Entry 固有の編集内容を扱うため専用部品とし、カードと縦積みの見た目は共通スタイルを使う。
 */
import { useT } from "@/components/i18n/useTranslation"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { updateEntry } from "@/client/openapi/client"
import CountedTextInput, {
  type CounterSpec,
} from "@/components/common/input/CountedTextInput"
import Loading from "@/components/common/Loading"
import Overlay from "@/components/common/dialog/Overlay"
import { countUtf8Bytes } from "@/util/utf8Bytes"
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

/**
 * 見出し・キャプション欄の文字数カウンタ定義を作る。
 *
 * Input:
 * - `labels`: 各欄のカウンタに表示する名称（表示言語で翻訳済み）
 *
 * Output:
 * - 見出し用・キャプション用の `CounterSpec[]`
 */
const buildCounters = (labels: { heading: string; caption: string }) => ({
  headingCounters: [
    {
      key: "heading",
      label: labels.heading,
      count: countUtf8Bytes,
      maxAssumed: 100,
      errorAt: 100,
    },
  ] as CounterSpec[],
  captionCounters: [
    {
      key: "caption",
      label: labels.caption,
      count: countUtf8Bytes,
      maxAssumed: 300,
      errorAt: 300,
    },
  ] as CounterSpec[],
})

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
  const { t } = useT()
  const { headingCounters, captionCounters } = useMemo(
    () =>
      buildCounters({
        heading: t("entry.edit.heading"),
        caption: t("entry.edit.caption"),
      }),
    [t],
  )
  const [heading, setHeading] = useState(initialHeading ?? "")
  const [caption, setCaption] = useState(initialCaption ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<PlainMessageKey | null>(null)
  // 連打時、state 更新の再レンダーが反映される前に多重リクエストが走るのを防ぐ。
  const isSavingRef = useRef(false)

  // 空文字も有効な値として許可し、保存ボタンは「内容が変わっていない時」のみ無効にする。
  const isUnchanged =
    heading === (initialHeading ?? "") && caption === (initialCaption ?? "")

  useEffect(() => {
    if (!open) return
    setHeading(initialHeading ?? "")
    setCaption(initialCaption ?? "")
    setSaveError(null)
  }, [open, initialHeading, initialCaption])

  /**
   * キャプション欄フォーカス中、Ctrl(Windows/Linux) または Cmd(Mac) + Enter で保存を実行する。
   *
   * Input:
   * - `e`: keydown イベント
   *
   * Output:
   * - なし（保存処理をトリガー）
   */
  const handleCaptionKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    if (isSaving || isUnchanged) return
    void confirmSave()
  }

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
        setSaveError("entry.edit.updateFailed")
        return
      }
      onSaved({ heading, caption })
    } catch (err) {
      console.error("EntryEditForm: failed to update entry", err)
      setSaveError("entry.edit.updateFailed")
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }

  return (
    <Overlay
      open={open}
      onClose={onClose}
      contentClassName={`${ui["width-md"]} ${styles["edit-form-content"]}`}
      backdropClassName={styles["edit-form-backdrop"]}
    >
      <div
        className={`${ui["base-card"]} ${ui["dialog-card"]}`}
        role="dialog"
        aria-label={t("entry.edit.aria")}
      >
        <div
          className={`${ui["base-component"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]}`}
        >
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
            onClick={onClose}
            disabled={isSaving}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
            onClick={() => void confirmSave()}
            disabled={isSaving || isUnchanged}
          >
            {t("common.save")}
          </button>
        </div>
        <div className={`${ui["dialog-body"]} ${ui["base-padding"]}`}>
          <label className={styles["field-label"]} htmlFor="entry-edit-heading">
            {t("entry.edit.heading")}
            <CountedTextInput
              id="entry-edit-heading"
              value={heading}
              onChange={setHeading}
              counters={headingCounters}
            />
          </label>
          <label className={styles["field-label"]} htmlFor="entry-edit-caption">
            {t("entry.edit.caption")}
            <CountedTextInput
              id="entry-edit-caption"
              multiline
              rows={3}
              maxRows={6}
              autoGrow
              value={caption}
              onChange={setCaption}
              onKeyDown={handleCaptionKeyDown}
              counters={captionCounters}
            />
          </label>
          {saveError ? (
            <p className={styles["error-text"]}>{t(saveError)}</p>
          ) : null}
        </div>
      </div>
      {isSaving ? <Loading overlay message={t("common.saving")} /> : null}
    </Overlay>
  )
}

export default Component

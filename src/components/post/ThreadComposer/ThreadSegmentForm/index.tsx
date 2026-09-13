/**
 * スレッド投稿の1セグメント分（1投稿単位）を描画するコンポーネント。
 *
 * 責務と処理概要:
 * - フル編集UI（本文欄・画像添付・OGP取得・返信/引用設定・自己ラベル・言語選択・
 *   文字数カウンター、既存の単発投稿フォームと同一の入力補助UI一式。requirements.md
 *   §6.3: どのsegmentも1投稿目と全く同じフル機能を持つ）と、簡略化したグレーアウト
 *   表示（本文冒頭＋画像がある場合はサムネイルプレビュー）の両ブロックを常に
 *   マウントしたまま保持し、`isActive`に応じて`hidden`属性で表示/非表示を切り替える
 *   （JSXの出し分けでアンマウントすると`ImagePicker`等の内部stateが失われ、
 *   非アクティブから戻った際に画像プレビューが消える不具合があったため）。
 * - アバターの下に後続segmentへの連結線を描画し、スレッドとしての連続性を示す
 *   （`hasNext`）。
 * - 状態（テキスト・画像・OGP・返信/引用設定・自己ラベル・言語）は`segment`として
 *   親（`ThreadComposer`）から受け取り、変更は`onChange`で親へ通知する制御コンポーネント。
 */
import React, { useEffect, useRef, useState } from "react"
import Avatar from "@/components/common/Avatar"
import { type CounterSpec } from "@/components/common/CountedTextInput"
import ImagePicker, {
  type ImagePickerHandle,
} from "@/components/image/ImagePicker"
import { OgpFetchButton, useOgpFetch } from "@/components/image/OgpFetchButton"
import OgpPreview from "@/components/image/OgpPreview"
import LanguageSelect from "@/components/common/LanguageSelect"
import PostGateDialog from "@/components/post/PostGateDialog"
import SelfLabelsSelect from "@/components/post/SelfLabelsSelect"
import SuggestPopover from "@/components/post/SuggestPopover"
import { isDefaultPostGateValue } from "@/lib/settings/postGateSettings"
import { countGraphemes, countWeightedTweetLength } from "@/util/textCount"
import PostBodyEditor from "../PostBodyEditor"
import { useKeyboardRows } from "../useKeyboardRows"
import { useSuggest } from "../useSuggest"
import { revokeImageEntry, type SegmentState } from "../segments"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  segment: SegmentState
  index: number
  isActive: boolean
  hasNext: boolean
  canRemove: boolean
  avatarUrl?: string | null
  accountDid?: string | null
  disabled: boolean
  variant: "dialog" | "page"
  formRef: React.RefObject<HTMLDivElement | null>
  hashtagSuggestEnabled: boolean
  mentionSuggestEnabled: boolean
  onActivate: () => void
  onRemove: () => void
  onChange: (next: SegmentState) => void
  onRequestSubmit: () => void
}

const bskyMaxCount = 300
const xWarnCount = 140
const textCounters: CounterSpec[] = [
  {
    key: "x",
    label: "X",
    count: countWeightedTweetLength,
    maxAssumed: xWarnCount,
    warnAt: xWarnCount,
  },
  {
    key: "bsky",
    label: "Bluesky",
    count: countGraphemes,
    maxAssumed: bskyMaxCount,
    errorAt: bskyMaxCount,
  },
]
const pageMaxRows = 7
const pageMinRows = 3

/**
 * 簡略化表示用に本文冒頭を切り詰める。
 *
 * Input:
 * - `text`: セグメント本文
 *
 * Output:
 * - 改行を除去し80文字までに切り詰めた文字列
 */
const summarizeText = (text: string): string => {
  const singleLine = text.replace(/\s+/g, " ").trim()
  if (singleLine.length <= 80) return singleLine
  return `${singleLine.slice(0, 80)}…`
}

/**
 * スレッド投稿の1セグメントを描画する。
 *
 * Input:
 * - `segment`/`isActive`/`hasNext`/`canRemove`等: セグメント状態と表示制御に必要な値一式
 *
 * Output:
 * - アクティブなら入力補助UI一式、非アクティブならグレーアウトした簡略表示
 */
const Component: React.FC<Props> = ({
  segment,
  index,
  isActive,
  hasNext,
  canRemove,
  avatarUrl,
  accountDid,
  disabled,
  variant,
  formRef,
  hashtagSuggestEnabled,
  mentionSuggestEnabled,
  onActivate,
  onRemove,
  onChange,
  onRequestSubmit,
}) => {
  const [postGateDialogOpen, setPostGateDialogOpen] = useState(false)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const imagePickerRef = useRef<ImagePickerHandle>(null)
  const imagePreviewContainerRef = useRef<HTMLDivElement>(null)
  const inputAreaRef = useRef<HTMLDivElement>(null)
  const toolboxRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const update = (partial: Partial<SegmentState>) =>
    onChange({ ...segment, ...partial })

  useEffect(() => {
    return () => {
      revokeImageEntry(segment.imageEntry)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment.imageEntry])

  const suggest = useSuggest({
    text: segment.text,
    onReplaceText: text => update({ text }),
    editorRef,
    disabled,
    hashtagSuggestEnabled,
    mentionSuggestEnabled,
    accountDid,
  })

  const ogpFetch = useOgpFetch({
    text: segment.text,
    value: segment.ogpResult,
    onChange: nextOgp => {
      if (nextOgp) {
        update({ ogpResult: nextOgp, imageEntry: null })
        revokeImageEntry(segment.imageEntry)
        return
      }
      update({ ogpResult: nextOgp })
    },
    disabled,
  })

  const autoGrowText = variant === "page"
  const {
    rows: keyboardRows,
    keyboardMaxRows,
    handleTextareaFocus,
    handleTextareaBlur,
    isKeyboardPlatform,
  } = useKeyboardRows({
    formRef,
    inputAreaRef,
    toolboxRef,
    defaultRows: 12,
    minRows: pageMinRows,
    nonKeyboardFixedRows: pageMaxRows,
    persistToStorage: variant === "dialog",
    enabled: variant === "dialog",
  })

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return

    const items = e.clipboardData?.items
    if (!items) return

    const files = Array.from(items)
      .filter(item => item.kind === "file" && item.type.startsWith("image/"))
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null)

    if (files.length === 0) return

    e.preventDefault()
    void imagePickerRef.current?.addFiles(files)
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    onRequestSubmit()
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return
    if (!e.dataTransfer.types.includes("Files")) return
    e.preventDefault()
    setIsDraggingImage(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setIsDraggingImage(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return
    e.preventDefault()
    setIsDraggingImage(false)
    if (disabled) return

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith("image/"),
    )
    if (files.length === 0) return

    void imagePickerRef.current?.addFiles(files)
  }

  return (
    <div className={styles.segment} data-testid={`thread-segment-${index}`}>
      <div className={styles["avatar-col"]}>
        <Avatar src={avatarUrl} alt="avatar" aria-hidden size="md" />
        {hasNext && (
          <div className={styles["connector-line"]} aria-hidden="true" />
        )}
      </div>

      <>
        {/* isActiveで丸ごと出し分けず、両ブロックを常時マウントしたままhidden属性で
            表示/非表示を切り替える。ImagePicker等の重い入力コンポーネントをアンマウント
            すると内部state（ImagePickerのslots等）が失われ、非アクティブから戻った際に
            画像プレビューが消えて見える不具合があったため（`hidden`要素は自然に
            フォーカス対象外・非表示になるため、追加のCSSは不要）。 */}
        <div
          hidden={!isActive}
          data-testid="segment-editor"
          className={`${styles.body} ${isDraggingImage ? styles["drag-over"] : ""}`}
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDraggingImage && (
            <div className={styles["drag-overlay"]} aria-hidden>
              画像をドロップして添付
            </div>
          )}

          <div ref={inputAreaRef}>
            <PostBodyEditor
              rows={
                keyboardRows ??
                (variant === "page"
                  ? pageMinRows
                  : isKeyboardPlatform
                    ? 6
                    : pageMaxRows)
              }
              maxRows={
                autoGrowText && variant === "page"
                  ? Math.max(pageMaxRows, keyboardMaxRows ?? pageMaxRows)
                  : undefined
              }
              autoGrow={autoGrowText}
              placeholder={index === 0 ? "最近どう？" : "スレッドに追加..."}
              value={segment.text}
              onChange={text => update({ text })}
              onFocus={handleTextareaFocus}
              onBlur={() => {
                suggest.handleBlur()
                handleTextareaBlur()
              }}
              onKeyDown={e => {
                suggest.handleKeyDown(e)
                handleTextareaKeyDown(e)
              }}
              onCompositionStart={suggest.handleCompositionStart}
              onCompositionEnd={suggest.handleCompositionEnd}
              onCaretMove={suggest.handleCaretMove}
              disabled={disabled}
              counters={textCounters}
              wrapperClassName={styles["text-input-wrapper"]}
              editorRef={editorRef}
            />
            <SuggestPopover
              candidates={suggest.candidates}
              activeIndex={suggest.activeIndex}
              position={suggest.position}
              listboxId={suggest.listboxId}
              onHoverIndex={suggest.onHoverIndex}
              onSelect={suggest.onSelect}
              onDismiss={suggest.close}
            />
          </div>

          <div
            className={`${ui["base-component"]} ${ui["base-padding"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]} ${ui["toolbar-wrap"]}`}
          >
            <button
              type="button"
              className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]} ${!isDefaultPostGateValue(segment.postGate) ? styles["gate-button-active"] : ""}`}
              disabled={disabled}
              aria-label={
                isDefaultPostGateValue(segment.postGate)
                  ? "誰でも反応可能"
                  : "反応を制限しています"
              }
              onClick={() => setPostGateDialogOpen(true)}
            >
              {isDefaultPostGateValue(segment.postGate)
                ? "誰でも反応可能"
                : "反応を制限しています"}
            </button>
            <LanguageSelect
              id={`thread-segment-${index}-language`}
              name={`thread-segment-${index}-language`}
              value={segment.languageCode}
              onChange={languageCode => update({ languageCode })}
              disabled={disabled}
            />
          </div>

          <PostGateDialog
            open={postGateDialogOpen}
            onClose={() => setPostGateDialogOpen(false)}
            value={segment.postGate}
            accountDid={accountDid}
            disabled={disabled}
            onChange={next => {
              update({ postGate: next })
              setPostGateDialogOpen(false)
            }}
          />

          <div
            ref={toolboxRef}
            className={`${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]} ${ui["toolbar-wrap"]}`}
          >
            <div
              className={`${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-left"]} ${ui["toolbar-wrap"]} ${ui["toolbar-auto-width"]}`}
            >
              <ImagePicker
                ref={imagePickerRef}
                value={segment.imageEntry}
                onChange={entry => {
                  if (entry && segment.ogpResult) {
                    update({ imageEntry: entry, ogpResult: null })
                    ogpFetch.clearOgpStatus()
                    return
                  }
                  update({ imageEntry: entry })
                }}
                disabled={disabled}
                previewContainerRef={imagePreviewContainerRef}
              />
              <OgpFetchButton ogpFetch={ogpFetch} disabled={disabled} />
            </div>

            <SelfLabelsSelect
              id={`thread-segment-${index}-self-label`}
              name={`thread-segment-${index}-self-label`}
              value={segment.selfLabel}
              onChange={selfLabel => update({ selfLabel })}
              disabled={disabled}
            />
          </div>
          <div>
            <OgpPreview ogpFetch={ogpFetch} />
            <div ref={imagePreviewContainerRef} />
          </div>
        </div>

        <div
          hidden={isActive}
          data-testid="segment-summary"
          className={styles.body}
          role="button"
          tabIndex={0}
          onClick={onActivate}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onActivate()
            }
          }}
        >
          <div className={styles.summary}>
            {segment.imageEntry && (
              <img
                className={styles["summary-thumbnail"]}
                data-testid="segment-thumbnail"
                src={segment.imageEntry.thumbnailPreview}
                alt=""
                aria-hidden
              />
            )}
            <span
              className={`${styles["summary-text"]} ${!segment.text ? styles["summary-placeholder"] : ""}`}
            >
              {segment.text ? summarizeText(segment.text) : "（本文未入力）"}
            </span>
            {canRemove && (
              <button
                type="button"
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]} ${styles["remove-button"]}`}
                disabled={disabled}
                aria-label="このセグメントを削除"
                onClick={e => {
                  e.stopPropagation()
                  revokeImageEntry(segment.imageEntry)
                  onRemove()
                }}
              >
                削除
              </button>
            )}
          </div>
        </div>
      </>
    </div>
  )
}

export default Component

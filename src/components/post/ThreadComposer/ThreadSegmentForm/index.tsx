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
import { useT } from "@/lib/i18n/react"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import React, { useEffect, useRef, useState } from "react"
import Avatar from "@/components/common/Avatar"
import { type CounterSpec } from "@/components/common/CountedTextInput"
import ImagePicker, {
  type ImagePickerHandle,
} from "@/components/image/ImagePicker"
import { OgpFetchButton, useOgpFetch } from "@/components/image/OgpFetchButton"
import OgpPreview from "@/components/image/OgpPreview"
import VideoPicker, {
  type VideoPickerHandle,
} from "@/components/video/VideoPicker"
import ThumbnailAdjustButton from "@/components/image/ThumbnailAdjustButton"
import LanguageSelect from "@/components/common/LanguageSelect"
import PostGateDialog from "@/components/post/PostGateDialog"
import SelfLabelsSelect from "@/components/post/SelfLabelsSelect"
import SuggestPopover from "@/components/post/SuggestPopover"
import { isDefaultPostGateValue } from "@/lib/settings/postGateSettings"
import { countGraphemes, countWeightedTweetLength } from "@/util/textCount"
import PostBodyEditor from "../PostBodyEditor"
import { useKeyboardRows } from "../useKeyboardRows"
import { useSuggest } from "../useSuggest"
import {
  revokeImageEntry,
  revokeVideoEntry,
  type SegmentState,
} from "../segments"
import { resolveVideoMimeType } from "@/lib/video/probeVideo"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"
import plusIcon from "@/images/plus.svg"

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
  /** 末尾へセグメントを追加できるか（上限到達時はfalse） */
  canAddSegment: boolean
  /** 投稿ボタンが押せない理由（動画のアップロード待ち等）。無ければ null */
  submitBlockedReason: PlainMessageKey | null
  onAddSegment: () => void
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
  canAddSegment,
  submitBlockedReason,
  onAddSegment,
  onRemove,
  onChange,
  onRequestSubmit,
}) => {
  const { t } = useT()
  const [postGateDialogOpen, setPostGateDialogOpen] = useState(false)
  const [isDraggingMedia, setIsDraggingMedia] = useState(false)
  const imagePickerRef = useRef<ImagePickerHandle>(null)
  const videoPickerRef = useRef<VideoPickerHandle>(null)
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

  // 動画のプレビューURLは進捗更新のたびに `videoEntry` が作り直されても変わらないため、
  // URL をキーにして解放する（進捗更新のたびに解放しない）。
  const videoPosterPreview = segment.videoEntry?.posterPreview
  useEffect(() => {
    return () => {
      if (videoPosterPreview) URL.revokeObjectURL(videoPosterPreview)
    }
  }, [videoPosterPreview])
  const videoThumbnailPreview = segment.videoEntry?.thumbnailPreview
  useEffect(() => {
    return () => {
      if (videoThumbnailPreview) URL.revokeObjectURL(videoThumbnailPreview)
    }
  }, [videoThumbnailPreview])

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
    // 動画を添付済みの segment には画像を追加できない（排他）
    if (segment.videoEntry) return
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
    setIsDraggingMedia(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setIsDraggingMedia(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return
    e.preventDefault()
    setIsDraggingMedia(false)
    if (disabled) return

    const dropped = Array.from(e.dataTransfer.files)
    const images = dropped.filter(file => file.type.startsWith("image/"))
    if (images.length > 0) {
      // 動画を添付済みの segment には画像を追加できない（排他）
      if (!segment.videoEntry) void imagePickerRef.current?.addFiles(images)
      return
    }

    // 動画は1本だけ。対応外の動画形式も VideoPicker 側で検査して通知する。
    // MIME が空の対応形式（.mov 等）も動画として扱う。
    const video = dropped.find(
      file =>
        file.type.startsWith("video/") ||
        resolveVideoMimeType(file) !== undefined,
    )
    if (video) void videoPickerRef.current?.addFile(video)
  }

  // アバター列（アバター＋後続segmentへの連結線）。編集表示・簡略表示のそれぞれの
  // 先頭行に置くため、JSXを使い回す。
  const avatarCol = (
    <div className={styles["avatar-col"]}>
      <Avatar src={avatarUrl} alt="" aria-hidden size="md" />
      {hasNext && (
        <div className={styles["connector-line"]} aria-hidden="true" />
      )}
    </div>
  )

  return (
    <div className={styles.segment} data-testid={`thread-segment-${index}`}>
      <>
        {/* isActiveで丸ごと出し分けず、両ブロックを常時マウントしたままhidden属性で
            表示/非表示を切り替える。ImagePicker等の重い入力コンポーネントをアンマウント
            すると内部state（ImagePickerのslots等）が失われ、非アクティブから戻った際に
            画像プレビューが消えて見える不具合があったため（`hidden`要素は自然に
            フォーカス対象外・非表示になるため、追加のCSSは不要）。 */}
        <div
          hidden={!isActive}
          data-testid="segment-editor"
          className={`${styles["editor-area"]} ${isDraggingMedia ? styles["drag-over"] : ""}`}
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDraggingMedia && (
            <div className={styles["drag-overlay"]} aria-hidden>
              {t("post.segment.dropMedia")}
            </div>
          )}

          <div className={styles.row}>
            {avatarCol}
            <div className={styles.body} ref={inputAreaRef}>
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
                placeholder={
                  index === 0
                    ? t("post.segment.placeholderFirst")
                    : t("post.segment.placeholderNext")
                }
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
          </div>

          <div
            className={`${ui["base-component"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-left"]} ${ui["toolbar-wrap"]}`}
          >
            <button
              type="button"
              className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]} ${!isDefaultPostGateValue(segment.postGate) ? styles["gate-button-active"] : ""}`}
              disabled={disabled}
              aria-label={
                isDefaultPostGateValue(segment.postGate)
                  ? t("post.segment.gateOpen")
                  : t("post.segment.gateRestricted")
              }
              onClick={() => setPostGateDialogOpen(true)}
            >
              {isDefaultPostGateValue(segment.postGate)
                ? t("post.segment.gateOpen")
                : t("post.segment.gateRestricted")}
            </button>
            <SelfLabelsSelect
              id={`thread-segment-${index}-self-label`}
              value={segment.selfLabel}
              onChange={selfLabel => update({ selfLabel })}
              disabled={disabled}
              autoWidth
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
            className={`${ui["base-component"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]} ${ui["toolbar-wrap"]}`}
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
                disabled={disabled || !!segment.videoEntry}
                previewContainerRef={imagePreviewContainerRef}
              />
              <VideoPicker
                ref={videoPickerRef}
                value={segment.videoEntry}
                onChange={entry => update({ videoEntry: entry })}
                disabled={
                  disabled || !!segment.imageEntry || !!segment.ogpResult
                }
                disabledReason={
                  segment.imageEntry
                    ? t("video.picker.exclusiveWithImage")
                    : segment.ogpResult
                      ? t("video.picker.exclusiveWithOgp")
                      : undefined
                }
                previewContainerRef={imagePreviewContainerRef}
              />
              {(segment.imageEntry || segment.videoEntry) && (
                <ThumbnailAdjustButton
                  disabled={disabled}
                  onClick={() =>
                    segment.videoEntry
                      ? videoPickerRef.current?.openCropDialog()
                      : imagePickerRef.current?.openCropDialog()
                  }
                />
              )}
              <span
                title={
                  segment.videoEntry
                    ? t("video.picker.exclusiveWithVideo")
                    : undefined
                }
                style={{ display: "inline-flex" }}
              >
                <OgpFetchButton
                  ogpFetch={ogpFetch}
                  disabled={disabled || !!segment.videoEntry}
                />
              </span>
            </div>

            <div
              className={`${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-right"]} ${ui["toolbar-wrap"]} ${ui["toolbar-auto-width"]}`}
            >
              <button
                type="button"
                className={`${ui["base-button"]} ${ui["white-button"]} ${ui["nontext-button"]} ${ui["md-button"]}`}
                aria-label={t("post.segment.addToThread")}
                title={t("post.segment.addToThread")}
                disabled={disabled || !canAddSegment}
                onClick={onAddSegment}
              >
                <img
                  src={plusIcon.src}
                  width={18}
                  height={18}
                  style={{
                    width: "var(--size-icon-button)",
                    height: "var(--size-icon-button)",
                  }}
                  alt=""
                />
              </button>
              <LanguageSelect
                id={`thread-segment-${index}-language`}
                value={segment.languageCode}
                onChange={languageCode => update({ languageCode })}
                disabled={disabled}
                autoWidth
              />
            </div>
          </div>
          {submitBlockedReason && (
            <p
              role="status"
              data-testid="video-submit-reason"
              className={styles["submit-reason"]}
            >
              {t(submitBlockedReason)}
            </p>
          )}
          <div>
            <OgpPreview ogpFetch={ogpFetch} />
            <div ref={imagePreviewContainerRef} />
          </div>
        </div>

        <div hidden={isActive} className={styles.row}>
          {avatarCol}
          <div
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
              {segment.videoEntry && (
                <img
                  className={styles["summary-thumbnail"]}
                  data-testid="segment-thumbnail"
                  src={segment.videoEntry.thumbnailPreview}
                  alt=""
                  aria-hidden
                />
              )}
              <span
                className={`${styles["summary-text"]} ${!segment.text ? styles["summary-placeholder"] : ""}`}
              >
                {segment.text
                  ? summarizeText(segment.text)
                  : t("post.segment.emptyText")}
              </span>
              {canRemove && (
                <button
                  type="button"
                  className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]} ${styles["remove-button"]}`}
                  disabled={disabled}
                  aria-label={t("post.segment.removeAria")}
                  onClick={e => {
                    e.stopPropagation()
                    revokeImageEntry(segment.imageEntry)
                    revokeVideoEntry(segment.videoEntry)
                    onRemove()
                  }}
                >
                  {t("post.segment.remove")}
                </button>
              )}
            </div>
          </div>
        </div>
      </>
    </div>
  )
}

export default Component

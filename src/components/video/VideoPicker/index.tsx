import { useT } from "@/lib/i18n/react"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"
import type { VideoEntry } from "@/components/post/ThreadComposer/segments"
import { createDefaultThumbnail } from "@/lib/image/postImageProcessing"
import {
  probeVideo,
  validateVideoFile,
  VideoProbeError,
} from "@/lib/video/probeVideo"
import { mapVideoError, VideoUploadError } from "@/lib/video/videoErrors"
import { drawVideoOverlay } from "@/lib/video/videoOverlay"
import { fetchVideoUploadToken } from "@/lib/video/videoUploadToken"
import {
  uploadVideo,
  type VideoUploadProgress,
} from "@/lib/video/videoUploader"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import icon from "@/images/video.svg"

/**
 * 動画の選択・先行アップロード・プレビューを担うコンポーネント。
 *
 * 責務と処理概要:
 * - 画像追加ボタンとは独立した、動画専用の追加ボタンを描画する。
 * - 選択直後に形式・サイズ・長さを検査し、poster と visual（再生ボタン・再生時間バッジ入り）
 *   を生成して親へ `VideoEntry` を通知し、ブラウザから動画サービスへ直接アップロードする。
 * - 進捗・完了・失敗は `VideoEntry.upload` で親へ通知する。失敗は動画の状態に閉じ、
 *   segment の他の入力には触れない。
 * - 取り外し（キャンセル）でアップロードを中断する。unmount 時も中断する。
 */

type Props = {
  value: VideoEntry | null
  onChange: (entry: VideoEntry | null) => void
  /** 画像/OGP添付済み、または投稿処理中 */
  disabled?: boolean
  /** `disabled` の理由（ボタンのツールチップに表示する） */
  disabledReason?: string
  /** プレビューを描画するポータル先（フォーム全幅を使えるコンテナ） */
  previewContainerRef?: RefObject<HTMLDivElement | null>
}

const progressText = (
  progress: VideoUploadProgress,
  t: ReturnType<typeof useT>["t"],
) =>
  progress.phase === "uploading"
    ? t("video.status.uploading", { percent: Math.round(progress.percent) })
    : t("video.status.processing", { percent: Math.round(progress.percent) })

export const Component = ({
  value,
  onChange,
  disabled = false,
  disabledReason,
  previewContainerRef,
}: Props) => {
  const { t } = useT()
  const inputId = useId()
  const reselectId = useId()
  const [notice, setNotice] = useState<PlainMessageKey | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)
  const [previewContainer, setPreviewContainer] =
    useState<HTMLDivElement | null>(null)

  // 非同期の進捗通知が古いクロージャの値で親の state を上書きしないよう、最新値を ref で持つ。
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setPreviewContainer(previewContainerRef?.current ?? null)
  }, [previewContainerRef])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const abortCurrent = () => {
    abortRef.current?.abort()
    abortRef.current = null
  }

  const startUpload = (
    file: File,
    entryBase: Omit<VideoEntry, "upload" | "alt">,
  ) => {
    abortCurrent()
    const controller = new AbortController()
    abortRef.current = controller

    const emit = (upload: VideoEntry["upload"]) => {
      // 取り外し・差し替え後の通知は捨てる
      if (abortRef.current !== controller) return
      onChangeRef.current({
        ...entryBase,
        alt: valueRef.current?.alt ?? "",
        upload,
      })
    }

    emit({
      state: "uploading",
      progress: { phase: "uploading", percent: 0 },
    })
    void uploadVideo({
      file,
      probe: entryBase,
      fetchToken: fetchVideoUploadToken,
      signal: controller.signal,
      onProgress: progress => emit({ state: "uploading", progress }),
    })
      .then(blob => emit({ state: "done", blob }))
      .catch(error => {
        if (controller.signal.aborted) return
        const code = error instanceof VideoUploadError ? error.code : "unknown"
        emit({ state: "error", messageKey: mapVideoError(code) })
      })
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setNotice(null)

    const violation = validateVideoFile(file)
    if (violation) {
      setNotice(mapVideoError(violation))
      return
    }

    setIsPreparing(true)
    let posterPreview: string | undefined
    try {
      const probe = await probeVideo(file)
      posterPreview = URL.createObjectURL(probe.posterBlob)
      const thumbnailBlob = await createDefaultThumbnail(
        [posterPreview],
        drawVideoOverlay(probe.durationSec),
      )
      startUpload(file, {
        fileName: file.name,
        width: probe.width,
        height: probe.height,
        durationSec: probe.durationSec,
        posterPreview,
        posterBlob: probe.posterBlob,
        thumbnailBlob,
      })
    } catch (error) {
      if (posterPreview) URL.revokeObjectURL(posterPreview)
      setNotice(
        mapVideoError(
          error instanceof VideoProbeError ? error.code : "unreadable",
        ),
      )
    } finally {
      setIsPreparing(false)
    }
  }

  const handleRemove = () => {
    abortCurrent()
    onChange(null)
  }

  const handleAltChange = (alt: string) => {
    if (value) onChange({ ...value, alt })
  }

  // 動画は1本だけ。添付済みの間は追加ボタンを無効にする（差し替えは取り外すか選び直す）。
  const pickerDisabled = disabled || isPreparing || value !== null
  const buttonTitle = value
    ? t("video.picker.exclusiveWithVideo")
    : disabled
      ? disabledReason
      : t("video.picker.add")
  const upload = value?.upload

  const preview = value && (
    <div className={styles.preview} data-testid="video-preview">
      <div className={styles["preview-row"]}>
        <img className={styles.poster} src={value.posterPreview} alt="" />
        <div className={styles.info}>
          <span className={styles["file-name"]}>{value.fileName}</span>
          {upload?.state === "uploading" && (
            <>
              <progress
                className={styles.progress}
                role="progressbar"
                aria-label={t("video.picker.progressAria")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(upload.progress.percent)}
                max={100}
                value={upload.progress.percent}
              />
              <p className={styles.status} role="status">
                {progressText(upload.progress, t)}
              </p>
            </>
          )}
          {upload?.state === "done" && (
            <p
              className={`${styles.status} ${styles["status-done"]}`}
              role="status"
            >
              {t("video.status.done")}
            </p>
          )}
          {upload?.state === "error" && (
            <p className={styles["status-error"]} role="alert">
              {t(upload.messageKey)}
            </p>
          )}
        </div>
      </div>
      <input
        type="text"
        className={styles["alt-input"]}
        aria-label={t("video.picker.altLabel")}
        placeholder={t("video.picker.altPlaceholder")}
        value={value.alt}
        disabled={disabled}
        onChange={event => handleAltChange(event.target.value)}
      />
      <div className={styles.actions}>
        {upload?.state === "error" && (
          <label
            htmlFor={reselectId}
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
          >
            {t("video.picker.reselect")}
          </label>
        )}
        {upload?.state === "error" && (
          <input
            id={reselectId}
            type="file"
            accept="video/mp4"
            className={styles["hidden-input"]}
            onChange={handleFileChange}
            disabled={disabled || isPreparing}
          />
        )}
        <button
          type="button"
          className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
          onClick={handleRemove}
        >
          {t("video.picker.remove")}
        </button>
      </div>
    </div>
  )

  return (
    <>
      <span title={buttonTitle} style={{ display: "inline-flex" }}>
        <label
          htmlFor={inputId}
          className={`${ui["base-button"]} ${ui["white-button"]} ${ui["nontext-button"]} ${ui["md-button"]}`}
          aria-label={t("video.picker.addAria")}
          aria-disabled={pickerDisabled}
          style={{
            cursor: pickerDisabled ? "default" : "pointer",
            opacity: pickerDisabled ? 0.5 : undefined,
          }}
        >
          <img
            src={icon.src}
            width={18}
            height={18}
            style={{
              width: "var(--size-icon-button)",
              height: "var(--size-icon-button)",
            }}
            alt=""
          />
        </label>
        <input
          id={inputId}
          type="file"
          accept="video/mp4"
          className={styles["hidden-input"]}
          onChange={handleFileChange}
          disabled={pickerDisabled}
        />
      </span>
      {notice && (
        <p className={styles.notice} role="alert">
          {t(notice)}
        </p>
      )}
      {preview &&
        (previewContainer ? createPortal(preview, previewContainer) : preview)}
    </>
  )
}

export default Component

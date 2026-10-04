import { useEffect, useRef, useState } from "react"
import { useT } from "@/lib/i18n/react"
import type { SourceVideo } from "@/lib/entry/entry"
import VideoPlayButton from "@/components/video/VideoPlayButton"
import { videoAspectOf } from "@/components/video/VideoThumbnail"
import styles from "./index.module.css"

type Props = {
  video: SourceVideo
  /** 再生失敗時に誘導する元の Bluesky 投稿の URL */
  postUrl?: string
}

type Phase = "idle" | "playing" | "error"

/**
 * Entry 詳細ページの動画プレイヤー。
 *
 * 責務と処理概要:
 * - 初期表示は poster と再生ボタンのみ。ページを開いただけでは動画データも `hls.js` も
 *   取得しない（NFR-3）。再生ボタンの操作で初めて `<video>` を作り、HLS を読み込む。
 * - Safari はネイティブ HLS、それ以外は `hls.js`（動的 import）で再生する。
 * - 再生に失敗したら、元の Bluesky 投稿へ誘導する表示にする。
 */
const VideoPlayer = ({ video, postUrl }: Props) => {
  const { t } = useT()
  const [phase, setPhase] = useState<Phase>("idle")
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<{ destroy: () => void } | null>(null)

  useEffect(() => {
    return () => {
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [])

  // `<video>` が DOM に現れた後に、ソースを接続して再生を始める。
  useEffect(() => {
    if (phase !== "playing") return
    const element = videoRef.current
    if (!element) return
    let cancelled = false

    const start = async () => {
      try {
        const { default: Hls } = await import("hls.js")
        if (cancelled) return
        if (Hls.isSupported()) {
          const hls = new Hls()
          hlsRef.current = hls
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) setPhase("error")
          })
          // hls.js は初期帯域を低く見積もり最低画質（360p）から再生を始めるため、
          // 冒頭が低解像度になる。マニフェスト取得後に最高画質から開始させる。
          // 以降の自動切替（ABR）は有効のままなので、回線が遅ければ下がる。
          hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
            hls.startLevel = data.levels.length - 1
          })
          hls.loadSource(video.playlistUrl)
          hls.attachMedia(element)
        } else if (element.canPlayType("application/vnd.apple.mpegurl")) {
          // MSE が使えない環境（iOS Safari 等）はネイティブ HLS で再生する
          element.src = video.playlistUrl
        } else {
          throw new Error("HLS is not supported")
        }
        // 自動再生がブロックされても、controls から再生できる
        await element.play().catch(() => undefined)
      } catch {
        if (!cancelled) setPhase("error")
      }
    }
    void start()
    return () => {
      cancelled = true
    }
  }, [phase, video.playlistUrl])

  return (
    <div
      className={styles.frame}
      style={{ aspectRatio: videoAspectOf(video) }}
      data-testid="video-player"
    >
      {phase === "idle" ? (
        <button
          type="button"
          className={styles["poster-button"]}
          aria-label={t("video.play")}
          onClick={() => setPhase("playing")}
        >
          <img
            className={styles.poster}
            src={video.thumbnailUrl}
            alt={video.alt}
          />
          <VideoPlayButton />
        </button>
      ) : (
        <video
          ref={videoRef}
          className={styles.video}
          controls
          playsInline
          onError={() => setPhase("error")}
          poster={video.thumbnailUrl}
          aria-label={video.alt || undefined}
        />
      )}
      {phase === "error" ? (
        <div className={styles.error} role="alert">
          <p>{t("video.playError")}</p>
          {postUrl ? (
            <a href={postUrl} target="_blank" rel="noopener noreferrer">
              {t("video.unavailable.link")}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default VideoPlayer

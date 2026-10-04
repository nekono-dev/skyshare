import { useT } from "@/lib/i18n/react"
import type { SourceVideo } from "@/lib/entry/entry"
import { videoAspectOf } from "@/components/video/VideoThumbnail"
import styles from "./index.module.css"

/**
 * 利用不可の動画（Skyshare では再生・entry 化できない動画）の表示専用部品。
 *
 * - poster を暗くし、「Skyshareでは再生できません」の文言と元の Bluesky 投稿へのリンクを重ねる。
 * - 再生ボタンや `<button>` など、再生に関わる操作要素は持たない。
 */
const VideoUnavailable = ({
  video,
  postUrl,
}: {
  video: SourceVideo
  postUrl?: string
}) => {
  const { t } = useT()
  return (
    <div
      className={styles.frame}
      style={{ aspectRatio: videoAspectOf(video) }}
      data-testid="video-unavailable"
    >
      <img
        className={styles.poster}
        src={video.thumbnailUrl}
        alt={video.alt}
        loading="lazy"
      />
      <div className={styles.shade} />
      <div className={styles.message}>
        <p className={styles.title}>{t("video.unavailable.title")}</p>
        {postUrl ? (
          <a
            className={styles.link}
            href={postUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("video.unavailable.link")}
          </a>
        ) : null}
      </div>
    </div>
  )
}

export default VideoUnavailable

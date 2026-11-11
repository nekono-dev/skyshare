/** Skyshare で再生できない動画を示し、元投稿へのリンクを提供する。 */
import { useT } from "@/components/i18n/useTranslation"
import type { SourceVideo } from "@/lib/entry/entry"
import { videoAspectOf } from "@/components/timeline/PostBody/VideoThumbnail"
import styles from "./index.module.css"

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

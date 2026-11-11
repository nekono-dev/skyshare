/**
 * タイムライン用の静的な動画サムネイルを表示する。
 * 再生時間を取得できないため、再生時間バッジは表示しない。
 */
import type { SourceVideo } from "@/lib/entry/entry"
import VideoPlayButton from "@/components/timeline/PostBody/VideoPlayButton"
import styles from "./index.module.css"

/** `aspectRatio` が無い動画の表示領域の比率 */
export const DEFAULT_VIDEO_ASPECT = "16 / 9"

export const videoAspectOf = (video: SourceVideo): string =>
  video.aspectRatio
    ? `${video.aspectRatio.width} / ${video.aspectRatio.height}`
    : DEFAULT_VIDEO_ASPECT

const VideoThumbnail = ({ video }: { video: SourceVideo }) => (
  <div
    className={styles.frame}
    style={{ aspectRatio: videoAspectOf(video) }}
    data-testid="video-thumbnail"
  >
    <img
      className={styles.poster}
      src={video.thumbnailUrl}
      alt={video.alt}
      loading="lazy"
    />
    <VideoPlayButton />
  </div>
)

export default VideoThumbnail

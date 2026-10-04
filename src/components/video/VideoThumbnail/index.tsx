import type { SourceVideo } from "@/lib/entry/entry"
import VideoPlayButton from "@/components/video/VideoPlayButton"
import styles from "./index.module.css"

/** `aspectRatio` が無い動画の表示領域の比率 */
export const DEFAULT_VIDEO_ASPECT = "16 / 9"

export const videoAspectOf = (video: SourceVideo): string =>
  video.aspectRatio
    ? `${video.aspectRatio.width} / ${video.aspectRatio.height}`
    : DEFAULT_VIDEO_ASPECT

/**
 * Timeline 用の動画の静的表示。poster の中央に再生ボタンを重ねる。
 * インタラクションを持たず、動画は再生されない。再生時間は取得できないため
 * 再生時間バッジは表示しない。
 */
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

import { VIDEO_OVERLAY_SPEC } from "@/lib/video/videoOverlay"

/**
 * 動画であることを示す再生ボタン（X の動画の再生ボタンを模した半透明の円＋白い再生記号）。
 *
 * 責務と処理概要:
 * - 色・寸法は `VIDEO_OVERLAY_SPEC`（visual の描画と同一の値）を S=1（CSS px）で使う。
 * - 装飾のため `aria-hidden`。親（`position: relative` の動画表示領域）の中心に置く。
 */
const VideoPlayButton = () => {
  const spec = VIDEO_OVERLAY_SPEC
  return (
    <span
      aria-hidden="true"
      data-testid="video-play-button"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: spec.buttonDiameter,
        height: spec.buttonDiameter,
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        background: spec.buttonFill,
        pointerEvents: "none",
      }}
    >
      <svg
        width={spec.triangleWidth}
        height={spec.triangleHeight}
        viewBox={`0 0 ${spec.triangleWidth} ${spec.triangleHeight}`}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${spec.triangleOffsetX}px), -50%)`,
        }}
      >
        <polygon
          points={`0,0 0,${spec.triangleHeight} ${spec.triangleWidth},${spec.triangleHeight / 2}`}
          fill={spec.triangleFill}
        />
      </svg>
    </span>
  )
}

export default VideoPlayButton

/**
 * 動画サムネイル上に再生記号を重ねる装飾部品。
 * 寸法と色は `VIDEO_OVERLAY_SPEC` と共有し、親領域の中央に配置する。
 */
import { VIDEO_OVERLAY_SPEC } from "@/lib/video/videoOverlay"

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

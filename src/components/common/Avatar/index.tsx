import React, { useEffect, useState } from "react"
import styles from "./index.module.css"

/**
 * ユーザーアバター画像を丸型で表示する共通コンポーネント。
 *
 * 責務と処理概要:
 * - `src` が未指定、または画像の読み込みに失敗した場合は、単色円のプレースホルダーを表示する。
 * - `size` は `24`（候補一覧などの小サイズ）と `48`（カード等の標準サイズ）のみをサポートする。
 */

export type AvatarSize = 24 | 48

type Props = {
  src?: string | null
  alt: string
  size: AvatarSize
  className?: string
  "aria-hidden"?: boolean
}

/**
 * アバター画像またはプレースホルダーを描画する。
 *
 * Input:
 * - `src`: アバター画像URL（未指定/空文字/読み込み失敗時はプレースホルダーを表示）
 * - `alt`: 画像の代替テキスト
 * - `size`: 表示サイズ（px）
 *
 * Output:
 * - 円形の `<img>`、または画像が無い/失敗した場合は円形のプレースホルダー `<div>`
 */
export const Avatar: React.FC<Props> = ({
  src,
  alt,
  size,
  className,
  ...rest
}) => {
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setLoadError(false)
  }, [src])

  const showImage = Boolean(src) && !loadError

  if (showImage) {
    return (
      <img
        src={src as string}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        aria-hidden={rest["aria-hidden"]}
        className={[styles.avatar, className].filter(Boolean).join(" ")}
        onError={() => setLoadError(true)}
      />
    )
  }

  return (
    <div
      className={[styles.placeholder, className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}

export default Avatar

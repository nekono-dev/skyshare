import React, { useEffect, useState } from "react"
import styles from "./index.module.css"
import sizeStyles from "@/styles/avatar.ui.module.css"

/**
 * ユーザーアバター画像を丸型で表示する共通コンポーネント。
 *
 * 責務と処理概要:
 * - `src` が未指定、または画像の読み込みに失敗した場合は、単色円のプレースホルダーを表示する。
 * - `size` は `sm`(候補一覧・footerアイコンなど)/`md`(カード等の標準サイズ)/`lg`(PCアカウント
 *   切り替えボタン)の3段階のみをサポートし、src/styles/avatar.ui.module.css のサイズトークンを参照する。
 */

export type AvatarSize = "sm" | "md" | "lg"

const sizeClassBySize: Record<AvatarSize, string> = {
  sm: sizeStyles["sm-avatar"],
  md: sizeStyles["md-avatar"],
  lg: sizeStyles["lg-avatar"],
}

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
 * - `size`: 表示サイズ（sm/md/lg）
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
  const sizeClassName = sizeClassBySize[size]

  if (showImage) {
    return (
      <img
        src={src as string}
        alt={alt}
        loading="lazy"
        decoding="async"
        aria-hidden={rest["aria-hidden"]}
        className={[styles.avatar, sizeClassName, className]
          .filter(Boolean)
          .join(" ")}
        onError={() => setLoadError(true)}
      />
    )
  }

  return (
    <div
      className={[styles.placeholder, sizeClassName, className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    />
  )
}

export default Avatar

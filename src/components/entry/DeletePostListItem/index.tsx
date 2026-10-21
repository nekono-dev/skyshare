/**
 * 削除予定のBluesky投稿1件分の行（投稿日時・省略本文・サムネイル）。
 *
 * 責務と処理概要:
 * - `DeletePostListDialog`が`ComponentList`の`itemComponent`として使う1要素の描画のみを担う。
 * - 本文は最大3行で省略し、空なら「（本文なし）」を表示する。
 * - 画像は先頭4枚までサムネイル表示し、超過分は「+N」で示す。画像が無ければサムネイル欄を描画しない。
 * - 動画投稿（`video`）は poster を同じ大きさで1枚表示し、小さな再生マークを重ねて動画と分かるようにする。
 *   利用不可の動画（`unsupportedVideo`）は削除対象の投稿に含まれ得るため、同様に poster のみ表示する。
 */
import { useFormat, useT } from "@/lib/i18n/react"
import React from "react"
import type { TimelinePost } from "@/lib/entry/posts"
import type { SourceVideo } from "@/lib/entry/entry"
import styles from "./index.module.css"

type Props = {
  item: TimelinePost
}

/** 1投稿あたりに並べるサムネイルの最大枚数。超過分は「+N」で示す。 */
const MAX_THUMBNAILS = 4

/**
 * 投稿の動画（再生可能・利用不可を問わず）を返す。動画が無ければ `undefined`。
 *
 * Input: `item` / Output: `SourceVideo | undefined`
 * 例: `videoOf({ video: v, ... })` → `v`
 */
const videoOf = (item: TimelinePost): SourceVideo | undefined =>
  item.video ?? item.unsupportedVideo

/**
 * 削除予定投稿1件の行を描画する。
 *
 * Input:
 * - `item`: 削除予定の投稿（`text`・`indexedAt`・`images`を使用）
 *
 * Output:
 * - 投稿日時・本文・サムネイルを持つ`article`
 *
 * 例:
 * - 入力: `{ item: { text: "こんにちは", indexedAt: "2026-01-01T00:00:00.000Z", images: [] } }`
 * - 出力: 日時と本文「こんにちは」のみの行
 */
export const Component: React.FC<Props> = ({ item }) => {
  const { t } = useT()
  const { formatDateTime } = useFormat()
  return (
    <article className={styles["post-item"]}>
      <time className={styles["post-date"]} dateTime={item.indexedAt}>
        {formatDateTime(item.indexedAt, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </time>
      {item.text.length > 0 ? (
        <p className={styles["post-text"]}>{item.text}</p>
      ) : (
        <p className={styles["post-empty-text"]}>{t("entry.noText")}</p>
      )}
      {videoOf(item) ? (
        <div className={styles["post-thumbnails"]}>
          <span className={styles["post-video-thumbnail"]}>
            <img
              className={styles["post-thumbnail"]}
              src={videoOf(item)!.thumbnailUrl}
              alt={videoOf(item)!.alt}
              loading="lazy"
            />
            <span
              className={styles["post-video-mark"]}
              aria-hidden="true"
              data-testid="delete-post-video-mark"
            />
          </span>
        </div>
      ) : null}
      {item.images.length > 0 ? (
        <div className={styles["post-thumbnails"]}>
          {item.images.slice(0, MAX_THUMBNAILS).map((image, index) => (
            <img
              key={`${image.cid}-${index}`}
              className={styles["post-thumbnail"]}
              src={image.url}
              alt={image.alt}
              loading="lazy"
            />
          ))}
          {item.images.length > MAX_THUMBNAILS ? (
            <span className={styles["post-thumbnail-more"]}>
              +{item.images.length - MAX_THUMBNAILS}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export default Component

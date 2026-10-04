/**
 * Entry詳細ヘッダーの「投稿日時: ...」表示。
 *
 * 責務と処理概要:
 * - `.astro` ではサーバー側で固定の言語に整形されてしまい、表示言語を切り替えても
 *   書き換わらないため、React で描画して言語変更に追従させる。
 * - 日時が無い・解釈できない場合は「no data」を表示する。
 */
import { useFormat, useT } from "@/lib/i18n/react"

type Props = {
  /** ISO文字列。空・不正値の場合は日時なしとして扱う */
  createdAt: string
}

export const EntryPostedAt = ({ createdAt }: Props) => {
  const { t } = useT()
  const { formatDateTime } = useFormat()
  const dateText = createdAt
    ? formatDateTime(createdAt, { dateStyle: "medium", timeStyle: "short" })
    : ""
  return (
    <>
      {t("entry.detail.postedAt", {
        date: dateText || t("entry.detail.noDate"),
      })}
    </>
  )
}

export default EntryPostedAt

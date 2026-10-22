import { useCallback, useEffect, useState } from "react"
import { deleteSchedule, listSchedules } from "@/client/openapi/client"
import type { ListSchedules200ItemsItem } from "@/client/openapi/model"
import ConfirmDialog from "@/components/common/ConfirmDialog"
import Loading from "@/components/common/Loading"
import { formatDateTime } from "@/lib/i18n/format"
import { useLocale, useT } from "@/lib/i18n/react"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import {
  failureMessageKey,
  scheduleErrorKey,
} from "@/lib/schedule/scheduleErrorKey"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

/**
 * 下書き・予約の画面の「予約」タブの中身。
 *
 * 責務と処理概要:
 * - タブが選ばれるたびに予約の一覧を取得し、待機中と履歴（実行中・失敗）に分けて、
 *   それぞれ実行時刻の昇順（API の並び順）に、状態・実行時刻・本文の冒頭・投稿の件数を表示する。
 *   成功した予約は履歴に残らないため表示しない。
 * - 待機中の行を押すと `onSelect` を呼び、呼び出し側（投稿フォーム）が内容を書き戻して編集を始める。
 * - 失敗の予約には分類コードに対応する文言を表示し、「フォームに書き戻す」で `onSelect` を呼ぶ。
 *   失敗の履歴は確認の後に削除できる。
 * - 続きがあるときだけ「さらに表示」を置く。
 */

type Item = ListSchedules200ItemsItem

type Props = {
  /** タブが選ばれているか。選ばれるたびに一覧を取得し直す */
  active: boolean
  /** 待機中の予約、または失敗の予約の書き戻しが選ばれたとき */
  onSelect: (id: string) => void
}

export const Component = ({ active, onSelect }: Props) => {
  const { t } = useT()
  const locale = useLocale()
  const [items, setItems] = useState<Item[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [errorKey, setErrorKey] = useState<PlainMessageKey | "">("")
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)

  /** 一覧を取得する。`next` があれば続きを末尾に足し、無ければ置き換える */
  const load = useCallback(async (next?: string) => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const res = await listSchedules({ limit: 20, cursor: next })
      if (res.status !== 200) {
        setLoadFailed(true)
        return
      }
      setItems(current =>
        next ? [...current, ...res.data.items] : res.data.items,
      )
      setCursor(res.data.cursor)
    } catch {
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    setErrorKey("")
    void load()
  }, [active, load])

  /** 終了した予約を履歴から削除する。失敗したら文言を表示し、競合なら一覧を取り直す */
  const remove = async (item: Item) => {
    setErrorKey("")
    try {
      const res = await deleteSchedule(item.id)
      if (res.status !== 200) {
        setErrorKey(
          scheduleErrorKey(
            res.status,
            "error" in res.data ? res.data.error : undefined,
          ),
        )
        if (res.status === 409) void load()
        return
      }
      setItems(current => current.filter(i => i.id !== item.id))
    } catch {
      setErrorKey("error.network")
    }
  }

  const btn = (variant: "white" | "blue") =>
    `${ui["base-button"]} ${ui["text-button"]} ${ui[`${variant}-button`]}`

  const pending = items.filter(item => item.status === "pending")
  const history = items.filter(item => item.status !== "pending")

  /** 1行の状態・実行時刻・件数・本文の冒頭 */
  const summary = (item: Item) => (
    <>
      <span className={styles.meta}>
        <strong>{t(`schedule.status.${item.status}`)}</strong>
        <time dateTime={item.runAt}>{formatDateTime(item.runAt, locale)}</time>
        <span>{t("schedule.list.postCount", { count: item.postCount })}</span>
      </span>
      <span className={styles.preview}>{item.preview}</span>
    </>
  )

  return (
    <div data-testid="schedule-list">
      <div className={styles.error} role="alert" aria-live="polite">
        {errorKey ? t(errorKey) : ""}
      </div>

      {loadFailed && (
        <div className={styles.error} role="alert">
          {t("schedule.list.loadFailed")}{" "}
          <button
            type="button"
            className={btn("white")}
            onClick={() => void load()}
          >
            {t("schedule.list.reload")}
          </button>
        </div>
      )}

      {!loading && !loadFailed && items.length === 0 && (
        <p>{t("schedule.list.empty")}</p>
      )}

      {pending.length > 0 && (
        <>
          <h3 className={styles["section-title"]}>
            {t("schedule.list.pendingTitle")}
          </h3>
          <ul className={styles.list}>
            {pending.map(item => (
              <li key={item.id} data-status={item.status}>
                <button
                  type="button"
                  className={`${ui["base-card"]} ${styles.item} ${styles["item-button"]}`}
                  aria-label={`${t("schedule.list.edit")}: ${item.preview}`}
                  onClick={() => onSelect(item.id)}
                >
                  {summary(item)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {history.length > 0 && (
        <>
          <h3 className={styles["section-title"]}>
            {t("schedule.list.historyTitle")}
          </h3>
          <ul className={styles.list}>
            {history.map(item => (
              <li
                key={item.id}
                className={`${ui["base-card"]} ${styles.item}`}
                data-status={item.status}
              >
                {summary(item)}
                {item.status === "failed" && (
                  <div className={styles.error}>
                    {t(failureMessageKey(item.lastError))}
                  </div>
                )}
                {item.status === "failed" && (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={btn("blue")}
                      onClick={() => onSelect(item.id)}
                    >
                      {t("schedule.list.restore")}
                    </button>
                    <button
                      type="button"
                      className={btn("white")}
                      onClick={() => setDeleteTarget(item)}
                    >
                      {t("schedule.list.deleteHistory")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {loading && <Loading />}
      {cursor && !loading && (
        <button
          type="button"
          className={btn("white")}
          onClick={() => void load(cursor)}
        >
          {t("schedule.list.more")}
        </button>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        ariaLabel={t("schedule.list.deleteTitle")}
        title={t("schedule.list.deleteTitle")}
        message={t("schedule.list.deleteMessage")}
        confirmLabel={t("schedule.list.deleteConfirm")}
        confirmVariant="red"
        onConfirm={async () => {
          const target = deleteTarget
          setDeleteTarget(null)
          if (target) await remove(target)
        }}
      />
    </div>
  )
}
export default Component

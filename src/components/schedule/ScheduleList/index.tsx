import React, { useCallback, useEffect, useState } from "react"
import {
  deleteSchedule,
  deleteScheduleCredential,
  getScheduleCredential,
  listSchedules,
} from "@/client/openapi/client"
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
 * 予約の一覧と、予約用の認証情報の状態を表示し、取消・履歴の削除・認証情報の削除を行う。
 *
 * 責務と処理概要:
 * - 実行時刻の昇順（API の並び順）に、状態・実行時刻・本文の冒頭・投稿の件数を表示する。
 * - 待機中の予約は確認の後に取り消す。投稿済み・失敗の予約は履歴として削除する。
 * - 失敗の予約には分類コードに対応する文言を、投稿済みの予約には投稿へのリンクを表示する。
 * - 認証情報は、待機中の予約がないときだけ削除できる。
 */

type Item = ListSchedules200ItemsItem

/** `at://{did}/app.bsky.feed.post/{rkey}` を bsky.app の投稿の URL に変換する。 */
export const resultUriToUrl = (uri: string): string | null => {
  const m = uri.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/)
  return m ? `https://bsky.app/profile/${m[1]}/post/${m[2]}` : null
}

export const Component = () => {
  const { t } = useT()
  const locale = useLocale()
  const [items, setItems] = useState<Item[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [registered, setRegistered] = useState<boolean | null>(null)
  const [errorKey, setErrorKey] = useState<PlainMessageKey | "">("")
  const [cancelTarget, setCancelTarget] = useState<Item | null>(null)

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

  const loadCredential = useCallback(async () => {
    try {
      const res = await getScheduleCredential()
      setRegistered(res.status === 200 ? res.data.registered : null)
    } catch {
      setRegistered(null)
    }
  }, [])

  useEffect(() => {
    void load()
    void loadCredential()
  }, [load, loadCredential])

  const hasActive = items.some(
    item => item.status === "pending" || item.status === "running",
  )

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
        // 実行が始まっていた場合などに備えて、最新の状態を取り直す
        if (res.status === 409) void load()
        return
      }
      setItems(current => current.filter(i => i.id !== item.id))
      void loadCredential()
    } catch {
      setErrorKey("error.network")
    }
  }

  const removeCredential = async () => {
    setErrorKey("")
    try {
      const res = await deleteScheduleCredential()
      if (res.status !== 200) {
        setErrorKey(
          scheduleErrorKey(
            res.status,
            "error" in res.data ? res.data.error : undefined,
          ),
        )
        return
      }
      setRegistered(false)
    } catch {
      setErrorKey("error.network")
    }
  }

  const btn = (variant: "white" | "blue" | "red") =>
    `${ui["base-button"]} ${ui["text-button"]} ${ui[`${variant}-button`]}`

  return (
    <div>
      <h1 className={ui.subject}>{t("schedule.list.title")}</h1>

      {registered !== null && (
        <div className={`${ui["base-card"]} ${styles.item}`}>
          <div className={styles.meta}>
            <span>
              {registered
                ? t("schedule.credential.registered")
                : t("schedule.credential.notRegistered")}
            </span>
            {registered && (
              <button
                type="button"
                className={btn("white")}
                disabled={hasActive}
                onClick={() => void removeCredential()}
              >
                {t("schedule.credential.delete")}
              </button>
            )}
          </div>
          {registered && hasActive && (
            <span className={styles.meta}>
              {t("schedule.credential.deleteBlocked")}
            </span>
          )}
        </div>
      )}

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

      <ul className={styles.list}>
        {items.map(item => {
          const url = item.resultUri ? resultUriToUrl(item.resultUri) : null
          return (
            <li
              key={item.id}
              className={`${ui["base-card"]} ${styles.item}`}
              data-status={item.status}
            >
              <div className={styles.meta}>
                <strong>{t(`schedule.status.${item.status}`)}</strong>
                <time dateTime={item.runAt}>
                  {formatDateTime(item.runAt, locale)}
                </time>
                <span>
                  {t("schedule.list.postCount", { count: item.postCount })}
                </span>
              </div>
              <p className={styles.preview}>{item.preview}</p>
              {item.status === "failed" && (
                <div className={styles.error}>
                  {t(failureMessageKey(item.lastError))}
                </div>
              )}
              <div className={styles.actions}>
                {item.status === "posted" && url && (
                  <a href={url} className={btn("blue")}>
                    {t("schedule.list.viewPost")}
                  </a>
                )}
                {item.status === "pending" && (
                  <button
                    type="button"
                    className={btn("white")}
                    onClick={() => setCancelTarget(item)}
                  >
                    {t("schedule.list.cancel")}
                  </button>
                )}
                {(item.status === "posted" || item.status === "failed") && (
                  <button
                    type="button"
                    className={btn("white")}
                    onClick={() => void remove(item)}
                  >
                    {t("schedule.list.deleteHistory")}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

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
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        ariaLabel={t("schedule.list.cancelTitle")}
        title={t("schedule.list.cancelTitle")}
        message={t("schedule.list.cancelMessage")}
        confirmLabel={t("schedule.list.cancelConfirm")}
        confirmVariant="red-strong"
        onConfirm={async () => {
          const target = cancelTarget
          setCancelTarget(null)
          if (target) await remove(target)
        }}
      />
    </div>
  )
}
export default Component

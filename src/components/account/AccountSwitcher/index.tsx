/**
 * 複数アカウント切り替え用のカード一覧コンポーネント。
 *
 * 責務と処理概要:
 * - マウント時に `GET /v2/bsky/session` を叩き、アクティブアカウント＋プール中の非アクティブアカウントを一覧取得する。
 * - `ComponentList` でカード（`AccountCard`）を並べ、カード全体クリックでアカウント切り替え(`PUT /v2/bsky/session`)、
 *   カード内の「ログアウト」ボタン押下でログアウト(`DELETE /v2/bsky/session/{did}`)を行う。
 * - セッショントークンはサーバー側 HttpOnly cookie 内にのみ存在し、このコンポーネントは
 *   `did`/`handle`/`avatarUrl` 等の表示用メタデータしか扱わない。
 */
import { useCallback, useEffect, useState } from "react"
import ComponentList from "@/components/common/ComponentList"
import {
  getSession,
  updateSession,
  deleteSession,
} from "@/client/openapi/client"
import type { GetSession200AccountsItem } from "@/client/openapi/model"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

export type AccountItem = GetSession200AccountsItem

type AccountCardProps = {
  item: AccountItem
  onSwitch: (item: AccountItem) => void | Promise<void>
  onLogout: (item: AccountItem) => void | Promise<void>
  /** 直近の切り替えでセッション切れと判定された場合に true */
  needsReauth?: boolean
}

/**
 * アカウント1件分のカードを描画する。
 *
 * Input:
 * - `item`: アカウント情報（did/handle/displayName/avatarUrl/isActive）
 * - `onSwitch`: カード全体クリック時（アクティブなカードでは無効）のハンドラ
 * - `onLogout`: 「ログアウト」ボタン押下時のハンドラ
 *
 * Output:
 * - アバター・表示名・handle・ログアウトボタンを持つカード
 *
 * 例:
 * - 入力: `{ item: { did, handle, isActive: false } }`
 * - 出力: クリックで切り替え可能なカード
 */
const AccountCard = ({
  item,
  onSwitch,
  onLogout,
  needsReauth,
}: AccountCardProps) => {
  const canSwitch = !item.isActive

  const activate = () => {
    if (!canSwitch) return
    void onSwitch(item)
  }

  return (
    <div
      role={canSwitch ? "button" : undefined}
      tabIndex={canSwitch ? 0 : undefined}
      className={`${ui["base-card"]} ${styles.card} ${canSwitch ? ui["card-select"] : ui["card-muted"]}`}
      onClick={activate}
      onKeyDown={event => {
        if (!canSwitch) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          activate()
        }
      }}
    >
      {item.avatarUrl ? (
        <img
          className={styles.avatar}
          src={item.avatarUrl}
          alt={item.displayName ?? item.handle}
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className={styles["avatar-placeholder"]} aria-hidden="true" />
      )}

      <div className={styles.meta}>
        <div className={styles["name-row"]}>
          <strong>{item.displayName ?? item.handle}</strong>
          {item.isActive ? (
            <span className={styles["active-badge"]}>使用中</span>
          ) : null}
          {needsReauth ? (
            <span className={styles["reauth-badge"]}>要再ログイン</span>
          ) : null}
        </div>
        <span className={styles.handle}>@{item.handle}</span>
      </div>

      <button
        type="button"
        className={`${ui["base-button"]} ${ui["text-button"]} ${ui["red-button"]} ${styles["logout-button"]}`}
        onClick={event => {
          // カード全体の onClick（切り替え）を発火させない。
          event.stopPropagation()
          void onLogout(item)
        }}
      >
        ログアウト
      </button>
    </div>
  )
}

type ComponentProps = {
  /** 切り替え先アカウントのセッションが失効していた場合に呼ばれる。再ログイン導線は呼び出し側が用意する。 */
  onReauthRequired?: (item: AccountItem) => void
}

/**
 * アカウント一覧を取得・表示し、切り替え/ログアウト操作を提供する。
 *
 * Input:
 * - `onReauthRequired`: 切り替え先のセッションが失効していた場合の通知先
 *
 * Output:
 * - 読み込み中/エラー/空/一覧のいずれかの状態を描画する JSX
 *
 * 例:
 * - 出力: アカウントカードの一覧（アクティブなカードには「使用中」バッジ）
 */
export const Component = ({ onReauthRequired }: ComponentProps = {}) => {
  const [accounts, setAccounts] = useState<AccountItem[]>([])
  const [loading, setLoading] = useState(true)
  // 初回一覧取得の失敗（一覧全体をエラー表示に置き換える）
  const [loadError, setLoadError] = useState("")
  // 切り替え/ログアウト操作の失敗（一覧は表示したままインライン表示する）
  const [actionError, setActionError] = useState("")
  // 直近の切り替えでセッション切れと判定されたアカウントの did（カードへのバッジ表示用）
  const [invalidDid, setInvalidDid] = useState<string | null>(null)

  /**
   * `GET /v2/bsky/session` を呼び出し、アカウント一覧を再取得する。
   *
   * 処理の趣旨:
   * - ログアウト後の再描画にも使うため、初回読み込みと共通化する。
   * - Cookie 自体が無い、またはプール・アクティブとも空でサーバが401を返す場合は
   *   「そもそもこの端末にログイン中のアカウントが無い」ことを意味するため、この画面に
   *   留まらせず `/login/` へ遷移させる（`/accounts/` への直接アクセス・全アカウント
   *   ログアウト後の再取得のいずれもこの分岐を通る）。
   *
   * Output:
   * - 取得成功時: 最新のアカウント一覧
   * - 401時: `/login/` へ遷移し、`undefined`
   * - その他の取得失敗時: `undefined`
   */
  const load = useCallback(async (): Promise<AccountItem[] | undefined> => {
    setLoading(true)
    setLoadError("")
    try {
      const res = await getSession()
      if (res.status === 401) {
        window.location.href = "/login/"
        return undefined
      }
      if (res.status !== 200) {
        setAccounts([])
        setLoadError("アカウント一覧の取得に失敗しました。")
        return undefined
      }
      setAccounts(res.data.accounts)
      return res.data.accounts
    } catch (err) {
      console.error(err)
      setLoadError("サーバへ接続できませんでした。")
      return undefined
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * カード選択時にアカウントを切り替える。
   *
   * 処理の趣旨:
   * - `PUT /v2/bsky/session` で対象 did をアクティブへ昇格させ、成功したらページを再読み込みして
   *   以降のリクエストが新しいアクティブアカウントで行われるようにする。
   * - 切り替え先のセッションが atproto 側で失効している場合、API は 401 を返す。
   *   その場合はページ遷移せず、`onReauthRequired` で呼び出し側に再ログインを委ねる。
   *
   * Input:
   * - `item`: 切り替え先アカウント
   *
   * Output:
   * - 返り値なし（成功時はページ遷移、失敗時はエラー表示）
   */
  const handleSwitch = async (item: AccountItem) => {
    setActionError("")
    try {
      const res = await updateSession({ did: item.did })
      if (res.status === 401) {
        setInvalidDid(item.did)
        onReauthRequired?.(item)
        return
      }
      if (res.status !== 200) {
        setActionError("アカウントの切り替えに失敗しました。")
        return
      }
      window.location.href = "/"
    } catch (err) {
      console.error(err)
      setActionError("サーバへ接続できませんでした。")
    }
  }

  /**
   * カード内ログアウトボタン押下時にアカウントをログアウトする。
   *
   * 処理の趣旨:
   * - `DELETE /v2/bsky/session/{did}` を呼び出し、成功したら一覧を再取得して表示を更新する。
   * - 再取得の結果、ログイン中のアカウントが0件になった（＝全アカウントからログアウトした）場合、
   *   または再取得自体に失敗した場合は、この画面に留まっても操作できることがないため
   *   `/login/` へフォールバックする。
   *
   * Input:
   * - `item`: ログアウト対象アカウント
   *
   * Output:
   * - 返り値なし（成功時は一覧再取得または `/login/` へ遷移、失敗時はエラー表示）
   */
  const handleLogout = async (item: AccountItem) => {
    setActionError("")
    try {
      const res = await deleteSession(item.did)
      if (res.status !== 200) {
        setActionError("ログアウトに失敗しました。")
        return
      }
      const remaining = await load()
      if (!remaining || remaining.length === 0) {
        window.location.href = "/login/"
      }
    } catch (err) {
      console.error(err)
      setActionError("サーバへ接続できませんでした。")
    }
  }

  if (loading) {
    return <p className={styles.state}>読み込み中…</p>
  }

  if (loadError) {
    return (
      <p className={`${styles.state} ${styles["error-state"]}`}>{loadError}</p>
    )
  }

  if (accounts.length === 0) {
    return <p className={styles.state}>ログイン中のアカウントがありません。</p>
  }

  return (
    <>
      {actionError ? (
        <p className={`${styles.state} ${styles["error-state"]}`}>
          {actionError}
        </p>
      ) : null}
      <ComponentList
        itemComponent={AccountCard}
        getItemProps={item => ({
          onSwitch: handleSwitch,
          onLogout: handleLogout,
          needsReauth: item.did === invalidDid,
        })}
        getItemKey={item => item.did}
        className={styles.list}
        items={accounts}
      />
    </>
  )
}

export default Component

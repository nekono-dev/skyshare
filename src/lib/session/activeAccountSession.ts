/**
 * アクティブアカウント情報を取得し、未認証状態と進行中の要求をタブ内で共有する。
 *
 * - sessionStorage の未認証記録でゲスト表示中の重複した 401 要求を避け、ログイン成功時に記録を消す。
 */
import { getSession, type getSessionResponse } from "@/client/openapi/client"

export type ActiveAccountInfo = {
    avatarUrl: string | null
    did: string | null
}

let inflight: Promise<getSessionResponse> | null = null

const UNAUTHENTICATED_STORAGE_KEY = "skyshare:session-unauthenticated"

/**
 * 直近の`getSessionOnce`で未ログイン（401）と判明済みかどうか。
 * Timeline/EntryListが、`getEntries`/`getSkyshareEntries`自体の401すら
 * 避けてゲスト表示へ直行するために参照する。
 */
export const isSessionKnownUnauthenticated = (): boolean => {
    if (typeof window === "undefined") return false
    try {
        return (
            window.sessionStorage.getItem(UNAUTHENTICATED_STORAGE_KEY) === "1"
        )
    } catch {
        return false
    }
}

const markUnauthenticated = (): void => {
    if (typeof window === "undefined") return
    try {
        window.sessionStorage.setItem(UNAUTHENTICATED_STORAGE_KEY, "1")
    } catch {
        // sessionStorageが使えない環境（プライベートモード等）では諦める
    }
}

/**
 * ログイン成功時（LoginForm/AccountSwitcherのアカウント切り替え）に呼び出し、
 * 「未ログイン」記録を消す。以降のgetSessionOnceは実リクエストを行う。
 */
export const clearKnownUnauthenticated = (): void => {
    if (typeof window === "undefined") return
    try {
        window.sessionStorage.removeItem(UNAUTHENTICATED_STORAGE_KEY)
    } catch {
        // no-op
    }
}

/**
 * `GET /v2/bsky/session` を叩く。同時に複数回呼ばれても実際のリクエストは1回のみ。
 * AccountSwitcher・Timeline・PostPage が個別に取得して同じ情報を二重に取得するのを避けるため、重なった呼び出しは同一の Promise を返し、取得タイミングを揃える。
 * ステータスコードを含む生のレスポンスが必要な呼び出し元（401判定など）向け。
 * 直近で未ログインと判明済みの場合は、実リクエストを送らず合成の401レスポンスを返す。
 */
export const getSessionOnce = (): Promise<getSessionResponse> => {
    if (!inflight) {
        if (isSessionKnownUnauthenticated()) {
            return Promise.resolve({
                status: 401,
                data: { error: "unauthenticated" },
                headers: new Headers(),
            } satisfies getSessionResponse)
        }

        inflight = getSession()
            .then(res => {
                if (res.status === 401) {
                    markUnauthenticated()
                } else if (res.status === 200) {
                    clearKnownUnauthenticated()
                }
                return res
            })
            .catch(err => {
                inflight = null
                throw err
            })
    }
    return inflight
}

/**
 * アクティブアカウントのアイコン・didのみが必要な呼び出し元向けのショートカット。
 * 内部的には getSessionOnce のキャッシュを共有する。
 */
export const getActiveAccountInfo = async (): Promise<ActiveAccountInfo> => {
    const res = await getSessionOnce()
    if (res.status !== 200) return { avatarUrl: null, did: null }

    const active = res.data.accounts.find(account => account.isActive)
    return {
        avatarUrl: active?.avatarUrl ?? null,
        did: active?.did ?? null,
    }
}

/**
 * アクティブアカウントの表示名（未設定ならhandle）を返す。取得できなければ null。
 * skyshare entryの既定heading組み立て用。getSessionOnce のキャッシュを共有する。
 */
export const getActiveAccountDisplayName = async (): Promise<string | null> => {
    const res = await getSessionOnce()
    if (res.status !== 200) return null

    const active = res.data.accounts.find(account => account.isActive)
    return active ? active.displayName || active.handle : null
}

/**
 * アクティブアカウントのハンドルを返す。取得できなければ null。
 * 予約用の認証情報の登録フォームで、ユーザー名欄の初期値に使う。
 */
export const getActiveAccountHandle = async (): Promise<string | null> => {
    const res = await getSessionOnce()
    if (res.status !== 200) return null

    const active = res.data.accounts.find(account => account.isActive)
    return active?.handle ?? null
}

/**
 * キャッシュを破棄する。ページ遷移（astro:page-load）等、セッション状態が
 * 変わり得るタイミングで呼び出し、次回取得を再度ネットワークから行わせる。
 */
export const resetActiveAccountInfoCache = (): void => {
    inflight = null
}

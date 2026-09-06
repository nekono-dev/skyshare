/**
 * アクティブアカウント（アイコン・did）取得の共有キャッシュ。
 *
 * 責務と処理概要:
 * - AccountSwitcher(syncAccountAvatar.ts)・Timeline・PostPageが個別に
 *   getSessionを叩いて同じ情報を二重取得していた問題を解消するため、
 *   進行中のリクエストを1本にまとめて共有する。
 * - 呼び出しタイミングが重なった場合は同一のPromiseを返すことで、
 *   取得タイミングを揃えつつネットワークリクエストの重複を防ぐ。
 * - 未ログイン状態（401）はタブ内で頻繁には変化しないため、一度確認できたら
 *   sessionStorageへ記録し、ページ遷移（astro:page-load）のたびに毎回401を
 *   叩き直さないようにする（`?guest`表示時に401が大量発生する問題への対策）。
 *   ログイン成功時（LoginForm/AccountSwitcher）は`clearKnownUnauthenticated`で
 *   このマークを消し、次回から実リクエストを行わせる。
 */
import { getSession, type getSessionResponse } from "@/client/openapi/client"

export type ActiveAccountInfo = {
    avatarUrl: string | null
    did: string | null
}

let inflight: Promise<getSessionResponse> | null = null

const UNAUTHENTICATED_STORAGE_KEY = "skyshare:session-unauthenticated"

const isKnownUnauthenticated = (): boolean => {
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
 * ステータスコードを含む生のレスポンスが必要な呼び出し元（401判定など）向け。
 * 直近で未ログインと判明済みの場合は、実リクエストを送らず合成の401レスポンスを返す。
 */
export const getSessionOnce = (): Promise<getSessionResponse> => {
    if (!inflight) {
        if (isKnownUnauthenticated()) {
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
 * キャッシュを破棄する。ページ遷移（astro:page-load）等、セッション状態が
 * 変わり得るタイミングで呼び出し、次回取得を再度ネットワークから行わせる。
 */
export const resetActiveAccountInfoCache = (): void => {
    inflight = null
}

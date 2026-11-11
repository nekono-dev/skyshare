/**
 * 非アクティブアカウントの追加・置換と、Cookie プールの上限を判断する。
 *
 * - 最大 4 件に制限し、アクティブ 1 件と合わせた Cookie ヘッダーがブラウザと Workers のサイズ制約に収まるようにする。
 */

import {
    sessionIdentity,
    toPooledAccount,
    type PooledAccount,
    type StoredSession,
} from "./model"

/**
 * `atp_account_<n>` の枠の数（プールに保持できる非アクティブアカウント数の上限）。
 * アクティブな1件と合わせて、複数アカウント機能全体で扱える最大アカウント数は `MAX_POOLED_ACCOUNTS + 1` になる。
 * 1リクエストの Cookie ヘッダーの大きさ（ブラウザ/Cloudflare Workers のヘッダサイズ制約）を踏まえた保守的な値。
 */
export const MAX_POOLED_ACCOUNTS = 4

/**
 * プール配列へアカウントを追加/更新する（同一 `did` は上書き）。
 *
 * Input:
 * - `pool`: 既存のプール一覧
 * - `account`: 追加/更新したいアカウント
 *
 * Output:
 * - 更新後のプール一覧（`account` は末尾に配置）
 */
export function upsertPooledAccount(
    pool: PooledAccount[],
    account: PooledAccount,
): PooledAccount[] {
    const { did } = sessionIdentity(account)
    return [...pool.filter(item => sessionIdentity(item).did !== did), account]
}

/**
 * 新しいセッションをアクティブにしたときの、プールの一覧を決める（追加ログイン・OAuth のログインで共通）。
 *
 * 処理の趣旨:
 * - 新しいアカウントがプールにあれば、アクティブへ昇格させるため除く。
 * - 別のアカウントがアクティブなら、そのセッションをプールへ退避する。プールが上限なら null。
 * - 同じアカウントでの再ログインは、トークンの更新とみなして退避しない。
 *
 * Input:
 * - `current`: 現在のアクティブのセッション（無ければ undefined）
 * - `pool`: 現在のプール
 * - `incoming`: 新しくアクティブにするセッション
 *
 * Output: 新しいプール。上限で退避できなければ null
 *
 * 例:
 * - 入力: `(A, [], B)` → 出力: `[A]`
 * - 入力: `(A, [C, D, E, F], B)` → 出力: `null`
 */
export function admitSession(
    current: StoredSession | undefined,
    pool: PooledAccount[],
    incoming: StoredSession,
): PooledAccount[] | null {
    const { did } = sessionIdentity(incoming)
    const rest = pool.filter(account => sessionIdentity(account).did !== did)
    if (!current || sessionIdentity(current).did === did) return rest
    if (rest.length >= MAX_POOLED_ACCOUNTS) return null
    return upsertPooledAccount(rest, toPooledAccount(current))
}

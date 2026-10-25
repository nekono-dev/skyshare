/**
 * 予約投稿の登録状態のヒント cookie。
 *
 * 責務と処理概要:
 * - 登録状態（登録の有無・再度の許可の要否・許可の有効期限の目安）を、クライアントが読める cookie に
 *   保持する。ページを開くたびに D1 へ問い合わせず、初期表示に使うためのもの。
 * - 値は表示のヒントにすぎず、権限を与えない。予約の作成・置き換えはサーバーが認証情報を再検証する。
 *   そのため署名はせず、クライアントの JavaScript から読めるようにする（`HttpOnly` を付けない）。
 * - ヒントはアカウントに結び付けない。アカウントが変わる操作（ログイン・切り替え・削除・認可の完了・予約投稿の無効化）の
 *   応答で失効させ、クライアントは次の表示で改めて問い合わせる。
 * - 書き込み（Set-Cookie の組み立て）はサーバー、読み取り（Cookie の解釈）はクライアントが使う。
 *   どちらも `@atproto/*` に依存しない。
 */

export const SCHEDULE_HINT_COOKIE_NAME = "skyshare_schedule"

/** ヒントを保つ秒数（7日）。予約の UI を開くたびに取り直すため、長くしても表示がずれ続けない */
export const SCHEDULE_HINT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

export type ScheduleHint = {
    registered: boolean
    reauthRequired: boolean
    /** 許可の有効期限の目安（ISO 8601）。無い・再度の許可が必要なときは無い */
    expiresAt?: string
}

/**
 * ヒントを cookie の値にする。
 *
 * Example: `{ registered: true, reauthRequired: false }` → `%7B%22registered%22%3Atrue...`
 */
export const serializeScheduleHint = (hint: ScheduleHint): string =>
    encodeURIComponent(JSON.stringify(hint))

/**
 * cookie の値をヒントに戻す。壊れた値・形が違う値は undefined にする。
 *
 * 想定する入力形状: `{ registered: boolean, reauthRequired: boolean, expiresAt?: string }` を
 * JSON にして URI エンコードした文字列
 *
 * Input: `value` — cookie の値（デコード前）
 * Output: ヒント。解釈できなければ undefined
 */
export const parseScheduleHint = (
    value: string | undefined,
): ScheduleHint | undefined => {
    if (!value) return undefined
    try {
        const raw: unknown = JSON.parse(decodeURIComponent(value))
        if (typeof raw !== "object" || raw === null) return undefined
        const { registered, reauthRequired, expiresAt } = raw as Record<
            string,
            unknown
        >
        if (typeof registered !== "boolean") return undefined
        if (typeof reauthRequired !== "boolean") return undefined
        if (expiresAt !== undefined && typeof expiresAt !== "string") {
            return undefined
        }
        return {
            registered,
            reauthRequired,
            ...(expiresAt === undefined ? {} : { expiresAt }),
        }
    } catch {
        return undefined
    }
}

/**
 * Cookie ヘッダ（`document.cookie` を含む）からヒントを取り出す。
 *
 * Example: `readScheduleHint("a=1; skyshare_schedule=...")` → ヒント。cookie が無ければ undefined
 */
export const readScheduleHint = (
    cookieHeader: string,
): ScheduleHint | undefined => {
    for (const part of cookieHeader.split(";")) {
        const eq = part.indexOf("=")
        if (eq < 0) continue
        if (part.slice(0, eq).trim() !== SCHEDULE_HINT_COOKIE_NAME) continue
        return parseScheduleHint(part.slice(eq + 1).trim())
    }
    return undefined
}

const attributes = (maxAge: number): string =>
    [
        "Path=/",
        `Max-Age=${maxAge}`,
        "SameSite=Lax",
        ...(process.env.PUBLIC_NODE_ENV === "production" ? ["Secure"] : []),
    ].join("; ")

/** ヒントを保存する Set-Cookie の値。本番のみ `Secure` を付ける */
export const makeScheduleHintSetCookie = (hint: ScheduleHint): string =>
    `${SCHEDULE_HINT_COOKIE_NAME}=${serializeScheduleHint(hint)}; ${attributes(SCHEDULE_HINT_MAX_AGE_SECONDS)}`

/** ヒントを失効させる Set-Cookie の値。クライアントは次の表示で改めて問い合わせる */
export const makeScheduleHintClearCookie = (): string =>
    `${SCHEDULE_HINT_COOKIE_NAME}=; ${attributes(0)}`

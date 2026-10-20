/**
 * プライバシーポリシーに載せる事業者情報。
 *
 * 責務と処理概要:
 * - 事業者の名称・連絡先・制定日・改定日を1か所に置き、本文の全体が同じ値を参照する。
 * - 連絡先や日付を変えるときは、このファイルだけを書き換える（改定したら `revisedAt` も更新する）。
 */
export const operator = {
    /** 事業者の名称。個人で運営しているため活動名（ハンドル名）で表記する */
    name: "nekono",
    /** 問い合わせ窓口のメールアドレス */
    email: "skyshare@nekono.dev",
    /** 問い合わせ窓口の Bluesky のハンドル（@ なし） */
    blueskyHandle: "nekono.dev",
    /** 制定日（YYYY-MM-DD） */
    enactedAt: "2026-10-20",
    /** 最終改定日（YYYY-MM-DD） */
    revisedAt: "2026-10-20",
} as const

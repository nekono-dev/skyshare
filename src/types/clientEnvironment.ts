/**
 * ブラウザの実行環境の情報の型。
 *
 * 責務と処理概要:
 * - 不具合の報告に添える環境の情報（OS・ブラウザ・識別文字列・ホーム画面からの起動か）の形を定める。
 * - 型だけを持ち、値も import も持たない（`src/types` は葉）。
 */

export type ClientEnvironment = {
    os: string
    browser: string
    userAgent: string
    /** ホーム画面から起動したか（PWA） */
    standalone: boolean
}

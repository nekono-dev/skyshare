/**
 * エラー表示の文言（日本語）。APIはエラー文言を返さず、HTTPステータスから
 * `errorMessageKeyFromStatus` がこの辞書のキーを選ぶ。
 */
export const error = {
    "error.generic": "エラーが発生しました。",
    "error.badRequest": "リクエストの内容が正しくありません。",
    "error.unauthorized": "認証が必要です。",
    "error.forbidden": "この操作は許可されていません。",
    "error.notFound": "対象が見つかりません。",
    "error.conflict": "現在の状態では実行できません。",
    "error.rateLimited":
        "リクエストが多すぎます。しばらくしてからやり直してください。",
    "error.network": "サーバへ接続できませんでした。",
    "error.loginFailed": "ログインに失敗しました。",
    "error.accountLimitReached":
        "連携できるアカウント数の上限に達しています。先に他のアカウントをログアウトしてください。",
} as const

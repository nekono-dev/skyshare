/** 予約投稿の文言（日本語）。 */
export const schedule = {
    "schedule.button": "予約",
    "schedule.listLink": "予約一覧",
    "schedule.unavailableVideo": "動画を含む投稿は予約できません。",
    "schedule.dialog.title": "投稿を予約",
    "schedule.dialog.runAt": "投稿する日時",
    "schedule.dialog.submit": "予約する",
    "schedule.dialog.sending": "予約しています…",
    "schedule.dialog.done": "予約しました。",
    "schedule.dialog.goList": "予約一覧を見る",
    "schedule.dialog.close": "閉じる",
    "schedule.dialog.cancel": "キャンセル",
    "schedule.dialog.limitsFailed": "予約の制限値を取得できませんでした。",
    "schedule.dialog.reload": "再取得",
    "schedule.range.tooSoon":
        "現在から{minutes}分後以降の日時を指定してください。",
    "schedule.range.tooLate":
        "現在から{days}日後までの日時を指定してください。",
    "schedule.credential.title": "予約用の認証",
    "schedule.credential.description":
        "指定した時刻にサーバーが代わりに投稿するため、予約専用にログインします。パスワードは保存されず、ログインで得た更新用のトークンだけが暗号化して保管されます。",
    "schedule.credential.warning":
        "メインのパスワードは入力しないでください。アプリパスワードを入力します。",
    "schedule.credential.howto":
        "アプリパスワードは、Blueskyの「設定」→「プライバシーとセキュリティ」→「アプリパスワード」で作成できます。",
    "schedule.credential.username": "ユーザー名",
    "schedule.credential.password": "アプリパスワード",
    "schedule.credential.submit": "登録して予約する",
    "schedule.credential.registered": "予約用の認証: 登録済み",
    "schedule.credential.notRegistered": "予約用の認証: 未登録",
    "schedule.credential.delete": "認証情報を削除",
    "schedule.credential.deleteBlocked":
        "待機中または実行中の予約があるため、削除できません。",
    "schedule.list.title": "予約一覧",
    "schedule.list.empty": "予約はありません。",
    "schedule.list.postCount": "{count}件の投稿",
    "schedule.list.cancel": "取消",
    "schedule.list.deleteHistory": "履歴を削除",
    "schedule.list.viewPost": "投稿を見る",
    "schedule.list.more": "さらに表示",
    "schedule.list.reload": "再読み込み",
    "schedule.list.loadFailed": "予約の一覧を取得できませんでした。",
    "schedule.list.cancelTitle": "予約の取消",
    "schedule.list.cancelMessage": "この予約を取り消します。よろしいですか。",
    "schedule.list.cancelConfirm": "取り消す",
    "schedule.status.pending": "待機中",
    "schedule.status.running": "実行中",
    "schedule.status.posted": "投稿済み",
    "schedule.status.failed": "失敗",
    "schedule.error.invalid": "予約の内容が正しくありません。",
    "schedule.error.passwordRejected":
        "ログインできませんでした。アプリパスワードを確認してください。",
    "schedule.error.credentialRequired": "予約用の認証が必要です。",
    "schedule.error.running": "実行中のため操作できません。",
    "schedule.error.credentialInUse":
        "待機中または実行中の予約があるため、認証情報を削除できません。",
    "schedule.error.tooMany":
        "予約の件数が上限に達しています。先に不要な予約を取り消してください。",
    "schedule.error.server": "予約の処理に失敗しました。",
    "schedule.failure.CredentialMissing":
        "予約用の認証情報が見つかりませんでした。",
    "schedule.failure.CredentialInvalid":
        "予約用の認証情報を読み出せませんでした。",
    "schedule.failure.CredentialExpired":
        "予約用の認証の有効期限が切れていました。",
    "schedule.failure.InvalidRecord": "投稿の内容が受け付けられませんでした。",
    "schedule.failure.ImageMissing": "添付した画像が見つかりませんでした。",
    "schedule.failure.RetryExceeded":
        "一時的な失敗が続き、投稿できませんでした。",
    "schedule.failure.unknown": "投稿できませんでした。",
    "pageTitle.schedules": "予約一覧 | {service}",
} as const

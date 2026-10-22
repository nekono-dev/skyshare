/** 予約投稿の文言（日本語）。 */
export const schedule = {
    "schedule.submit": "予約",
    "schedule.submitAll": "すべて予約",
    "schedule.unavailableVideo": "動画を含む投稿は予約できません。",
    "schedule.unavailableDisabled": "予約投稿は、設定で有効にすると使えます。",
    "schedule.unavailableLimits": "予約の制限値を取得できませんでした。",
    "schedule.sending": "予約しています…",
    "schedule.created": "予約しました。",
    "schedule.updated": "予約を更新しました。",
    "schedule.cancelled": "予約を取り消しました。",
    "schedule.loadingEdit": "予約を読み込んでいます…",
    "schedule.applied": "予約をフォームに読み込みました。",
    "schedule.runAtLabel": "{date}に予約",
    "schedule.picker.button": "予約日時を指定",
    "schedule.picker.title": "予約日時",
    "schedule.picker.runAt": "投稿する日時",
    "schedule.picker.set": "設定",
    "schedule.picker.clear": "解除",
    "schedule.picker.close": "閉じる",
    "schedule.range.tooSoon":
        "現在から{minutes}分後以降の日時を指定してください。",
    "schedule.range.tooLate":
        "現在から{days}日後までの日時を指定してください。",
    "schedule.videoConflict.title": "動画つきの投稿は予約できません",
    "schedule.videoConflict.message":
        "動画を含む投稿は予約できません。動画の登録を解除すると予約できます。",
    "schedule.videoConflict.remove": "動画の登録を解除して予約する",
    "schedule.videoConflict.cancel": "キャンセル",
    "schedule.editCancel.title": "予約の編集をやめます",
    "schedule.editCancel.cancelSchedule": "予約を取り消す",
    "schedule.editCancel.keep": "予約を残して閉じる",
    "schedule.editCancel.continue": "編集を続ける",
    "schedule.setting.label": "予約投稿",
    "schedule.setting.description":
        "日時を指定して投稿できます。有効にするとアプリパスワードを登録します。",
    "schedule.setting.disableTitle": "予約投稿を無効にする",
    "schedule.setting.disableMessage":
        "待機中の予約{count}件も取り消されます。よろしいですか。",
    "schedule.setting.disableMessageNone":
        "登録したアプリパスワードの情報を削除します。よろしいですか。",
    "schedule.setting.disableConfirm": "無効にする",
    "schedule.setting.disabled": "予約投稿を無効にしました。",
    "schedule.setting.disabledWithCancel":
        "予約投稿を無効にし、{count}件の予約を取り消しました。",
    "schedule.credential.title": "予約投稿を有効にする",
    "schedule.credential.warning":
        "メインのパスワードではなく、アプリパスワードを入力してください。",
    "schedule.credential.howto":
        "アプリパスワードは Bluesky の「設定」→「プライバシーとセキュリティ」で作成できます。",
    "schedule.credential.privacy": "保管する情報の扱いは{link}をご覧ください。",
    "schedule.credential.username": "ユーザー名",
    "schedule.credential.password": "アプリパスワード",
    "schedule.credential.submit": "登録する",
    "schedule.credential.cancel": "キャンセル",
    "schedule.list.empty": "予約はありません。",
    "schedule.list.pendingTitle": "待機中",
    "schedule.list.historyTitle": "履歴",
    "schedule.list.postCount": "{count}件の投稿",
    "schedule.list.edit": "この予約を編集する",
    "schedule.list.deleteHistory": "履歴を削除",
    "schedule.list.restore": "フォームに書き戻す",
    "schedule.list.more": "さらに表示",
    "schedule.list.reload": "再読み込み",
    "schedule.list.loadFailed": "予約の一覧を取得できませんでした。",
    "schedule.list.deleteTitle": "履歴の削除",
    "schedule.list.deleteMessage":
        "この予約の履歴を削除します。よろしいですか。",
    "schedule.list.deleteConfirm": "削除する",
    "schedule.status.pending": "待機中",
    "schedule.status.running": "実行中",
    "schedule.status.failed": "失敗",
    "schedule.error.invalid": "予約の内容が正しくありません。",
    "schedule.error.passwordRejected":
        "ログインできませんでした。アプリパスワードを確認してください。",
    "schedule.error.notFound":
        "予約が見つかりませんでした。すでに実行されたか、取り消された可能性があります。",
    "schedule.error.credentialRequired":
        "予約投稿が無効です。設定で予約投稿を有効にしてください。",
    "schedule.error.running": "実行中のため操作できません。",
    "schedule.error.tooMany":
        "予約の件数が上限に達しています。先に不要な予約を取り消してください。",
    "schedule.error.server": "予約の処理に失敗しました。",
    "schedule.failure.CredentialMissing":
        "予約投稿が無効になっていたため、投稿できませんでした。",
    "schedule.failure.CredentialInvalid":
        "予約用の認証情報を読み出せませんでした。",
    "schedule.failure.CredentialExpired":
        "アプリパスワードが使えなくなっていました。設定で予約投稿を有効にし直してください。",
    "schedule.failure.InvalidRecord": "投稿の内容が受け付けられませんでした。",
    "schedule.failure.ImageMissing": "添付した画像が見つかりませんでした。",
    "schedule.failure.RetryExceeded":
        "一時的な失敗が続き、投稿できませんでした。",
    "schedule.failure.unknown": "投稿できませんでした。",
} as const

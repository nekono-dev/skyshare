/** 動画投稿（添付・アップロード・再生）関連の文言（日本語）。 */
export const video = {
    "video.picker.add": "動画を追加",
    "video.picker.addAria": "動画追加",
    "video.picker.remove": "動画を取り外す",
    "video.picker.reselect": "別の動画を選ぶ",
    "video.picker.altAria": "動画のaltテキストを編集",
    "video.picker.progressAria": "動画のアップロード進捗",
    "video.picker.exclusiveWithImage":
        "画像を添付済みのため動画は追加できません",
    "video.picker.exclusiveWithOgp":
        "リンクカードを取得済みのため動画は追加できません",
    "video.picker.exclusiveWithVideo": "動画を添付済みのため追加できません",
    "video.status.uploading": "アップロード中… {percent}%",
    "video.status.processing": "変換中… {percent}%",
    "video.status.done": "アップロード完了",
    "video.submit.waitUpload": "動画のアップロードが完了するまで投稿できません",
    "video.submit.removeFailed":
        "アップロードに失敗した動画があります。取り外すか、選び直してください",
    "video.play": "動画を再生",
    "video.playError": "動画を再生できませんでした。Blueskyで見る",
    "video.unavailable.title": "Skyshareでは再生できません",
    "video.unavailable.link": "Blueskyで見る",
    "video.error.unsupportedFormat":
        "対応していない動画形式です（mp4・mov・webm・mpegに対応）",
    "video.error.tooLarge": "動画のサイズは300MB以下にしてください",
    "video.error.tooLong": "動画の長さは10分以下にしてください",
    "video.error.unreadable": "動画を読み込めませんでした",
    "video.error.badAspectRatio": "動画の縦横比がBlueskyの許容範囲外です",
    "video.error.dailyLimit": "本日の動画アップロード上限に達しました",
    "video.error.forbidden":
        "動画をアップロードする権限がありません（メール認証などが必要な場合があります）",
    "video.error.tooManyUploads":
        "処理中の動画アップロードが多すぎます。しばらくしてからやり直してください",
    "video.error.overloaded":
        "動画サービスが混み合っています。しばらくしてからやり直してください",
    "video.error.processingFailed": "動画の変換に失敗しました",
    "video.error.timeout": "動画の変換に時間がかかりすぎたため中断しました",
    "video.error.unsupportedPds":
        "このアカウントでは動画を投稿できません（bsky.social のアカウントのみ対応）",
    "video.error.network": "通信に失敗しました。もう一度お試しください",
    "video.error.unknown": "動画のアップロードに失敗しました",
} as const

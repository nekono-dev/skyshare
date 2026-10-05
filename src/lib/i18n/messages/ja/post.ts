/**
 * 投稿・タイムライン関連の文言（日本語）。
 * `{icon}`/`{share}`/`{popup}`/`{taittsuu}`/`{mastodon}` は `renderSlots` が差し込むアイコン要素のスロット。
 * 複数形が必要な文言は `base_other` で定義する。
 */
export const post = {
    "post.guestUnavailable": "ゲスト表示のため利用できません",
    "post.guestNotice":
        "これはログイン不要のゲスト表示です。Blueskyへの投稿はスキップされますが、投稿ボタンを押すとポップアップ・共有シートやX・タイッツー・Mastodonへの投稿ボタンはお試しいただけます。",
    "post.launcher.new": "新規投稿",

    "post.card.openBluesky": "Bluesky で開く",
    "post.card.webShare": "Web Share APIで共有",
    "post.card.openEntry": "Entryを開く",
    "post.card.creatingEntry": "Entryを作成中...",
    "post.card.deletingEntry": "Entryを削除中...",
    "post.card.checkingDeletion": "削除内容を確認中...",
    "post.card.loadingImages": "画像を読み込み中...",
    "post.entry.createFailed": "skyshareページの作成に失敗しました。",
    "post.entry.deleteFailed": "Entryの削除に失敗しました。",
    "post.entry.deleteBlocked":
        "このEntryはBluesky投稿を含めて削除できません。",
    "post.webShare.unsupported":
        "お使いのブラウザはこの内容の共有に対応していません。",
    "post.webShare.failed": "WebShareAPIでの共有に失敗しました。",
    "post.entryActions.crosspost": "クロスポスト",
    "post.entryActions.deletePost": "投稿を削除",
    "post.entryActions.creating": "作成中…",
    "post.entryActions.create": "Skyshare Entryを作成",
    "post.entryActions.notEligible": "Skyshareリンク作成対象外",
    "post.stats.aria": "Blueskyでのリアクション数",
    "post.stats.like": "いいね",
    "post.stats.repost": "リポスト",
    "post.stats.reply": "リプライ",
    "post.stats.quote": "引用",
    "post.threadExpand_other": "スレッドを展開（{count}件）",
    "post.threadCollapse": "折りたたむ",
    "post.suggest.trending": "トレンド",

    "post.timeline.loadFailed": "投稿一覧の取得に失敗しました。",
    "post.timeline.initializing": "初期化中...",
    "post.timeline.paginationAria": "投稿一覧のページ送り",
    "post.timeline.infiniteAria": "投稿一覧の自動読み込み",
    "post.timeline.guestNotice":
        "これはゲスト表示です。Blueskyへの投稿以外の動作を確認できます。Entryの削除は画面上の模擬動作で、実際のデータには影響しません。",

    "post.selfLabel.aria": "コンテンツラベル",
    "post.selfLabel.none": "ラベルなし",
    "post.selfLabel.sexual": "きわどい(sexual)",
    "post.selfLabel.nudity": "ヌード(nudity)",
    "post.selfLabel.porn": "成人向け(porn)",
    "post.selfLabel.spoiler": "ネタバレ(spoiler)",
    "post.selfLabel.warn": "警告(warn)",

    "post.autoPopupTarget.label": "自動ポップアップするSNS",
    "post.autoPopupTarget.ask": "投稿時に選択する",
    "post.autoPopupTarget.x": "X",
    "post.autoPopupTarget.taittsuu": "タイッツー",
    "post.autoPopupTarget.mastodon": "Mastodon",
    "post.shareDialog.aria": "共有先を選択",
    "post.shareDialog.x": "X に投稿",
    "post.shareDialog.taittsuu": "タイッツーに投稿",
    "post.shareDialog.mastodon": "Mastodonに投稿",

    "post.gate.title": "返信・引用の設定",
    "post.gate.mentioned": "メンションされた人",
    "post.gate.follower": "フォロワー",
    "post.gate.following": "フォロー中の人",
    "post.gate.everyone": "誰でも返信可能",
    "post.gate.nobody": "返信不可",
    "post.gate.chooseFromLists": "リストから選択",
    "post.gate.listsLoading": "リストを読み込み中...",
    "post.gate.listsLoadFailed": "リスト一覧の取得に失敗しました。",
    "post.gate.listsEmpty": "リストがありません。",
    "post.gate.limit": "最大{max}件まで選択できます。",
    "post.gate.allowQuote": "引用を許可する",

    "post.segment.dropMedia": "画像・動画をドロップして添付",
    "post.segment.placeholderFirst": "最近どう？",
    "post.segment.placeholderNext": "スレッドに追加...",
    "post.segment.gateOpen": "誰でも反応可能",
    "post.segment.gateRestricted": "反応を制限しています",
    "post.segment.addToThread": "スレッドに追加",
    "post.segment.emptyText": "（本文未入力）",
    "post.segment.removeAria": "このセグメントを削除",
    "post.segment.remove": "削除",

    "post.composer.draftListLoadFailed": "下書き一覧の取得に失敗しました。",
    "post.composer.draftApplied": "下書きを反映しました。",
    "post.composer.draftSaveFailed": "下書きの保存に失敗しました。",
    "post.composer.sending": "送信中…",
    "post.composer.guestProcessing": "処理中…",
    "post.composer.loadingDrafts": "下書きを読み込み中...",
    "post.composer.draftListTitle": "下書き一覧",
    "post.composer.formAria": "投稿フォーム",
    "post.composer.posting": "投稿中...",
    "post.composer.drafts": "下書き",
    "post.composer.guestSubmitNotice":
        "ゲスト表示のためBlueskyへの投稿はスキップされます",
    "post.composer.submitAll": "すべて投稿",
    "post.composer.submit": "投稿",
    "post.composer.popupInstead": "{share}の代わりにポップアップ{popup}を開く",
    "post.composer.manualImageAttach":
        "画像を自分で添付する（URLを発行しない）",
    "post.composer.counterLabel.taittsuu": "ﾀｲｯﾂｰ",
    "post.composer.truncateIntentText": "長文を省略して共有",
    "post.composer.moreOptions": "詳細オプション",

    "post.submit.postFailed": "Blueskyへの投稿に失敗しました。",
    "post.submit.entryCreateFailed":
        "Blueskyへの投稿は成功しましたが、SkyShareレコード作成に失敗しました。",
    "post.submit.unexpected": "投稿処理中に予期せぬエラーが発生しました。",
    "post.submit.failed": "投稿に失敗しました。",

    "post.share.resultSuccess": "Blueskyへの投稿に成功しました",
    "post.share.resultGuest":
        "ゲスト表示のためBlueskyへの投稿はスキップしました",
    "post.share.service.taittsuu": "タイッツー",
    "post.share.service.mastodon": "Mastodon",
    "post.share.service.x": "x.com",
    "post.share.chooseTarget": "{result}。共有先を選択してください。",
    "post.share.popupOpened": "{result}。{service} 投稿画面を開きました。",
    "post.share.popupBlocked":
        "{result}。{service} 投稿画面を開けませんでした。ポップアップブロックを確認してください。共有先を選ぶダイアログを開き、自動ポップアップするSNSを「投稿時に選択する」にしました。",
    "post.share.webShareDone":
        "{result}。WebShareAPIに投稿内容を転送しました。",
    "post.share.webShareCancelled":
        "{result}。WebShareAPIでの共有操作はキャンセルされました。",
    "post.share.reason.unsupported": "ブラウザがWebShareAPI非対応のため",
    "post.share.reason.failed": "WebShareAPI での共有に失敗したため",
    "post.share.fallbackOpened":
        "{result}。投稿画面を開きました。{reason}、ポップアップを開くオプションをONにしました。",
    "post.share.fallbackBlocked":
        "{result}が、投稿画面を開けませんでした。ポップアップブロックを確認してください。共有先を選ぶダイアログを開き、自動ポップアップするSNSを「投稿時に選択する」にしました。",
} as const

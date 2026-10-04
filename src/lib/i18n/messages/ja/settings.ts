/**
 * 設定画面の文言（日本語）。
 * `{share}`/`{popup}`/`{taittsuu}`/`{mastodon}` は `renderSlots` が差し込むアイコン要素のスロット。
 */
export const settings = {
    "settings.helpLink": "困った時のヘルプはこちら。",
    "settings.display.title": "表示",
    "settings.theme.label": "表示テーマ",
    "settings.theme.system": "システム設定に従う",
    "settings.theme.light": "ライト",
    "settings.theme.dark": "ダーク",
    "settings.locale.label": "表示言語",
    "settings.locale.system": "システム設定に従う",
    "settings.postForm.title": "投稿フォーム",
    "settings.pinnedFormDisabled.label": "投稿フォームを固定表示しない",
    "settings.pinnedFormDisabled.description":
        "オンにすると、投稿フォームが画面上部に固定表示されなくなります。投稿フォームはサイドバーまたはフローティングの新規投稿ボタンを押して表示してください。",
    "settings.popupIntent.label": "{share}の代わりにポップアップを開く",
    "settings.popupIntent.description":
        "オンにすると、投稿後の共有をWebshareAPI（{share}で表示できる共有メニュー ）を使わず、投稿インテントをポップアップ{popup}します。",
    "settings.manualImageAttach.label": "画像を自分で添付する",
    "settings.manualImageAttach.description":
        "オンにすると、SkyshareのURLを発行しません。{share}を使用する場合は、共有先へ画像データを共有します。投稿インテント（ポップアップ{popup}） を使う場合は、対象SNSの投稿フォーム側で画像を設定してください。",
    "settings.hashtagSuggest.label": "ハッシュタグ候補を表示",
    "settings.hashtagSuggest.description":
        "オンにすると、投稿本文で「#」を入力した際にハッシュタグの候補一覧を表示します。",
    "settings.mentionSuggest.label": "メンション候補を表示",
    "settings.mentionSuggest.description":
        "オンにすると、投稿本文で「@」を入力した際にメンション候補一覧を表示します。",
    "settings.gate.title": "返信・引用のデフォルト設定",
    "settings.gate.description":
        "新規投稿時の初期値として使われる、返信可能ユーザー・引用許可のデフォルト設定です。",
    "settings.gate.editButton": "返信・引用のデフォルト設定を編集",
    "settings.syncGate.label": "返信・引用オプションを保存する",
    "settings.syncGate.description":
        "オンにすると、投稿時に指定した返信・引用の設定が次回以降のデフォルト値になります。オフの場合、投稿後は本オプションで保存されたデフォルト値に戻ります。",
    "settings.crosspost.title": "クロスポスト",
    "settings.showX.label": "X投稿ボタンを表示",
    "settings.showX.description":
        "オンにすると、X投稿ボタンを表示します。自動ポップアップはOFFになります。他SNSのクロスポストオプションを設定している場合、両方のボタンを表示します。",
    "settings.noAutoPopup.label": "自動ポップアップをOFFにする",
    "settings.noAutoPopup.description":
        "オンにすると、投稿完了時に共有ポップアップを自動的に開きません。X投稿ボタンを表示がOFFの場合はONになります。自動ポップアップを開くことができない場合は、このオプションがONになります。",
    "settings.taittsuu.label": "{taittsuu}にクロスポスト",
    "settings.taittsuu.description":
        "オンにすると、クロスポスト先をXではなくタイッツー{taittsuu}に変更します。",
    "settings.mastodon.label": "{mastodon}にクロスポスト",
    "settings.mastodon.description":
        "オンにすると、クロスポスト先にMastodon{mastodon}を追加します。ドメイン未設定の場合は mastodon.social が既定値として設定されます。",
    "settings.mastodon.domainError":
        "ドメインの形式が正しくありません。スキーム（https://等）やパス（/以降）を含めず、ドメイン名のみを入力してください。",
} as const

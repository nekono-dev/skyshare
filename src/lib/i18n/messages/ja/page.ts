/** 各ページ固有の文言（ヘルプ・アカウント切り替え・Entry一覧見出し・遷移待機・ログイン案内・legacy投稿ページ）（日本語）。 */
export const page = {
    "page.help.heading": "過去にあった問い合わせと対処",
    "page.help.androidMedia.title": "画像が選択できない",
    "page.help.androidMedia.description":
        "「アクセス権が拒否されたため、メディアを選択できません」と表示される",
    "page.help.androidMedia.intro":
        "ブラウザに写真・動画へのアクセス権限が許可されていない場合に、このメッセージが表示されます。",
    "page.help.androidMedia.step1": "端末の「設定」アプリを開く",
    "page.help.androidMedia.step2":
        "「アプリ」→ ご利用のブラウザ（Chromeなど）を選択",
    "page.help.androidMedia.step3":
        "「権限」→「写真と動画」（または「ファイルとメディア」）を許可に変更",
    "page.help.androidMedia.outro":
        "アプリとしてインストール（PWA化）している場合も、アプリ化を行なったブラウザ上の設定を修正してください。",
    "page.accounts.heading": "アカウントを切り替え",
    "page.accounts.description":
        "カードをクリックするとそのアカウントに切り替わります。カード内の「ログアウト」ボタンでそのアカウントからログアウトできます。",
    "page.entries.heading": "Skyshare Entry一覧",
    "page.jump.opening": "投稿画面を開いています…",
    "page.jump.hint":
        "しばらく経っても切り替わらない場合は、ポップアップブロックの設定をご確認いただくか、このウィンドウを閉じてください。",
    "page.login.oldUi": "旧UIはこちら {link}",
    "page.login.guest": "ゲストとして{link}（ログイン中は見れません）",
    "page.login.guestLink": "画面を確認できます",
    "page.login.v2Notice": "★ Skyshare v2を開発中です。以下の違いがあります",
    "page.login.persist.title": "Skyshare生成コンテンツの永続化",
    "page.login.persist.item1":
        "これまでは開発者のバックエンドに画像やテキストデータを配置していました。そのため、開発者がバックエンド費用を負担する都合から、データに賞味期限をつける対処をせざるを得ませんでした。",
    "page.login.persist.item2":
        "v2では、Skyshareで生成したコンテンツはあなたのPDSに配置されます。つまり、あなたがアカウントを消さない限り（BlueskyがPDSを保持する限り）永遠に保持できます{bold}",
    "page.login.persist.item2Bold": "（データの有効期限の撤廃）",
    "page.login.thumb.title": "クロスポスト用サムネイル生成の自由度向上",
    "page.login.thumb.item1":
        "v1では、クロスポスト用サムネイル（リンクカード画像）をサーバサイド、クラウド上で生成していました。v2ではクライアント側で生成しています。",
    "page.login.thumb.item2":
        "これにより、リンクカード画像を柔軟に編集可能になりました。{bold}現時点では、サムネイルにしたい箇所の切り抜き・複数画像配置時の表示位置調整に対応しています。",
    "page.login.thumb.item2Bold": "（リンクカード生成画像の編集機能追加）",
    "page.login.thumb.item3":
        "需要があればリンクカード用の画像を別で用意する（自動生成しない）・ラベラーの状態に応じた加工処理等を実装していこうと考えています。...端的には、R-18画像のサムネにモザイクいれるとか。",
    "page.login.other.title": "その他、使いやすくなる改修いろいろ",
    "page.login.other.item1":
        "v1ではできなかったことが色々できるようになっています。バックエンドはおおよそできており、あとはレイアウトや機能の調整・追加、ソースコードの整理などを終えたらリリース予定です。",
    "page.login.other.item2":
        "正式リリースに向けて絶賛開発中なので {hashtag} などで感想や要望を書いておいていただけると活動の励みになります。",
    "page.legacyPost.title": "{profile}の投稿",
    "page.legacyPost.viewOnBluesky": "Blueskyの投稿を見る",
    "page.legacyPost.noImages": "画像はありません。",
    "page.legacyPost.imagesAria": "post images",
    "page.legacyPost.error404Title": "Post Not Found",
    "page.legacyPost.notFound": "Post is not found",
    "page.legacyPost.invalidId": "Invalid post identifier",
} as const

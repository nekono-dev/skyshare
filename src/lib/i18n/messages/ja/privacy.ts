/**
 * プライバシーポリシーの文言（日本語。正本）。
 * 取得する情報・保存期間などの事実は実装に合わせる。Cookie・端末内の保存項目・予約の保管期間を変えたときは同じ変更で更新する。
 * 文は短く、技術の細部は書かず、誰でも読める言葉にする。
 * `{operator}`/`{email}`/`{handle}`/`{enactedAt}`/`{revisedAt}` は `operator.ts` の値が入る。
 */
export const privacy = {
    "privacy.heading": "プライバシーポリシー",
    "privacy.lead":
        "{operator}（以下「運営者」）は、Skyshare（以下「本サービス」）で扱う個人情報を、個人情報保護法などの法令に従って取り扱います。",
    "privacy.operator.title": "1. 運営者",
    "privacy.operator.name": "事業者の名称: {operator}（個人で運営）",
    "privacy.operator.contact": "連絡先: {email}、または Bluesky の @{handle}",
    "privacy.operator.definition":
        "個人情報とは、ハンドルや投稿内容など、個人を特定できる情報です。",
    "privacy.collected.title": "2. 取得する情報",
    "privacy.collected.intro":
        "機能を使ったときに限り、次の情報を扱います。本サービスに会員登録はなく、運営者は利用者の名簿を持ちません。",
    "privacy.collected.login":
        "ログイン: ハンドルやメールアドレス、パスワード、ログインの状態を保つ情報。パスワードは保存しません。",
    "privacy.collected.post":
        "投稿: 本文、画像、動画、下書き、共有用のページ情報。利用者自身の Bluesky に保存され、運営者は保管しません。",
    "privacy.collected.schedule":
        "予約投稿: 投稿の内容、画像、実行日時、予約用のログイン情報。予約を使ったときだけ、運営者の管理する場所に保管します。",
    "privacy.collected.device":
        "端末内の設定: 表示言語やテーマなどの設定。利用者のブラウザにだけ保存します。",
    "privacy.collected.log":
        "アクセスログ: 日時、URL、IP アドレス、ブラウザの種類。運用と不具合の調査のため、配信を委託する Cloudflare に記録されます。",
    "privacy.collected.analytics":
        "アクセス解析（旧UI のみ）: 閲覧したページ、端末やブラウザの種類、おおよその地域。Google アナリティクスで収集され、Cookie を使います。",
    "privacy.collected.note1":
        "現行の画面（旧UI 以外）では、アクセス解析や広告の仕組みを使いません。",
    "privacy.collected.note2": "病歴や信条などの要配慮個人情報は取得しません。",
    "privacy.purpose.title": "3. 利用目的",
    "privacy.purpose.intro": "取得した情報は、次の目的にだけ使います。",
    "privacy.purpose.item1": "Bluesky への投稿や削除を行うため",
    "privacy.purpose.item2": "予約した日時に自動で投稿するため",
    "privacy.purpose.item3": "利用者が選んだ設定を保つため",
    "privacy.purpose.item4":
        "リンクの表示や共有など、操作された機能を提供するため",
    "privacy.purpose.item5": "旧UI の利用状況を把握し、改善に生かすため",
    "privacy.purpose.item6": "不具合の調査と不正利用の防止のため",
    "privacy.external.title": "4. 外部への送信と第三者への提供",
    "privacy.external.intro":
        "運営者は、法令に基づく場合を除き、同意なく個人情報を第三者へ提供しません。機能のため、次の外部サービスへ情報を送ります（電気通信事業法の外部送信の公表を兼ねます）。",
    "privacy.external.bluesky":
        "Bluesky: ログイン情報、投稿、画像、動画を送ります。ログインと投稿のためです。",
    "privacy.external.plc":
        "PLC Directory: アカウントの識別子（DID）を送ります。利用者の保存先を調べるためです。",
    "privacy.external.ogp":
        "OGP 抽出サービス（運営者が管理）: 投稿に含まれる URL を送ります。リンク先の題名や画像を得るためです。",
    "privacy.external.legacy":
        "旧バックエンド: 旧形式の投稿の識別子を送ります。過去の投稿ページの表示と、本人による削除のためです。",
    "privacy.external.cloudflare":
        "Cloudflare: 本サービスへの通信と予約のデータを預けます。サービスの配信と運用のためです。",
    "privacy.external.google":
        "Google（Google アナリティクス）: 旧UI での閲覧の状況を送ります。利用状況の把握のためです。",
    "privacy.external.sns":
        "共有先の SNS（X・タイッツー・Mastodon）: 共有する文章と URL を渡します。利用者が共有を選んだときだけです。",
    "privacy.external.note1":
        "送信先の一部は米国などの外国にあります。各国の制度は日本と異なる場合があります。",
    "privacy.external.optout":
        "旧UI のアクセス解析は、ブラウザの Cookie の設定や Google のオプトアウト用の拡張機能で止められます。",
    "privacy.external.note2":
        "各サービスでの取扱いは、それぞれのプライバシーポリシーをご確認ください。",
    "privacy.retention.title": "5. 保存期間",
    "privacy.retention.item1":
        "ログインの情報: 7日間。ログアウトで削除します。",
    "privacy.retention.item2": "端末内の設定: 利用者が消すまで残ります。",
    "privacy.retention.item3":
        "予約の内容: 実行までです。終了から7日後に削除します。取消したらすぐ削除します。",
    "privacy.retention.item4":
        "予約の画像: 実行か取消で削除します。使われなくても45日で削除します。",
    "privacy.retention.item5":
        "予約用のログイン情報: 予約がなくなると削除します。いつでも自分で削除できます。",
    "privacy.retention.item6":
        "アクセスログ: Cloudflare が定める短い期間だけ残ります。",
    "privacy.retention.item7":
        "アクセス解析の情報（旧UI のみ）: Google の設定に従って保管されます。",
    "privacy.security.title": "6. 安全管理",
    "privacy.security.item1": "通信は暗号化して保護します。",
    "privacy.security.item2":
        "ログイン情報は、ブラウザ上のプログラムから読めない形で保存します。",
    "privacy.security.item3":
        "予約では、パスワードを保存せず、ログイン情報も暗号化して保管します。",
    "privacy.security.item4":
        "予約には、権限を絞ったアプリパスワードを使ってください。メインのパスワードは入力しないでください。",
    "privacy.security.item5":
        "運営者以外は、運営者の管理する情報に触れられません。",
    "privacy.rights.title": "7. 利用者の権利と問い合わせ",
    "privacy.rights.intro":
        "利用者は、運営者が持つ自分の個人情報の開示・訂正・削除・利用停止を求められます。本人確認のうえ、遅滞なく対応します。",
    "privacy.rights.contact": "窓口: {email}、または Bluesky の @{handle}",
    "privacy.rights.item1":
        "予約の取消、履歴の削除、予約用ログイン情報の削除は、予約の一覧ページで行えます。",
    "privacy.rights.item2":
        "Bluesky に保存した投稿などは、本サービスか Bluesky で削除してください。",
    "privacy.rights.item3": "端末内の設定は、ブラウザの設定から消せます。",
    "privacy.revision.title": "8. ポリシーの改定",
    "privacy.revision.body":
        "法令の変更や機能の追加に合わせて改定することがあります。改定後は、このページに載せた時点から有効です。",
    "privacy.revision.dates": "制定日: {enactedAt}／最終改定日: {revisedAt}",
    "privacy.link": "プライバシーポリシー",
    "privacy.scheduleNotice":
        "予約のために保管する情報の扱いは、{link}をご確認ください。",
} as const

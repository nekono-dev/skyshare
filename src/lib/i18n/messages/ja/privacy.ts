/**
 * プライバシーポリシーの文言（日本語。正本）。
 * 取得する情報・保存期間などの事実は実装に合わせる。Cookie・端末内の保存項目・予約の保管期間を変えたときは同じ変更で更新する。
 * `{operator}`/`{email}`/`{handle}`/`{enactedAt}`/`{revisedAt}` は `operator.ts` の値が入る。
 */
export const privacy = {
    "privacy.heading": "プライバシーポリシー",
    "privacy.lead":
        "{operator}（以下「運営者」）は、Skyshare（以下「本サービス」）で取り扱う利用者の個人情報について、個人情報の保護に関する法律（個人情報保護法）その他の関係法令を遵守し、次のとおり取り扱います。",
    "privacy.operator.title": "1. 事業者情報",
    "privacy.operator.name": "事業者の名称: {operator}（個人で運営しています）",
    "privacy.operator.contact":
        "連絡先: {email}、または Bluesky のアカウント @{handle}",
    "privacy.operator.definition":
        "本ポリシーにおける個人情報とは、Bluesky のハンドル・DID・投稿内容など、特定の個人を識別できる情報を指します。",
    "privacy.collected.title": "2. 取得する情報",
    "privacy.collected.intro":
        "本サービスは、利用者が機能を使うときに限り、次の情報を取り扱います。本サービスにはアカウント登録がなく、運営者のデータベースに利用者の名簿を持ちません。",
    "privacy.collected.head.category": "区分",
    "privacy.collected.head.data": "情報の種類",
    "privacy.collected.head.place": "保管場所",
    "privacy.collected.login.category": "ログイン",
    "privacy.collected.login.data":
        "Bluesky のハンドルまたはメールアドレス、パスワード（アプリパスワードを推奨）、認証トークン（アクセストークン・リフレッシュトークン）、DID、ハンドル、表示名、アイコン画像",
    "privacy.collected.login.place":
        "パスワードは Bluesky への認証のために一時的に受け取るだけで保存しません。認証トークンは利用者のブラウザの Cookie に保存されます。",
    "privacy.collected.post.category": "投稿とエントリ",
    "privacy.collected.post.data":
        "投稿の本文、画像、動画、リンクカード、自己ラベル、下書き、Skyshare の entry（共有用のページ情報）",
    "privacy.collected.post.place":
        "利用者自身の Bluesky の PDS（データの保管サーバー）に書き込まれます。運営者は保管しません。",
    "privacy.collected.schedule.category": "予約投稿",
    "privacy.collected.schedule.data":
        "予約した投稿の内容（本文・設定）、添付画像、実行日時、実行の状況、DID、予約の実行のための認証情報（暗号化したリフレッシュトークンと接続先の PDS）",
    "privacy.collected.schedule.place":
        "運営者が管理する Cloudflare のデータベース（D1）と保管庫（R2）に保管します。予約投稿の機能を使った場合に限ります。",
    "privacy.collected.device.category": "端末内の保存",
    "privacy.collected.device.data":
        "表示テーマ、表示言語、共有・投稿フォーム・タイムラインの設定、ハッシュタグの履歴、Mastodon のインスタンス名",
    "privacy.collected.device.place":
        "利用者のブラウザのローカルストレージに保存します。運営者のサーバーには送信しません。",
    "privacy.collected.log.category": "アクセスログ",
    "privacy.collected.log.data":
        "アクセス日時、URL、IP アドレス、ブラウザの種類（User-Agent）、エラーの記録",
    "privacy.collected.log.place":
        "本サービスの配信基盤である Cloudflare に、運用とトラブルの調査のために記録されます。",
    "privacy.collected.note1":
        "アクセス解析のツール、広告の配信、利用者の追跡を目的とした Cookie は使用しません。",
    "privacy.collected.note2":
        "本サービスは、病歴・信条などの要配慮個人情報を取得しません。投稿の本文などに利用者自身が含めた情報は、利用者の責任で公開範囲を決めてください。",
    "privacy.collected.note3":
        "ログインなしで閲覧できるページ（entry の公開ページなど）を開く場合、認証情報は取得しません。",
    "privacy.purpose.title": "3. 利用目的",
    "privacy.purpose.intro":
        "取得した情報は、次の目的の範囲でのみ利用し、目的外には利用しません。",
    "privacy.purpose.item1":
        "ログインしたアカウントで、Bluesky への投稿・下書き・entry の作成と削除を行うため",
    "privacy.purpose.item2":
        "予約した日時に、利用者のアカウントで自動的に投稿するため",
    "privacy.purpose.item3":
        "表示言語・テーマ・共有の設定など、利用者が選んだ設定を維持するため",
    "privacy.purpose.item4":
        "リンクカードの取得、画像・動画の表示、共有先の SNS への共有など、利用者が操作した機能を提供するため",
    "privacy.purpose.item5":
        "不具合の調査、不正な利用の防止、サービスの安全な運用のため",
    "privacy.purpose.item6": "本ポリシーに基づく開示などの請求に対応するため",
    "privacy.external.title": "4. 外部への送信と第三者への提供",
    "privacy.external.intro":
        "運営者は、次の場合を除き、取得した個人情報を利用者の同意なく第三者へ提供しません。法令に基づく場合、人の生命・身体・財産の保護に必要で本人の同意を得ることが困難な場合、国の機関などへの協力が必要な場合です。本サービスは、機能の提供のために次の外部サービスへ情報を送信します（電気通信事業法の外部送信に関する公表を兼ねます）。",
    "privacy.external.head.dest": "送信先",
    "privacy.external.head.data": "送信する情報",
    "privacy.external.head.purpose": "目的",
    "privacy.external.pds.dest": "Bluesky の PDS（利用者のアカウントの接続先）",
    "privacy.external.pds.data":
        "ログインの認証情報、投稿・下書き・entry などのレコード、画像、動画の認証トークンの申請",
    "privacy.external.pds.purpose":
        "ログイン、投稿とレコードの保存・削除、予約した投稿の実行",
    "privacy.external.appview.dest": "Bluesky の AppView（公開 API）",
    "privacy.external.appview.data":
        "ハンドル・DID、メンション・ハッシュタグの検索語、リストの取得の指定",
    "privacy.external.appview.purpose":
        "プロフィールの表示、メンション・ハッシュタグの候補の表示",
    "privacy.external.video.dest": "Bluesky の動画サービス",
    "privacy.external.video.data": "投稿する動画、動画用の認証トークン",
    "privacy.external.video.purpose": "動画の変換と、投稿への添付",
    "privacy.external.cdn.dest": "Bluesky の画像 CDN",
    "privacy.external.cdn.data":
        "閲覧する画像の指定（IP アドレスなどの接続情報）",
    "privacy.external.cdn.purpose": "投稿の画像の表示",
    "privacy.external.plc.dest": "PLC Directory",
    "privacy.external.plc.data": "DID",
    "privacy.external.plc.purpose": "DID から利用者の PDS を特定するため",
    "privacy.external.ogp.dest": "OGP 抽出サービス（運営者が管理）",
    "privacy.external.ogp.data": "投稿に含まれる URL",
    "privacy.external.ogp.purpose":
        "リンク先のページの題名・説明・画像の取得と、共有時のカードの事前準備",
    "privacy.external.legacy.dest": "旧バックエンド（旧形式の投稿ページ）",
    "privacy.external.legacy.data":
        "旧形式の投稿ページの識別子、削除を依頼するときの本人の認証情報",
    "privacy.external.legacy.purpose":
        "過去に作成された投稿ページの表示と、投稿者本人による削除",
    "privacy.external.cloudflare.dest": "Cloudflare, Inc.",
    "privacy.external.cloudflare.data":
        "本サービスへのすべての通信、予約投稿のデータ、アクセスログ",
    "privacy.external.cloudflare.purpose":
        "本サービスの配信、予約投稿の保管と実行、運用の記録（運営者が委託する配信基盤）",
    "privacy.external.sns.dest": "共有先の SNS（X・タイッツー・Mastodon）",
    "privacy.external.sns.data":
        "共有する本文と Skyshare の URL（利用者が共有の操作をしたときに、利用者のブラウザが開く共有画面を通じて渡されます）",
    "privacy.external.sns.purpose": "利用者が選んだ SNS への共有",
    "privacy.external.note1":
        "Cloudflare や Bluesky の事業者は米国などの外国にあります。これらの外国への情報の送信は、上記の目的の範囲に限ります。各国の個人情報の保護制度は日本と異なる場合があります。",
    "privacy.external.note2":
        "運営者は、これらの外部サービスの個人情報の取扱いを管理できません。各サービスのプライバシーポリシーをご確認ください。",
    "privacy.retention.title": "5. 保存期間",
    "privacy.retention.item1":
        "ログインの Cookie: 最後のログインまたは更新から7日間。ログアウトすると削除されます。",
    "privacy.retention.item2":
        "端末内の保存: 利用者が削除するまでブラウザに残ります。",
    "privacy.retention.item3":
        "予約投稿の内容: 実行されるまで保管します。実行の成功または失敗の記録は、終了から7日後に自動で削除します。取消した予約はただちに削除します。",
    "privacy.retention.item4":
        "予約投稿の添付画像: 実行の成功または取消の時点で削除します。実行されなかった画像も、保管から45日で自動的に削除します。",
    "privacy.retention.item5":
        "予約用の認証情報: 予約が残っていない状態になると自動で削除します。利用者は一覧のページからいつでも削除できます。",
    "privacy.retention.item6":
        "アクセスログ: Cloudflare の仕様に従い、運用に必要な短い期間だけ保持されます。",
    "privacy.retention.item7":
        "旧形式の投稿ページ: 旧バックエンドの定める期間か、投稿者本人が削除するまで保管されます。",
    "privacy.retention.item8":
        "PDS に保存された投稿・下書き・entry: 利用者が削除するか、アカウントを削除するまで保管されます。",
    "privacy.security.title": "6. 安全管理のための措置",
    "privacy.security.item1": "通信はすべて HTTPS で保護します。",
    "privacy.security.item2":
        "認証トークンの Cookie は HttpOnly・Secure・SameSite を指定し、ブラウザ上のスクリプトから読み取れないようにします。",
    "privacy.security.item3":
        "予約投稿では、パスワードそのものを保存しません。Bluesky への認証で得たリフレッシュトークンだけを、AES-GCM で暗号化して保管し、暗号鍵は運営者だけが管理します。",
    "privacy.security.item4":
        "予約投稿の認証には、権限を絞ったアプリパスワードの利用を求めます。メインのパスワードは入力しないでください。",
    "privacy.security.item5":
        "運営者のデータへのアクセスは運営者本人に限り、不要になった情報は上記の期間で削除します。",
    "privacy.rights.title": "7. 利用者の権利と問い合わせ窓口",
    "privacy.rights.intro":
        "利用者は、運営者が保有する自分の個人情報について、開示・訂正・追加・削除・利用の停止・第三者への提供の停止を求めることができます。次の窓口へご連絡ください。ご本人であることを確認したうえで、法令に従い遅滞なく対応します。",
    "privacy.rights.contact":
        "窓口: {email}、または Bluesky のアカウント @{handle}",
    "privacy.rights.item1":
        "予約投稿の取消と履歴の削除、予約用の認証情報の削除は、「予約」の一覧のページからご自身で行えます。",
    "privacy.rights.item2":
        "Bluesky の PDS に保存された投稿・下書き・entry の削除は、本サービスまたは Bluesky の機能で行ってください。",
    "privacy.rights.item3":
        "旧形式の投稿ページは、投稿者本人が本サービスの画面から削除できます。",
    "privacy.rights.item4":
        "端末内の保存は、ブラウザの設定からいつでも削除できます。",
    "privacy.revision.title": "8. ポリシーの改定",
    "privacy.revision.body":
        "運営者は、法令の変更や機能の追加に合わせて、本ポリシーを改定することがあります。重要な変更は本サービスの画面で周知します。改定後は、このページに掲載した時点から効力を持ちます。",
    "privacy.revision.dates": "制定日: {enactedAt}／最終改定日: {revisedAt}",
    "privacy.link": "プライバシーポリシー",
    "privacy.scheduleNotice":
        "予約のために保管する情報の扱いは、{link}をご確認ください。",
} as const

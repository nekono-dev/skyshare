/**
 * プライバシーポリシーの文言（日本語。正本）。
 * 本サービスが利用者から預かる情報に絞って書く。取得する情報・保存期間などの事実は実装に合わせる。
 * Cookie・端末内の保存項目・予約の保管期間を変えたときは同じ変更で更新する。
 * `{operator}`/`{email}`/`{handle}`/`{enactedAt}`/`{revisedAt}` は `operator.ts` の値が入る。
 */
export const privacy = {
    "privacy.heading": "プライバシーポリシー",
    "privacy.lead":
        "{operator}（以下「運営者」といいます。）は、Skyshare（以下「本サービス」といいます。）における利用者の個人情報の取扱いについて、個人情報の保護に関する法律その他の法令を守り、以下のとおり定めます。",
    "privacy.operator.title": "第1条（運営者）",
    "privacy.operator.name": "本サービスは、{operator}が個人で運営しています。",
    "privacy.operator.contact":
        "お問い合わせは、{email}または Bluesky の @{handle} までお願いします。",
    "privacy.collected.title": "第2条（取得する情報）",
    "privacy.collected.intro":
        "本サービスは、次の情報を取り扱います。会員登録はなく、運営者が利用者の名簿を持つこともありません。",
    "privacy.collected.login":
        "ログインの際に、ハンドルまたはメールアドレスとパスワードを受け取ります。パスワードは保存しません。",
    "privacy.collected.schedule":
        "予約投稿をご利用の場合に限り、投稿の内容・画像・実行日時と、実行に必要なログイン情報を保管します。",
    "privacy.collected.device":
        "表示言語などの設定は、利用者のブラウザにのみ保存し、運営者には送信されません。",
    "privacy.collected.log":
        "アクセスログとして、日時・URL・IP アドレス・ブラウザの種類が記録されます。",
    "privacy.collected.analytics":
        "Google アナリティクスにより、閲覧したページ・端末やブラウザの種類・おおよその地域を収集します。",
    "privacy.collected.note":
        "通常の投稿や下書きは、利用者の Bluesky に保存され、運営者は保管しません。",
    "privacy.purpose.title": "第3条（利用目的）",
    "privacy.purpose.intro": "取得した情報は、次の目的以外には利用しません。",
    "privacy.purpose.item1": "Bluesky への投稿など、ご利用の機能を提供するため",
    "privacy.purpose.item2":
        "予約した日時に、利用者のアカウントで自動的に投稿するため",
    "privacy.purpose.item3": "利用状況を把握し、サービスを改善するため",
    "privacy.purpose.item4": "不具合の調査と不正利用の防止のため",
    "privacy.external.title": "第4条（第三者への提供）",
    "privacy.external.intro":
        "運営者は、次の場合を除き、利用者の同意なく個人情報を第三者に提供しません。",
    "privacy.external.item1": "法令に基づく場合",
    "privacy.external.item2":
        "ログインや投稿のため、Bluesky に必要な情報を送信する場合",
    "privacy.external.item3":
        "配信と運用を委託している Cloudflare に、通信の内容と予約のデータを預ける場合",
    "privacy.external.item4":
        "利用状況の把握のため、Google に閲覧の状況を送信する場合",
    "privacy.external.note1":
        "他の SNS への共有は、利用者が選んだときに限り、共有する文章と URL を渡します。",
    "privacy.external.note2":
        "送信先の一部は日本国外にあります。各社での取扱いは、各社のポリシーに従います。",
    "privacy.external.note3":
        "この記載は、電気通信事業法に基づく外部送信の公表を兼ねています。",
    "privacy.retention.title": "第5条（保存期間と安全管理）",
    "privacy.retention.item1":
        "ログインの情報は、7日間保存し、ログアウトすると削除します。",
    "privacy.retention.item2":
        "予約の内容は、実行が終わってから7日後に削除します。取り消したときは、ただちに削除します。",
    "privacy.retention.item3":
        "予約の画像は、実行または取消の時点で削除します。使われなかった画像は、45日後に削除します。",
    "privacy.retention.item4":
        "予約用のログイン情報は、暗号化して保管します。予約がなくなった時点で削除し、利用者がいつでも自分で削除することもできます。",
    "privacy.retention.item5":
        "アクセスログとアクセス解析の情報は、各社が定める期間のみ保管されます。",
    "privacy.retention.item6": "通信は暗号化して保護しています。",
    "privacy.retention.item7":
        "予約には、権限を限定したアプリパスワードをご利用ください。",
    "privacy.cookies.title": "第6条（Cookie とアクセス解析）",
    "privacy.cookies.item1":
        "ログインの維持と設定の保存のために、Cookie とブラウザの保存領域を使います。",
    "privacy.cookies.item2":
        "利用状況の把握のために、Google アナリティクスの Cookie を使います。ログインの有無にかかわらず、すべてのページが対象です。",
    "privacy.cookies.item3":
        "アクセス解析は、ブラウザの Cookie 設定や、Google が提供する拡張機能で停止できます。",
    "privacy.cookies.item4": "広告の配信は行っていません。",
    "privacy.rights.title": "第7条（開示・訂正・削除等の請求）",
    "privacy.rights.intro":
        "利用者は、運営者が保有する自己の個人情報について、開示・訂正・削除・利用停止を請求できます。本人であることを確認したうえで、遅滞なく対応します。",
    "privacy.rights.contact": "請求は、第1条の連絡先までお願いします。",
    "privacy.rights.item1":
        "予約の取消、履歴の削除、予約用ログイン情報の削除は、予約の一覧ページから行えます。",
    "privacy.rights.item2": "端末内の設定は、ブラウザの設定から削除できます。",
    "privacy.revision.title": "第8条（改定）",
    "privacy.revision.body":
        "法令の変更や機能の追加に応じて、このポリシーを改定することがあります。改定後の内容は、このページに掲載した時点から効力を生じます。",
    "privacy.revision.dates": "制定日: {enactedAt}／最終改定日: {revisedAt}",
    "privacy.link": "プライバシーポリシー",
    "privacy.scheduleNotice":
        "予約のために保管する情報の扱いは、{link}をご確認ください。",
} as const

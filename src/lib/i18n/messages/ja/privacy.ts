/**
 * プライバシーポリシーの文言（日本語。正本）。
 * 取得する情報・保存期間などの事実は実装に合わせる。Cookie・端末内の保存項目・予約の保管期間を変えたときは同じ変更で更新する。
 * 一般的な日本語のプライバシーポリシーの書き方に合わせ、文は短く、技術の細部は書かない。
 * `{operator}`/`{email}`/`{handle}`/`{enactedAt}`/`{revisedAt}` は `operator.ts` の値が入る。
 */
export const privacy = {
    "privacy.heading": "プライバシーポリシー",
    "privacy.lead":
        "{operator}（以下「運営者」といいます。）は、Skyshare（以下「本サービス」といいます。）における利用者の個人情報の取扱いについて、個人情報の保護に関する法律その他の法令を守り、以下のとおり定めます。",
    "privacy.operator.title": "第1条（運営者）",
    "privacy.operator.name":
        "事業者の名称は{operator}です。個人で運営しています。",
    "privacy.operator.contact":
        "お問い合わせは、{email}または Bluesky の @{handle} までお願いします。",
    "privacy.operator.definition":
        "個人情報とは、ハンドルや投稿の内容など、特定の個人を識別できる情報をいいます。",
    "privacy.collected.title": "第2条（取得する情報）",
    "privacy.collected.intro":
        "本サービスは、機能をご利用いただく際に、次の情報を取り扱います。会員登録の仕組みはなく、運営者が利用者の名簿を保有することもありません。",
    "privacy.collected.login":
        "ログインの際に、ハンドルまたはメールアドレスとパスワードを受け取ります。パスワードは保存しません。",
    "privacy.collected.post":
        "投稿の本文・画像・動画・下書きと、共有用のページ情報は、利用者ご自身の Bluesky に保存されます。運営者は保管しません。",
    "privacy.collected.schedule":
        "予約投稿をご利用の場合に限り、投稿の内容・画像・実行日時と、予約の実行に必要なログイン情報を、運営者の管理する場所に保管します。",
    "privacy.collected.device":
        "表示言語やテーマなどの設定は、利用者のブラウザにのみ保存され、運営者には送信されません。",
    "privacy.collected.log":
        "アクセスログとして、日時・URL・IP アドレス・ブラウザの種類が、配信を委託している Cloudflare に記録されます。",
    "privacy.collected.analytics":
        "利用状況の把握のため、Google アナリティクスにより、閲覧したページ・端末やブラウザの種類・おおよその地域を収集します。収集には Cookie を使い、ログインの有無にかかわらずすべてのページが対象です。",
    "privacy.collected.note1": "広告の配信は行っていません。",
    "privacy.collected.note2": "病歴や信条など、要配慮個人情報は取得しません。",
    "privacy.purpose.title": "第3条（利用目的）",
    "privacy.purpose.intro": "取得した情報は、次の目的の範囲内で利用します。",
    "privacy.purpose.item1":
        "Bluesky への投稿や削除など、ご利用の機能を提供するため",
    "privacy.purpose.item2":
        "予約した日時に、利用者のアカウントで自動的に投稿するため",
    "privacy.purpose.item3": "利用者が選んだ設定を保持するため",
    "privacy.purpose.item4": "リンクカードの表示や他の SNS への共有を行うため",
    "privacy.purpose.item5": "利用状況を把握し、サービスの改善に役立てるため",
    "privacy.purpose.item6": "不具合の調査と不正利用の防止のため",
    "privacy.external.title": "第4条（外部への送信と第三者への提供）",
    "privacy.external.intro":
        "運営者は、法令に基づく場合を除き、利用者の同意なく個人情報を第三者に提供しません。ただし、機能の提供のため、次の外部サービスに情報を送信します。この記載は、電気通信事業法に基づく外部送信の公表を兼ねています。",
    "privacy.external.bluesky":
        "Bluesky には、ログインや投稿のため、ログイン情報・投稿・画像・動画を送信します。",
    "privacy.external.plc":
        "PLC Directory には、利用者の保存先を調べるため、アカウントの識別子（DID）を送信します。",
    "privacy.external.ogp":
        "運営者が管理する OGP 抽出サービスには、リンク先の題名や画像を取得するため、投稿に含まれる URL を送信します。",
    "privacy.external.legacy":
        "旧バックエンドには、過去の投稿ページの表示と本人による削除のため、投稿の識別子を送信します。",
    "privacy.external.cloudflare":
        "Cloudflare には、本サービスの配信と運用を委託しており、通信の内容と予約のデータが預けられます。",
    "privacy.external.google":
        "Google（Google アナリティクス）には、利用状況の把握のため、閲覧の状況を送信します。",
    "privacy.external.sns":
        "X・タイッツー・Mastodon には、利用者が共有を選んだときに限り、共有する文章と URL が渡されます。",
    "privacy.external.optout":
        "アクセス解析は、ブラウザの Cookie 設定や、Google が提供するオプトアウト用の拡張機能で停止できます。",
    "privacy.external.note1":
        "送信先の一部は米国など日本国外にあり、個人情報の保護に関する制度が日本と異なる場合があります。",
    "privacy.external.note2":
        "各サービスでの取扱いについては、各社のプライバシーポリシーをご確認ください。",
    "privacy.retention.title": "第5条（保存期間）",
    "privacy.retention.item1":
        "ログインの情報は、7日間保存し、ログアウトすると削除します。",
    "privacy.retention.item2":
        "端末内の設定は、利用者が削除するまでブラウザに残ります。",
    "privacy.retention.item3":
        "予約の内容は、実行が終わってから7日後に削除します。取り消した場合は、ただちに削除します。",
    "privacy.retention.item4":
        "予約の画像は、実行または取消の時点で削除します。使われなかった画像も、45日後に自動で削除します。",
    "privacy.retention.item5":
        "予約用のログイン情報は、予約がなくなった時点で削除します。利用者がいつでも自分で削除することもできます。",
    "privacy.retention.item6":
        "アクセスログは、Cloudflare が定める期間のみ保持されます。",
    "privacy.retention.item7":
        "アクセス解析の情報は、Google の設定に従って保管されます。",
    "privacy.security.title": "第6条（安全管理）",
    "privacy.security.item1": "通信は暗号化して保護しています。",
    "privacy.security.item2":
        "ログインの情報は、ブラウザ上のプログラムから読み取れない形で保存しています。",
    "privacy.security.item3":
        "予約では、パスワードを保存せず、ログイン情報も暗号化して保管しています。",
    "privacy.security.item4":
        "予約には、権限を限定したアプリパスワードをご利用ください。メインのパスワードは入力しないでください。",
    "privacy.security.item5":
        "運営者が管理する情報には、運営者以外はアクセスできません。",
    "privacy.rights.title": "第7条（開示・訂正・削除等の請求）",
    "privacy.rights.intro":
        "利用者は、運営者が保有する自己の個人情報について、開示・訂正・削除・利用停止を請求できます。本人であることを確認したうえで、遅滞なく対応します。",
    "privacy.rights.contact":
        "請求やお問い合わせは、{email}または Bluesky の @{handle} までお願いします。",
    "privacy.rights.item1":
        "予約の取消、履歴の削除、予約用ログイン情報の削除は、予約の一覧ページから行えます。",
    "privacy.rights.item2":
        "Bluesky に保存された投稿などは、本サービスまたは Bluesky から削除できます。",
    "privacy.rights.item3": "端末内の設定は、ブラウザの設定から削除できます。",
    "privacy.revision.title": "第8条（改定）",
    "privacy.revision.body":
        "法令の変更や機能の追加などに応じて、このポリシーを改定することがあります。改定後の内容は、このページに掲載した時点から効力を生じます。",
    "privacy.revision.dates": "制定日: {enactedAt}／最終改定日: {revisedAt}",
    "privacy.link": "プライバシーポリシー",
    "privacy.scheduleNotice":
        "予約のために保管する情報の扱いは、{link}をご確認ください。",
} as const

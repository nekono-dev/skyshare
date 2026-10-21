/**
 * プライバシーポリシーの文言（日本語。正本）。
 * 本サービスが利用者から預かる情報に絞り、個人情報保護法が公表を求める事項（32条）を漏らさず書く。
 * 取得する情報・保存期間・委託先などの事実は実装に合わせ、変えたときは同じ変更で更新する。
 * `{operator}`/`{email}`/`{handle}`/`{enactedAt}`/`{revisedAt}` は `operator.ts` の値が入る。
 */
export const privacy = {
    "privacy.heading": "プライバシーポリシー",
    "privacy.lead":
        "{operator}（以下「運営者」といいます。）は、Skyshare（以下「本サービス」といいます。）における利用者の個人情報の取扱いについて、個人情報の保護に関する法律その他の法令を守り、以下のとおり定めます。",
    "privacy.operator.title": "第1条（運営者と窓口）",
    "privacy.operator.name":
        "本サービスの運営者は、{operator}（活動名）です。運営者の氏名と住所は、請求があれば遅滞なく回答します。",
    "privacy.operator.contact":
        "個人情報の取扱いに関するお問い合わせと苦情は、{email}または Bluesky の @{handle} で受け付けます。",
    "privacy.collected.title": "第2条（取得する情報）",
    "privacy.collected.intro": "本サービスは、次の情報を取得します。",
    "privacy.collected.login":
        "ログインの際に、ハンドルまたはメールアドレスとパスワードを受け取ります。パスワードは保存しません。",
    "privacy.collected.schedule":
        "予約投稿をご利用の場合に限り、投稿の内容・画像・実行日時と、実行に必要なアカウントの識別子とログイン情報を保管します。",
    "privacy.collected.device":
        "表示言語などの設定は、利用者のブラウザにのみ保存し、運営者には送信されません。",
    "privacy.collected.log":
        "本サービスへのアクセスの際に、日時・URL・IP アドレス・ブラウザの種類を記録します。",
    "privacy.collected.analytics":
        "Google アナリティクスにより、閲覧したページ・端末やブラウザの種類・おおよその地域を収集します。",
    "privacy.collected.inquiry":
        "お問い合わせの際に、メールアドレスまたは Bluesky のアカウントと、お問い合わせの内容を受け取ります。",
    "privacy.collected.note":
        "通常の投稿や下書きは利用者の Bluesky に保存され、運営者は保管しません。",
    "privacy.purpose.title": "第3条（利用目的）",
    "privacy.purpose.intro": "取得した情報は、次の目的に限って利用します。",
    "privacy.purpose.item1": "Bluesky への投稿など、ご利用の機能を提供するため",
    "privacy.purpose.item2":
        "予約した日時に、利用者のアカウントで自動的に投稿するため",
    "privacy.purpose.item3": "利用状況を把握し、本サービスを改善するため",
    "privacy.purpose.item4": "不具合の調査と不正利用の防止のため",
    "privacy.purpose.item5": "お問い合わせに回答するため",
    "privacy.purpose.change":
        "利用目的は、変更前の目的と相当の関連性がある範囲でのみ変更し、変更後の目的はこのページで公表します。",
    "privacy.external.title": "第4条（第三者への提供）",
    "privacy.external.intro":
        "運営者は、次の場合を除き、あらかじめ利用者の同意を得ずに、個人情報を第三者に提供しません。",
    "privacy.external.item1": "法令に基づく場合",
    "privacy.external.item2":
        "人の生命・身体・財産の保護のために必要で、利用者の同意を得ることが難しい場合",
    "privacy.external.item3":
        "その他、個人情報の保護に関する法律で認められる場合",
    "privacy.external.note":
        "Bluesky への投稿や他の SNS への共有は、利用者の操作に基づいて、利用者が選んだ先へ送信するものです。",
    "privacy.retention.title": "第5条（保存期間）",
    "privacy.retention.item1":
        "ログインの情報は、ブラウザに7日間保存し、ログアウトすると削除します。",
    "privacy.retention.item2":
        "予約の内容は、実行が終わってから7日後に削除します。取り消したときは、ただちに削除します。",
    "privacy.retention.item3":
        "予約の画像は、実行または取消の時点で削除します。使われなかった画像は、45日後に削除します。",
    "privacy.retention.item4":
        "予約用のログイン情報は、予約がなくなった時点で削除します。利用者がいつでも自分で削除することもできます。",
    "privacy.retention.item5":
        "アクセスログは、Cloudflare が定める期間に限り保管されます。",
    "privacy.retention.item6":
        "アクセス解析の情報は、Google アナリティクスの保持期間の設定に従い、Google が保管します。",
    "privacy.security.title": "第6条（安全管理措置）",
    "privacy.security.intro":
        "運営者は、個人情報の漏えいなどを防ぐため、次の措置を講じます。",
    "privacy.security.item1": "個人情報を取り扱うのは、運営者本人に限ります。",
    "privacy.security.item2": "通信は暗号化して保護します。",
    "privacy.security.item3": "予約用のログイン情報は、暗号化して保管します。",
    "privacy.security.item4":
        "本サービスの配信と予約のデータの保管は、米国の Cloudflare, Inc. に委託しています。",
    "privacy.security.item5":
        "米国の個人情報の保護に関する制度は、個人情報保護委員会のウェブサイトで確認できます。",
    "privacy.security.note":
        "予約には、メインのパスワードではなく、権限を限定したアプリパスワードをご利用ください。",
    "privacy.cookies.title": "第7条（Cookie とアクセス解析）",
    "privacy.cookies.item1":
        "ログインの維持に Cookie を、設定の保存にブラウザの保存領域を使います。",
    "privacy.cookies.item2":
        "利用状況の把握のため、米国の Google LLC が提供する Google アナリティクスを、すべてのページで使います。",
    "privacy.cookies.item3":
        "Google アナリティクスは、Cookie を使い、閲覧したページと端末やブラウザの情報を Google に送信します。",
    "privacy.cookies.item4":
        "Google での取扱いは、Google のプライバシーポリシー（https://policies.google.com/privacy）に従います。",
    "privacy.cookies.item5":
        "アクセス解析は、ブラウザの Cookie 設定や、Google が提供するオプトアウト用の拡張機能で停止できます。",
    "privacy.rights.title": "第8条（開示等の請求）",
    "privacy.rights.intro":
        "利用者は、運営者が保有する自己の個人情報について、次の請求ができます。",
    "privacy.rights.item1": "利用目的の通知と、内容の開示",
    "privacy.rights.item2": "内容の訂正・追加・削除",
    "privacy.rights.item3": "利用の停止・消去と、第三者への提供の停止",
    "privacy.rights.procedure1": "請求は、第1条の窓口で受け付けます。",
    "privacy.rights.procedure2":
        "本人確認は、対象の Bluesky アカウントからの連絡によって行います。",
    "privacy.rights.procedure3":
        "手数料はいただきません。開示は電子メールで行います。",
    "privacy.rights.procedure4": "請求には、法令に従って遅滞なく対応します。",
    "privacy.rights.self1":
        "予約の取消、履歴の削除、予約用ログイン情報の削除は、予約の一覧ページからご自身で行えます。",
    "privacy.rights.self2":
        "端末内の設定は、ブラウザの設定からご自身で削除できます。",
    "privacy.revision.title": "第9条（改定）",
    "privacy.revision.body":
        "法令の変更や機能の追加に応じて、このポリシーを改定することがあります。改定後の内容は、このページに掲載した時点から効力を生じます。",
    "privacy.revision.dates": "制定日: {enactedAt}／最終改定日: {revisedAt}",
    "privacy.link": "プライバシーポリシー",
    "privacy.scheduleNotice":
        "予約のために保管する情報の扱いは、{link}をご確認ください。",
} as const

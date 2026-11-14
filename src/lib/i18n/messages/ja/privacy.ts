/**
 * プライバシーポリシーの文言（日本語。正本）。
 * 一般的なプライバシーポリシーの構成に沿い、本サービスが扱う情報に絞って簡潔に書く。
 * 扱う情報・保持期間・委託先などの事実は実装に合わせ、変えたときは同じ変更で更新する。
 * `{enactedAt}`/`{revisedAt}` は `lib/site/siteConfig.ts` の値が入る。
 */
export const privacy = {
    "privacy.heading": "プライバシーポリシー",
    "privacy.lead":
        "Skyshare（以下「本サービス」）は、Bluesky への投稿を支援するウェブアプリケーションです。このポリシーは、本サービスでの利用者の情報の取り扱いを説明します。",
    "privacy.operator.title": "運営者と連絡先",
    "privacy.operator.name": "運営者",
    "privacy.operator.email": "メールアドレス",
    "privacy.operator.bluesky": "Bluesky",
    "privacy.collected.title": "収集する情報",
    "privacy.collected.intro": "本サービスは、次の情報を扱います。",
    "privacy.collected.login": "Blueskyアカウントに関する認証情報",
    "privacy.collected.schedule":
        "予約投稿機能有効化時は、添付画像を含む投稿内容およびBlueskyアカウントに関する認証情報",
    "privacy.collected.traffic":
        "ホスティングプロバイダが収集するIPアドレスやブラウザ情報",
    "privacy.collected.analytics": "Google アナリティクスによる利用状況",
    "privacy.collected.inquiry":
        "お問い合わせの際のメールアドレスまたは Bluesky のアカウントと、お問い合わせの内容",
    "privacy.collected.feedback":
        "不具合の報告・機能の提案フォーム利用時は、入力情報及びアカウント識別情報、利用者端末情報および本サービスに関する情報",
    "privacy.collected.survey":
        "アンケート回答時は、アンケート回答内容と重複回答防止の為の識別子",
    "privacy.purpose.title": "利用目的",
    "privacy.purpose.intro": "収集した情報は、次の目的にだけ利用します。",
    "privacy.purpose.item1": "Bluesky への投稿など、本サービスの機能の提供",
    "privacy.purpose.item2": "予約した日時での自動投稿",
    "privacy.purpose.item3": "利用状況の把握と本サービスの改善",
    "privacy.purpose.item4": "不具合の調査と不正利用の防止",
    "privacy.purpose.item5": "お問い合わせへの回答",
    "privacy.external.title": "情報の共有",
    "privacy.external.intro":
        "次の場合を除き、利用者の情報を第三者と共有しません。",
    "privacy.external.item1":
        "利用者の操作に基づく、Bluesky への投稿や他の SNS への共有",
    "privacy.external.item2":
        "本サービスの配信とデータの保管を委託するホスティングプロバイダでの取り扱い",
    "privacy.external.item3": "アクセス解析のための Google への送信",
    "privacy.external.github": "バグ報告または機能提案内容の公開",
    "privacy.external.item4": "法令に基づく要請がある場合",
    "privacy.external.surveyResults": "アンケートの結果公表",
    "privacy.retention.title": "保持期間",
    "privacy.retention.item1":
        "ログインの情報は、ブラウザに7日間保存し、ログアウトすると削除します。",
    "privacy.retention.item2":
        "予約の内容と画像は、投稿に成功するか取り消した時点で削除します。失敗した予約は7日後に、残った画像も15日以内に削除します。",
    "privacy.retention.item3":
        "予約投稿機能有効化時は、認証情報が無効になった、または機能が30日使われていない場合に削除されます。",
    "privacy.retention.item4":
        "通信の情報は、ホスティングプロバイダが定める期間に限り保持されます。",
    "privacy.retention.item5":
        "アクセス解析の情報は、Google アナリティクスの保持期間の設定に従います。",
    "privacy.retention.feedback":
        "不具合の報告・機能の提案は、GitHub の Issue として残ります。削除をご希望の場合は連絡先までご連絡ください。",
    "privacy.retention.surveyAnswer":
        "アンケートの回答は、終了後に集計の結果を保存した時点で削除します。",
    "privacy.security.title": "セキュリティ",
    "privacy.security.intro":
        "利用者の情報を守るため、次の対策をとっています。",
    "privacy.security.item1": "通信は暗号化しています。",
    "privacy.security.item2": "予約用の認証情報は、暗号化して保管します。",
    "privacy.security.item3": "情報を扱うのは運営者に限ります。",
    "privacy.cookies.title": "Cookie とアクセス解析",
    "privacy.cookies.titleBasic": "Cookie",
    "privacy.cookies.item1":
        "ログインの維持に Cookie を、設定の保存にブラウザの保存領域を使います。",
    "privacy.cookies.item2":
        "利用状況の分析に、Google LLC の Google アナリティクスを使います。Cookie を使い、閲覧したページと端末の情報を Google に送信します。",
    "privacy.cookies.item3":
        "Google での取り扱いは、Google のプライバシーポリシー（https://policies.google.com/privacy）をご覧ください。",
    "privacy.cookies.item4":
        "ブラウザの Cookie の設定や、Google のオプトアウト用の拡張機能で、アクセス解析を止められます。",
    "privacy.rights.title": "ユーザーの権利",
    "privacy.rights.intro":
        "利用者は、ご自身の情報の開示・訂正・削除を求めることができます。上記の連絡先までご連絡ください。",
    "privacy.rights.self":
        "予約投稿の変更・取消・削除は投稿フォームの「下書き・予約」から行えます。予約機能を無効化した場合、予約内容およびBlueskyアカウントに関する認証情報は削除されます。",
    "privacy.rights.survey": "アンケートの回答は、送信後に取り消せません。",
    "privacy.revision.title": "このポリシーの変更",
    "privacy.revision.body":
        "このポリシーは、必要に応じて変更することがあります。変更後の内容は、このページに掲載した時点から適用します。",
    "privacy.revision.dates": "制定日: {enactedAt}／最終改定日: {revisedAt}",
    "privacy.link": "プライバシーポリシー",
} as const

/**
 * 不具合の報告・新機能の提案のフォームの文言（日本語。正本）。
 * `{number}` は作成された Issue の番号が入る。
 */
export const feedback = {
    "feedback.heading": "不具合の報告・新機能の提案",
    "feedback.lead":
        "Skyshare の不具合の報告と、新しい機能の提案を受け付けています。",
    "feedback.loginRequired":
        "送信するには、Bluesky のアカウントでログインしてください。",
    "feedback.loginLink": "ログインする",
    "feedback.kind.label": "種類",
    "feedback.kind.bug": "不具合の報告",
    "feedback.kind.enhancement": "新機能の提案",
    "feedback.title.bug": "不具合を端的に説明",
    "feedback.title.enhancement": "新機能を端的に説明",
    "feedback.counter": "文字",
    "feedback.steps.label": "操作した内容",
    "feedback.steps.placeholder":
        "どの画面で、何をしたら、どうなったかを書いてください。",
    "feedback.reproducibility.label": "もう一度操作して同じことが起きるか",
    "feedback.reproducibility.always": "毎回起きる",
    "feedback.reproducibility.sometimes": "ときどき起きる",
    "feedback.reproducibility.no": "起きない",
    "feedback.reproducibility.untested": "試していない",
    "feedback.description.label": "どのような機能か",
    "feedback.description.placeholder":
        "欲しい機能と、それで何ができるようになるかを書いてください。",
    "feedback.technicalNotes.label": "技術的な補足（任意）",
    "feedback.technicalNotes.placeholder":
        "実現の方法や参考になる情報があれば書いてください。",
    "feedback.notice.title": "送信の前にご確認ください",
    "feedback.notice.body":
        "送信すると、入力した内容に加えて、Bluesky のハンドル名と下記の環境の情報が自動で収集され、開発者に共有されます。",
    "feedback.notice.public":
        "これらは GitHub の公開の Issue として掲載され、誰でも閲覧できます。個人の情報やパスワードは書かないでください。",
    "feedback.collected.account": "Bluesky",
    "feedback.collected.version": "Skyshare の版",
    "feedback.collected.commit": "コミット",
    "feedback.collected.os": "OS",
    "feedback.collected.browser": "ブラウザ",
    "feedback.collected.standalone": "ホーム画面からの起動（PWA）",
    "feedback.collected.userAgent": "ブラウザの識別文字列",
    "feedback.collected.yes": "はい",
    "feedback.collected.no": "いいえ",
    "feedback.submit": "送信する",
    "feedback.submitting": "送信しています...",
    "feedback.success": "送信しました。ご協力ありがとうございます。",
    "feedback.successLink": "作成された Issue を見る（#{number}）",
    "feedback.error.rateLimited":
        "続けて送信できません。1分ほど待ってから、もう一度お試しください。",
    "feedback.error.unavailable":
        "ただいま受け付けを停止しています。時間を置いてお試しください。",
    "feedback.back": "設定に戻る",
} as const

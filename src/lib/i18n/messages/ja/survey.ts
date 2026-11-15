/**
 * アンケート画面の固定文言（日本語。正本）。
 * 質問・選択肢の文言はアンケート設定が所有する。
 */
export const survey = {
    "survey.entry": "アンケートにご協力ください",
    "survey.submit": "送信する",
    "survey.close": "閉じる",
    "survey.title": "アンケートへのご協力ありがとうございます",
    "survey.deadline": "回答期限: {date} まで",
    "survey.privacy": "回答内容については{link}に従って取り扱います。",
    "survey.declineHint":
        "「回答しない」を選んで閉じると、回答は送信されません。後からボタンで開き直せます。",
    "survey.submitFailed":
        "回答を送信できませんでした。もう一度送信してください。",
    "surveyResults.heading": "アンケートの結果",
    "surveyResults.period": "{start} 〜 {end}",
} as const

/**
 * アンケート画面の固定文言（英語）。
 * 日本語の正本と同じキー集合を型で強制し、設定側の質問・選択肢文言は含めない。
 */
import type { survey as jaSurvey } from "../ja/survey"

export const survey = {
    "survey.entry": "Please help with our survey",
    "survey.submit": "Submit",
    "survey.decline": "Prefer not to answer",
    "survey.title": "Thank you for helping with our survey",
    "survey.deadline": "Respond by {date}",
    "survey.privacy": "Your answers are handled in accordance with our {link}.",
    "survey.submitFailed":
        "Your answers could not be sent. Please try submitting again.",
    "surveyResults.heading": "Survey results",
    "surveyResults.period": "{start} – {end}",
} satisfies Record<keyof typeof jaSurvey, string>

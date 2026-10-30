/**
 * アンケート画面の固定文言（英語）。
 * 日本語の正本と同じキー集合を型で強制し、設定側の文言は含めない。
 */
import type { survey as jaSurvey } from "../ja/survey"

export const survey = {
    "survey.submit": "Submit",
    "survey.close": "Close",
    "survey.irreversible":
        "Your answers are saved anonymously. Once submitted, they cannot be withdrawn or changed.",
    "survey.incomplete": "Answer all questions to submit.",
    "survey.declineHint":
        'If you select "Prefer not to answer" and close, your answers will not be sent. We will ask again the next time you open the app.',
    "survey.submitFailed":
        "Your answers could not be sent. Please try submitting again.",
} satisfies Record<keyof typeof jaSurvey, string>

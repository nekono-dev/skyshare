// アンケート設定の固定の値（テスト専用）。有効な 1 件のアンケートを返す。
// 締め切りは 2026-12-01 00:00（JST）。回答者の一覧は締め切りで、回答は締め切りの 1 か月後に期限切れになる。

/** 有効な設定を毎回新しく作る（テスト内で書き換えても他に影響しない） */
export const createValidSurveyConfig = () => ({
    surveys: [
        {
            id: "survey-2026-a",
            opensAt: "2026-11-01T00:00:00+09:00",
            closesAt: "2026-12-01T00:00:00+09:00",
            questions: [
                {
                    id: "q-purpose",
                    kind: "single",
                    title: { ja: "主な目的は？", en: "Main purpose?" },
                    options: [
                        { id: "share", label: { ja: "共有", en: "Share" } },
                        { id: "save", label: { ja: "保存", en: "Save" } },
                    ],
                },
            ],
        },
    ],
})

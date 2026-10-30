/**
 * アンケート設定の検証用データ（テスト専用の資材）。
 *
 * 責務と処理概要:
 * - 有効な設定と、規則ごとに 1 点だけ壊した不正な設定を返す。
 * - アプリのソースコードには質問・選択肢・文言を持たせない（要件 4.4）ため、ここに置く。
 */

/** 不正な設定の 1 件。`expectedPath` は報告に含まれるべき位置。 */
export type InvalidCase = {
    name: string
    requirement: string
    config: unknown
    expectedPath: string
}

/**
 * 有効な設定を毎回新しく作る（テスト内で書き換えても他に影響しない）。
 *
 * Output:
 * - 2 つのアンケート（期間は隣接）。単一選択・複数選択（上限あり）・「回答しない」を含む
 */
export const createValidConfig = () => ({
    surveys: [
        {
            id: "survey-2026-a",
            opensAt: "2026-11-01T00:00:00+09:00",
            closesAt: "2026-12-01T00:00:00+09:00",
            title: { ja: "使い方アンケート", en: "Usage survey" },
            description: { ja: "ご協力ください", en: "Please help us" },
            questions: [
                {
                    id: "q-purpose",
                    kind: "single",
                    title: { ja: "主な目的は？", en: "Main purpose?" },
                    options: [
                        { id: "share", label: { ja: "共有", en: "Share" } },
                        { id: "save", label: { ja: "保存", en: "Save" } },
                        {
                            id: "none",
                            label: {
                                ja: "回答しない",
                                en: "Prefer not to say",
                            },
                            decline: true,
                        },
                    ],
                },
                {
                    id: "q-features",
                    kind: "multiple",
                    title: { ja: "使う機能は？", en: "Features you use?" },
                    maxSelect: 2,
                    options: [
                        { id: "a", label: { ja: "機能A", en: "Feature A" } },
                        { id: "b", label: { ja: "機能B", en: "Feature B" } },
                        { id: "c", label: { ja: "機能C", en: "Feature C" } },
                    ],
                },
            ],
        },
        {
            id: "survey-2026-b",
            opensAt: "2026-12-01T00:00:00+09:00",
            closesAt: "2027-01-01T00:00:00+09:00",
            title: { ja: "次のアンケート", en: "Next survey" },
            questions: [
                {
                    id: "q-one",
                    kind: "single",
                    title: { ja: "質問", en: "Question" },
                    options: [
                        { id: "yes", label: { ja: "はい", en: "Yes" } },
                        { id: "no", label: { ja: "いいえ", en: "No" } },
                    ],
                },
            ],
        },
    ],
})

type Config = ReturnType<typeof createValidConfig>

/**
 * 有効な設定を 1 点だけ壊した不正な設定の一覧を作る。
 *
 * Output:
 * - 規則ごとに 1 件の不正な設定
 */
export const createInvalidCases = (): InvalidCase[] => {
    const make = (mutate: (config: Config) => void): Config => {
        const config = createValidConfig()
        mutate(config)
        return config
    }
    return [
        {
            name: "アンケートの識別子に大文字を含む",
            requirement: "1.6",
            config: make(c => {
                c.surveys[0].id = "Survey-A"
            }),
            expectedPath: "surveys.0.id",
        },
        {
            name: "アンケートの識別子に下線を含む",
            requirement: "1.6",
            config: make(c => {
                c.surveys[0].id = "survey_a"
            }),
            expectedPath: "surveys.0.id",
        },
        {
            name: "アンケートの識別子が重複する",
            requirement: "1.6",
            config: make(c => {
                c.surveys[1].id = c.surveys[0].id
            }),
            expectedPath: "surveys.1.id",
        },
        {
            name: "質問の識別子が同じアンケート内で重複する",
            requirement: "1.7",
            config: make(c => {
                c.surveys[0].questions[1].id = c.surveys[0].questions[0].id
            }),
            expectedPath: "surveys.0.questions.1.id",
        },
        {
            name: "選択肢の識別子が同じ質問内で重複する",
            requirement: "1.7",
            config: make(c => {
                c.surveys[0].questions[0].options[1].id = "share"
            }),
            expectedPath: "surveys.0.questions.0.options.1.id",
        },
        {
            name: "質問が 1 つも無い",
            requirement: "1.8",
            config: make(c => {
                c.surveys[0].questions = []
            }),
            expectedPath: "surveys.0.questions",
        },
        {
            name: "選択肢が 1 つしかない",
            requirement: "1.8",
            config: make(c => {
                c.surveys[1].questions[0].options = [
                    c.surveys[1].questions[0].options[0],
                ]
            }),
            expectedPath: "surveys.1.questions.0.options",
        },
        {
            name: "「回答しない」が 1 質問に 2 つある",
            requirement: "1.9",
            config: make(c => {
                const options = c.surveys[0].questions[0].options
                options[0] = { ...options[0], decline: true } as never
            }),
            expectedPath: "surveys.0.questions.0.options",
        },
        {
            name: "複数選択の上限が 0",
            requirement: "1.3",
            config: make(c => {
                ;(
                    c.surveys[0].questions[1] as { maxSelect?: number }
                ).maxSelect = 0
            }),
            expectedPath: "surveys.0.questions.1.maxSelect",
        },
        {
            name: "複数選択の上限が選択肢の数を超える",
            requirement: "1.3",
            config: make(c => {
                ;(
                    c.surveys[0].questions[1] as { maxSelect?: number }
                ).maxSelect = 4
            }),
            expectedPath: "surveys.0.questions.1.maxSelect",
        },
        {
            name: "上限が「回答しない」を除く選択肢の数を超える",
            requirement: "1.3",
            config: make(c => {
                const q = c.surveys[0].questions[1] as {
                    maxSelect?: number
                    options: unknown[]
                }
                q.options = [
                    ...q.options,
                    {
                        id: "none",
                        label: { ja: "回答しない", en: "Prefer not to say" },
                        decline: true,
                    },
                ]
                q.maxSelect = 4
            }),
            expectedPath: "surveys.0.questions.1.maxSelect",
        },
        {
            name: "単一選択に上限を指定する",
            requirement: "1.3",
            config: make(c => {
                ;(
                    c.surveys[0].questions[0] as Record<string, unknown>
                ).maxSelect = 1
            }),
            expectedPath: "surveys.0.questions.0",
        },
        {
            name: "自由記述の種別",
            requirement: "1.5",
            config: make(c => {
                ;(c.surveys[0].questions[0] as Record<string, unknown>).kind =
                    "text"
            }),
            expectedPath: "surveys.0.questions.0.kind",
        },
        {
            name: "アンケートに定義にない項目がある",
            requirement: "1.10",
            config: make(c => {
                ;(c.surveys[0] as Record<string, unknown>).extra = "秘密の値"
            }),
            expectedPath: "surveys.0",
        },
        {
            name: "選択肢に定義にない項目がある",
            requirement: "1.10",
            config: make(c => {
                ;(
                    c.surveys[0].questions[0].options[0] as Record<
                        string,
                        unknown
                    >
                ).extra = "秘密の値"
            }),
            expectedPath: "surveys.0.questions.0.options.0",
        },
        {
            name: "設定の最上位に定義にない項目がある",
            requirement: "1.10",
            config: { ...createValidConfig(), extra: 1 },
            expectedPath: "(root)",
        },
        {
            name: "アンケートの配列が無い",
            requirement: "1.1",
            config: {},
            expectedPath: "surveys",
        },
        {
            name: "質問に種別が無い",
            requirement: "1.2",
            config: make(c => {
                delete (c.surveys[0].questions[0] as Record<string, unknown>)
                    .kind
            }),
            expectedPath: "surveys.0.questions.0.kind",
        },
    ]
}

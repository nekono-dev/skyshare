/**
 * プライバシーポリシーの節の組み立て。
 *
 * 責務と処理概要:
 * - 節の識別子と並びを固定し、表示言語の辞書（`privacy.*`）から見出しと本文を組み立てる。
 * - 事業者名・連絡先・日付は `operator.ts` の値を辞書のプレースホルダへ渡す。
 * - 本文は辞書にのみ置く。取得する情報などの事実を変えたときは辞書を同じ変更で更新する。
 */
import type { Translator } from "@/lib/i18n/translate"
import { operator } from "./operator"

export type PolicyBlock =
    | { kind: "text"; text: string }
    | { kind: "list"; items: string[] }
    | { kind: "table"; head: string[]; rows: string[][] }

export type PolicySection = {
    /** 表示言語や並び順に影響されない固定値 */
    id: string
    title: string
    blocks: PolicyBlock[]
}

/**
 * プライバシーポリシーの全節を、表示言語で組み立てる。
 *
 * Input:
 * - `t`: 翻訳関数
 *
 * Output:
 * - 事業者情報・取得する情報・利用目的・外部への送信・保存期間・安全管理・利用者の権利・改定の順の節
 */
export const buildPrivacyPolicy = (t: Translator["t"]): PolicySection[] => {
    const contact = {
        email: operator.email,
        handle: operator.blueskyHandle,
    }
    const text = (s: string): PolicyBlock => ({ kind: "text", text: s })
    const rows = <K extends string>(
        ids: readonly K[],
        cols: (id: K) => string[],
    ) => ids.map(cols)

    const collectedIds = ["login", "post", "schedule", "device", "log"] as const
    const externalIds = [
        "pds",
        "appview",
        "video",
        "cdn",
        "plc",
        "ogp",
        "legacy",
        "cloudflare",
        "sns",
    ] as const

    return [
        {
            id: "operator",
            title: t("privacy.operator.title"),
            blocks: [
                text(t("privacy.lead", { operator: operator.name })),
                {
                    kind: "list",
                    items: [
                        t("privacy.operator.name", { operator: operator.name }),
                        t("privacy.operator.contact", contact),
                    ],
                },
                text(t("privacy.operator.definition")),
            ],
        },
        {
            id: "collected",
            title: t("privacy.collected.title"),
            blocks: [
                text(t("privacy.collected.intro")),
                {
                    kind: "table",
                    head: [
                        t("privacy.collected.head.category"),
                        t("privacy.collected.head.data"),
                        t("privacy.collected.head.place"),
                    ],
                    rows: rows(collectedIds, id => [
                        t(`privacy.collected.${id}.category`),
                        t(`privacy.collected.${id}.data`),
                        t(`privacy.collected.${id}.place`),
                    ]),
                },
                {
                    kind: "list",
                    items: [
                        t("privacy.collected.note1"),
                        t("privacy.collected.note2"),
                        t("privacy.collected.note3"),
                    ],
                },
            ],
        },
        {
            id: "purpose",
            title: t("privacy.purpose.title"),
            blocks: [
                text(t("privacy.purpose.intro")),
                {
                    kind: "list",
                    items: [
                        t("privacy.purpose.item1"),
                        t("privacy.purpose.item2"),
                        t("privacy.purpose.item3"),
                        t("privacy.purpose.item4"),
                        t("privacy.purpose.item5"),
                        t("privacy.purpose.item6"),
                    ],
                },
            ],
        },
        {
            id: "external",
            title: t("privacy.external.title"),
            blocks: [
                text(t("privacy.external.intro")),
                {
                    kind: "table",
                    head: [
                        t("privacy.external.head.dest"),
                        t("privacy.external.head.data"),
                        t("privacy.external.head.purpose"),
                    ],
                    rows: rows(externalIds, id => [
                        t(`privacy.external.${id}.dest`),
                        t(`privacy.external.${id}.data`),
                        t(`privacy.external.${id}.purpose`),
                    ]),
                },
                {
                    kind: "list",
                    items: [
                        t("privacy.external.note1"),
                        t("privacy.external.note2"),
                    ],
                },
            ],
        },
        {
            id: "retention",
            title: t("privacy.retention.title"),
            blocks: [
                {
                    kind: "list",
                    items: [
                        t("privacy.retention.item1"),
                        t("privacy.retention.item2"),
                        t("privacy.retention.item3"),
                        t("privacy.retention.item4"),
                        t("privacy.retention.item5"),
                        t("privacy.retention.item6"),
                        t("privacy.retention.item7"),
                        t("privacy.retention.item8"),
                    ],
                },
            ],
        },
        {
            id: "security",
            title: t("privacy.security.title"),
            blocks: [
                {
                    kind: "list",
                    items: [
                        t("privacy.security.item1"),
                        t("privacy.security.item2"),
                        t("privacy.security.item3"),
                        t("privacy.security.item4"),
                        t("privacy.security.item5"),
                    ],
                },
            ],
        },
        {
            id: "rights",
            title: t("privacy.rights.title"),
            blocks: [
                text(t("privacy.rights.intro")),
                text(t("privacy.rights.contact", contact)),
                {
                    kind: "list",
                    items: [
                        t("privacy.rights.item1"),
                        t("privacy.rights.item2"),
                        t("privacy.rights.item3"),
                        t("privacy.rights.item4"),
                    ],
                },
            ],
        },
        {
            id: "revision",
            title: t("privacy.revision.title"),
            blocks: [
                text(t("privacy.revision.body")),
                text(
                    t("privacy.revision.dates", {
                        enactedAt: operator.enactedAt,
                        revisedAt: operator.revisedAt,
                    }),
                ),
            ],
        },
    ]
}

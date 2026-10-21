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
    { kind: "text"; text: string } | { kind: "list"; items: string[] }

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
 * - 運営者と窓口・取得する情報・利用目的・第三者への提供・保存期間・安全管理措置・Cookie とアクセス解析・開示等の請求・改定の順の節
 */
export const buildPrivacyPolicy = (t: Translator["t"]): PolicySection[] => {
    const contact = {
        email: operator.email,
        handle: operator.blueskyHandle,
    }
    const text = (s: string): PolicyBlock => ({ kind: "text", text: s })
    const list = (...items: string[]): PolicyBlock => ({ kind: "list", items })
    return [
        {
            id: "operator",
            title: t("privacy.operator.title"),
            blocks: [
                text(t("privacy.lead", { operator: operator.name })),
                list(
                    t("privacy.operator.name", { operator: operator.name }),
                    t("privacy.operator.contact", contact),
                ),
            ],
        },
        {
            id: "collected",
            title: t("privacy.collected.title"),
            blocks: [
                text(t("privacy.collected.intro")),
                list(
                    t("privacy.collected.login"),
                    t("privacy.collected.schedule"),
                    t("privacy.collected.device"),
                    t("privacy.collected.log"),
                    t("privacy.collected.analytics"),
                    t("privacy.collected.inquiry"),
                ),
                text(t("privacy.collected.note")),
            ],
        },
        {
            id: "purpose",
            title: t("privacy.purpose.title"),
            blocks: [
                text(t("privacy.purpose.intro")),
                list(
                    t("privacy.purpose.item1"),
                    t("privacy.purpose.item2"),
                    t("privacy.purpose.item3"),
                    t("privacy.purpose.item4"),
                    t("privacy.purpose.item5"),
                ),
                text(t("privacy.purpose.change")),
            ],
        },
        {
            id: "external",
            title: t("privacy.external.title"),
            blocks: [
                text(t("privacy.external.intro")),
                list(
                    t("privacy.external.item1"),
                    t("privacy.external.item2"),
                    t("privacy.external.item3"),
                ),
                text(t("privacy.external.note")),
            ],
        },
        {
            id: "retention",
            title: t("privacy.retention.title"),
            blocks: [
                list(
                    t("privacy.retention.item1"),
                    t("privacy.retention.item2"),
                    t("privacy.retention.item3"),
                    t("privacy.retention.item4"),
                    t("privacy.retention.item5"),
                    t("privacy.retention.item6"),
                ),
            ],
        },
        {
            id: "security",
            title: t("privacy.security.title"),
            blocks: [
                text(t("privacy.security.intro")),
                list(
                    t("privacy.security.item1"),
                    t("privacy.security.item2"),
                    t("privacy.security.item3"),
                    t("privacy.security.item4"),
                    t("privacy.security.item5"),
                ),
                text(t("privacy.security.note")),
            ],
        },
        {
            id: "cookies",
            title: t("privacy.cookies.title"),
            blocks: [
                list(
                    t("privacy.cookies.item1"),
                    t("privacy.cookies.item2"),
                    t("privacy.cookies.item3"),
                    t("privacy.cookies.item4"),
                    t("privacy.cookies.item5"),
                ),
            ],
        },
        {
            id: "rights",
            title: t("privacy.rights.title"),
            blocks: [
                text(t("privacy.rights.intro")),
                list(
                    t("privacy.rights.item1"),
                    t("privacy.rights.item2"),
                    t("privacy.rights.item3"),
                ),
                list(
                    t("privacy.rights.procedure1"),
                    t("privacy.rights.procedure2"),
                    t("privacy.rights.procedure3"),
                    t("privacy.rights.procedure4"),
                ),
                list(t("privacy.rights.self1"), t("privacy.rights.self2")),
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

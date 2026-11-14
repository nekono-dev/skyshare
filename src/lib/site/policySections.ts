/**
 * プライバシーポリシーの節を翻訳辞書とサイト設定から組み立てる。
 *
 * - 節の識別子と順序は固定し、本文は辞書から取得する。扱う情報の事実を変えるときは辞書も更新する。
 * - アナリティクス未使用時は関連記載を除き、Bluesky ハンドル未設定時は連絡先からその項目を除く。
 */
import type { Translator } from "@/lib/i18n/translate"
import { siteConfig, type SiteConfig } from "@/lib/site/siteConfig"

/** 箇条書きの1項目。文か、項目名つきの値（`href` があればリンク） */
export type PolicyItem =
    string | { label: string; value: string; href?: string }

export type PolicyBlock =
    { kind: "text"; text: string } | { kind: "list"; items: PolicyItem[] }

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
 * - `config`: 運用者ごとの設定（省略時は実行中のビルドの値）
 *
 * Output:
 * - 運営者と連絡先・収集する情報・利用目的・情報の共有・保持期間・セキュリティ・Cookie・ユーザーの権利・変更の順の節
 */
export const buildPrivacyPolicy = (
    t: Translator["t"],
    config: SiteConfig = siteConfig,
): PolicySection[] => {
    const { operator, privacy, analyticsId } = config
    const analytics = analyticsId !== null
    // 条件に合う項目だけを残す（アクセス解析を使わない設定の記載を除く）
    const only = <T>(cond: boolean, item: T) => (cond ? [item] : [])
    const text = (s: string): PolicyBlock => ({ kind: "text", text: s })
    const list = (...items: PolicyItem[]): PolicyBlock => ({
        kind: "list",
        items,
    })
    const handle = operator.blueskyHandle
    return [
        {
            id: "operator",
            title: t("privacy.operator.title"),
            blocks: [
                text(t("privacy.lead")),
                list(
                    { label: t("privacy.operator.name"), value: operator.name },
                    {
                        label: t("privacy.operator.email"),
                        value: operator.email,
                        href: `mailto:${operator.email}`,
                    },
                    ...only(handle !== null, {
                        label: t("privacy.operator.bluesky"),
                        value: `@${handle}`,
                        href: `https://bsky.app/profile/${handle}`,
                    }),
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
                    t("privacy.collected.traffic"),
                    ...only(analytics, t("privacy.collected.analytics")),
                    t("privacy.collected.inquiry"),
                    t("privacy.collected.feedback"),
                    t("privacy.collected.survey"),
                ),
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
                    ...only(analytics, t("privacy.external.item3")),
                    t("privacy.external.github"),
                    t("privacy.external.item4"),
                    t("privacy.external.surveyResults"),
                ),
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
                    ...only(analytics, t("privacy.retention.item5")),
                    t("privacy.retention.feedback"),
                    t("privacy.retention.surveyAnswer"),
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
                ),
            ],
        },
        {
            id: "cookies",
            title: analytics
                ? t("privacy.cookies.title")
                : t("privacy.cookies.titleBasic"),
            blocks: [
                list(
                    t("privacy.cookies.item1"),
                    ...(analytics
                        ? [
                              t("privacy.cookies.item2"),
                              t("privacy.cookies.item3"),
                              t("privacy.cookies.item4"),
                          ]
                        : []),
                ),
            ],
        },
        {
            id: "rights",
            title: t("privacy.rights.title"),
            blocks: [
                text(t("privacy.rights.intro")),
                text(t("privacy.rights.self")),
                text(t("privacy.rights.survey")),
            ],
        },
        {
            id: "revision",
            title: t("privacy.revision.title"),
            blocks: [
                text(t("privacy.revision.body")),
                text(
                    t("privacy.revision.dates", {
                        enactedAt: privacy.enactedAt,
                        revisedAt: privacy.revisedAt,
                    }),
                ),
            ],
        },
    ]
}

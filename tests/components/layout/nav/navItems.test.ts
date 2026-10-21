import { describe, expect, it } from "vitest"

import {
    footerNavItems,
    isActiveHref,
    normalizePathname,
    sidebarNavItems,
} from "@/components/layout/nav/navItems"

describe("navItems", () => {
    it("[app-navigation/AC-5] サイドバーとフッターで、項目の並びが異なる", () => {
        expect(sidebarNavItems.map(item => item.key)).toEqual([
            "accounts",
            "post",
            "entries",
            "settings",
        ])
        expect(footerNavItems.map(item => item.key)).toEqual([
            "entries",
            "post",
            "settings",
            "accounts",
        ])
    })
})

describe("normalizePathname / isActiveHref", () => {
    it("[app-navigation/AC-6] ルート以外の末尾のスラッシュを取り除いて比べる", () => {
        expect(normalizePathname("/entries/")).toBe("/entries")
        expect(normalizePathname("/")).toBe("/")
        expect(isActiveHref("/entries/", "/entries")).toBe(true)
    })

    it("[app-navigation/AC-7] 配下のパスでも現在地として判定し、ルートは完全一致だけを現在地とする", () => {
        expect(isActiveHref("/entries/", "/entries/abc")).toBe(true)
        expect(isActiveHref("/", "/")).toBe(true)
        expect(isActiveHref("/", "/entries")).toBe(false)
        expect(isActiveHref("/settings/", "/entries")).toBe(false)
    })
})

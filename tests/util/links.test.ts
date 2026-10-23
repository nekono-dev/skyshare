import { describe, expect, test } from "vitest"
import { navigatingLinkTarget, type ClickLike } from "@/util/links"

const CURRENT = { href: "https://example.com/post/?a=1" }

/** `closest` と `getAttribute` だけを持つ、`<a>` の代わりの値 */
const anchor = (attrs: Record<string, string>) => {
    const element = {
        closest: () => element,
        getAttribute: (name: string) => attrs[name] ?? null,
        hasAttribute: (name: string) => name in attrs,
    }
    return element as unknown as EventTarget
}

const click = (
    attrs: Record<string, string> | null,
    over: Partial<ClickLike> = {},
): ClickLike => ({
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: attrs
        ? anchor(attrs)
        : ({ closest: () => null } as unknown as EventTarget),
    ...over,
})

describe("navigatingLinkTarget", () => {
    test("同じオリジンの別のページのリンクは、移る先を返す", () => {
        expect(
            navigatingLinkTarget(click({ href: "/settings/" }), CURRENT)?.href,
        ).toBe("https://example.com/settings/")
    })

    test("別のオリジンのリンクも、移る先を返す", () => {
        expect(
            navigatingLinkTarget(click({ href: "https://bsky.app/x" }), CURRENT)
                ?.href,
        ).toBe("https://bsky.app/x")
    })

    test("クエリだけが違うリンクは移る操作になり、ハッシュだけの違いと同じページは移る操作にならない", () => {
        expect(
            navigatingLinkTarget(click({ href: "/post/?a=2" }), CURRENT),
        ).not.toBeNull()
        expect(
            navigatingLinkTarget(click({ href: "/post/?a=1#top" }), CURRENT),
        ).toBeNull()
        expect(
            navigatingLinkTarget(click({ href: "#top" }), CURRENT),
        ).toBeNull()
    })

    test("新しいタブ・ダウンロード・修飾キー・主ボタン以外・取り消し済み・リンクでない要素・mailto は移る操作にならない", () => {
        expect(
            navigatingLinkTarget(
                click({ href: "/x/", target: "_blank" }),
                CURRENT,
            ),
        ).toBeNull()
        expect(
            navigatingLinkTarget(click({ href: "/x/", download: "" }), CURRENT),
        ).toBeNull()
        expect(
            navigatingLinkTarget(
                click({ href: "/x/" }, { ctrlKey: true }),
                CURRENT,
            ),
        ).toBeNull()
        expect(
            navigatingLinkTarget(
                click({ href: "/x/" }, { button: 1 }),
                CURRENT,
            ),
        ).toBeNull()
        expect(
            navigatingLinkTarget(
                click({ href: "/x/" }, { defaultPrevented: true }),
                CURRENT,
            ),
        ).toBeNull()
        expect(navigatingLinkTarget(click(null), CURRENT)).toBeNull()
        expect(
            navigatingLinkTarget(
                click({ href: "mailto:a@example.com" }),
                CURRENT,
            ),
        ).toBeNull()
    })

    test("target が _self のリンクは移る操作になる", () => {
        expect(
            navigatingLinkTarget(
                click({ href: "/x/", target: "_self" }),
                CURRENT,
            ),
        ).not.toBeNull()
    })
})

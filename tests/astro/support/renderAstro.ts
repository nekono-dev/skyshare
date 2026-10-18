/**
 * `.astro` コンポーネントをサーバー描画してHTMLを返すテスト用の補助。
 *
 * 責務と処理概要:
 * - Astro の Container API に React のレンダラを登録し、`client:load` のアイランドも
 *   サーバー描画の出力に含めて返す。
 * - 表示言語は `Astro.locals.locale` として渡す（既定は日本語）。
 */
import reactRenderer from "@astrojs/react/server.js"
import { experimental_AstroContainer as AstroContainer } from "astro/container"

type AstroComponent = Parameters<AstroContainer["renderToString"]>[0]

/**
 * コンポーネントを描画してHTML文字列を返す。
 *
 * Input:
 * - `component`: 描画する `.astro` コンポーネント
 * - `props`: コンポーネントのprops
 * - `locale`: 表示言語（省略時は`ja`）
 *
 * Output: 描画されたHTML
 */
export const renderAstro = async (
    component: AstroComponent,
    props: Record<string, unknown> = {},
    locale: "ja" | "en" = "ja",
): Promise<string> => {
    const container = await AstroContainer.create()
    container.addServerRenderer({
        name: "@astrojs/react",
        renderer: reactRenderer,
    })
    return container.renderToString(component, {
        props,
        locals: { locale } as never,
    })
}

/** HTMLのタグを取り除いた本文のテキストを返す（属性値は含めない）。 */
export const textOf = (html: string): string =>
    html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()

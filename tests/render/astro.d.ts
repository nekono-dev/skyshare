/**
 * `.astro` コンポーネントを描画テストから import するための型宣言。
 * Container API の `renderToString` が受け取るコンポーネント型に揃える。
 */
declare module "*.astro" {
    import type { experimental_AstroContainer as AstroContainer } from "astro/container"

    const component: Parameters<AstroContainer["renderToString"]>[0]
    export default component
}

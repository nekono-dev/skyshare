/**
 * 公開結果の有無から、結果ページの静的経路を組み立てる。
 */

export const createSurveyResultStaticPaths = <T>(surveys: T[]) =>
    surveys.length === 0
        ? []
        : [{ params: { slug: undefined }, props: { surveys } }]

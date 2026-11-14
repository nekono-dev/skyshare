/**
 * ビルド時に公開済み結果を一度だけ取り込む。
 *
 * - 読み取り旗が無効なら Worker バインディングを取得しない。
 */

import type { SurveyResultsBucket } from "@/lib/platform/cfTypes"
import { loadPublishedSurveys } from "@/lib/survey/publicResults/loadPublished"
import { SurveyResultsLoadError } from "@/lib/survey/publicResults/loadPublished"
import type { ResultsReader } from "@/lib/survey/publicResults/loadPublished"
import type { SurveyResult } from "@/lib/survey/results/schema"

type BindingGetter = () => Promise<SurveyResultsBucket | undefined>
type SurveyLoader = (reader: ResultsReader) => Promise<SurveyResult[]>

const getBuildBinding: BindingGetter = async () => {
    const { env } = await import("cloudflare:workers")
    return (env as { SURVEY_RESULTS?: SurveyResultsBucket }).SURVEY_RESULTS
}

const asResultsReader = (bucket: SurveyResultsBucket): ResultsReader => ({
    get: async key => {
        const object = await bucket.get(key)
        if (!object) return null
        const sizedObject = object as typeof object & { size: number }
        return { size: sizedObject.size, text: () => object.text() }
    },
})

/** 旗・バインディング取得・読み込みを受け取り、取得関数と記憶の消去関数を作る。 */
const createGetter = (
    flag: string | undefined,
    bindingGetter: BindingGetter,
    loader: SurveyLoader,
): { get: () => Promise<SurveyResult[]>; reset: () => void } => {
    let memo: Promise<SurveyResult[]> | undefined
    const get = (): Promise<SurveyResult[]> => {
        if (memo) return memo
        if (flag !== "true") {
            memo = Promise.resolve([])
            return memo
        }
        memo = Promise.resolve().then(async () => {
            const bucket = await bindingGetter()
            if (!bucket) throw new SurveyResultsLoadError("read")
            return loader(asResultsReader(bucket))
        })
        return memo
    }
    return { get, reset: () => (memo = undefined) }
}

/**
 * テスト用の取得入口を作る。
 *
 * Input: ビルド旗・バインディング取得関数・結果の読み込み関数
 * Output: 取得関数と、その取得結果を消去する関数
 * 例: 旗が無効なら依存関数を呼ばず空配列を返す取得関数を作る
 */
export const createPublishedSurveysGetter = (
    flag: string | undefined,
    bindingGetter: BindingGetter,
    loader: SurveyLoader = loadPublishedSurveys,
): { get: () => Promise<SurveyResult[]>; reset: () => void } =>
    createGetter(flag, bindingGetter, loader)

const defaultGetter = createGetter(
    import.meta.env.PUBLIC_SURVEY_RESULTS_READABLE,
    getBuildBinding,
    loadPublishedSurveys,
)

/**
 * ビルドの間に、公開済みのアンケート結果を 1 回だけ取り込んで返す。
 *
 * Input: なし（ビルド定数 `PUBLIC_SURVEY_RESULTS_READABLE` で有効・無効が決まる）
 * Output: 実施時期の新しい順の公開済み結果。旗が "true" 以外なら、バインディングに触れず空配列
 * 例: 旗が有効でバインディングが無いときは、種類 `read` の `SurveyResultsLoadError` で失敗する
 *
 * 最初の呼び出しの結果（失敗も含む）を記憶し、以後は再取得せず同じ結果（同じ失敗）を返す。
 */
export const getPublishedSurveys: () => Promise<SurveyResult[]> =
    defaultGetter.get

/** テストでビルド間の記憶を消去する。 */
export const resetPublishedSurveysMemo = defaultGetter.reset

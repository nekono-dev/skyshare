/**
 * cfTypes の結果保管先と D1 batch の型を、型検査（tsc）で確かめる。
 */
import { it } from "vitest"
import type {
    D1Database,
    D1Result,
    SurveyResultsBucket,
} from "@/lib/platform/cfTypes"

type SurveyRow = { survey_id: string }

declare const bucket: SurveyResultsBucket
declare const database: D1Database

const batchResult: D1Result<SurveyRow> = {
    results: [{ survey_id: "survey-1" }],
}
const rows: SurveyRow[] | undefined = batchResult.results
void rows

async function readBatchResults(): Promise<SurveyRow[]> {
    const result = await database.batch<SurveyRow>([])
    return result[0].results ?? []
}

if (false) {
    void bucket.get("index.json")
    void bucket.put("index.json", "{}", {
        onlyIf: { etagDoesNotMatch: "*" },
    })

    // @ts-expect-error 結果保管先に存在確認だけの操作は設けない
    void bucket.head("index.json")
    void readBatchResults
}

it("保管先と D1 batch の型を検査する", () => {})

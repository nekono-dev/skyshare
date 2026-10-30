/**
 * アンケートの 3 つの操作が共有するパスの契約。
 *
 * 責務と処理概要:
 * - パスの変数 `surveyId` を、アンケート設定と同じ識別子の形式（`src/lib/survey/definition.ts`）で検証する。
 * - 入力に回答者の識別子や時刻を持たせない（回答者はログインの状態からだけ得る）。
 */
import { z } from "zod/v4"
import { idSchema } from "../../../../../survey/definition"

export const PathParamsSchema = z.object({ surveyId: idSchema }).strict()
export type PathParamsType = z.infer<typeof PathParamsSchema>

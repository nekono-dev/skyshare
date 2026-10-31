/**
 * アンケートの 3 つの操作が共有するパスの契約（survey 側が持つ）。
 *
 * 責務と処理概要:
 * - パスの変数 `surveyId` を、アンケート設定と同じ識別子の形式（`survey/definition.ts`）で検証する。
 * - 入力に回答者の識別子や時刻を持たせない（回答者はログインの状態からだけ得る）。
 * - API（`api/schema/v2/surveys/[surveyId]/path.ts`）と回答の処理（`survey/request.ts`）の両方が使う。
 *   survey は api を import しないため、契約は survey 側に置く。
 */
import { z } from "zod/v4"
import { idSchema } from "./definition"

export const PathParamsSchema = z.object({ surveyId: idSchema }).strict()
export type PathParamsType = z.infer<typeof PathParamsSchema>

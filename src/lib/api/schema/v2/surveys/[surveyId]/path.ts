/**
 * アンケートの 3 つの操作が共有するパスの契約（API の入口）。
 *
 * 責務と処理概要:
 * - 契約の定義は `survey/pathParams.ts` が持つ。ここはその再エクスポートだけを行う。
 * - 入力に回答者の識別子や時刻を持たせない（回答者はログインの状態からだけ得る）。
 */
import { PathParamsSchema, type PathParamsType } from "@/lib/survey/pathParams"

export { PathParamsSchema, type PathParamsType }

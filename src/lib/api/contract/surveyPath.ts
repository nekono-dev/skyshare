/**
 * アンケートの識別子とパスの契約（基盤の API 契約）。
 *
 * 責務と処理概要:
 * - 識別子（アンケート・質問・選択肢）の形式（最大文字数・英小文字・数字・ハイフン）を `idSchema` として定める。
 * - パスの変数 `surveyId` を `idSchema` で検証する `PathParamsSchema` を定める。
 * - 入力に回答者の識別子や時刻を持たせない（回答者はログインの状態からだけ得る）。
 * - 業務（`lib/survey`）の設定の読み込み・回答の処理と、API（`api/schema/v2/surveys/`）のスキーマが同じ規則を使うために置く。
 *
 * 実装上の制約:
 * - 業務（`lib/survey`）を import しない（基盤の契約は業務から参照される側に置く）。
 */
import { z } from "zod"

/** 識別子の最大文字数 */
const ID_MAX_LENGTH = 40

/** 識別子: 英小文字・数字・ハイフン（先頭・末尾・連続のハイフンは不可） */
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** 識別子（アンケート・質問・選択肢）の検証。設定の読み込みと API の契約が同じ形式で検証するため公開する */
export const idSchema = z.string().max(ID_MAX_LENGTH).regex(ID_PATTERN)

/** パスの変数 `surveyId` の検証。API（3 つの操作）と回答の処理が共有する */
export const PathParamsSchema = z.object({ surveyId: idSchema }).strict()
export type PathParamsType = z.infer<typeof PathParamsSchema>

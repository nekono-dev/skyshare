/**
 * アンケート識別子と API パスの入力形式を定義する。
 *
 * - 回答者の識別子と時刻はログイン状態から得るため、パス入力に含めない。
 * - 業務領域から参照される基盤の契約として、業務領域に依存しない。
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

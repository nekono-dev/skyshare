/**
 * 翻訳関数の型検査用サンプル（`tsc --noEmit` でのみ検証する。vitest の対象外）。
 * `@ts-expect-error` の行が「エラーにならなくなった」場合、tsc が失敗して検出できる。
 */
import { createTranslator } from "@/lib/i18n/translate"

const { t, tn } = createTranslator("ja")

t("common.cancel")
tn("common.itemCount", 3)

// @ts-expect-error 存在しないキー
t("common.noSuchKey")
// @ts-expect-error 存在しない複数形の基底名
tn("common.noSuchPlural", 1)

t("common.itemCount_other", { count: 1 })
// @ts-expect-error パラメータの不足
t("common.itemCount_other")
// @ts-expect-error プレースホルダの無い文言にパラメータは渡せない
t("common.cancel", { count: 1 })

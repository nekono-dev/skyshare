/**
 * アンケートごとの回答済み記録を端末に、辞退の固定印をタブに保存する。
 * Storageが利用できない場合は記録なしとして続行し、回答内容や時刻は保存しない。
 */
import { z } from "zod"

export type SurveyDeviceRecord = {
    answered: boolean
    dids: string[]
}

const deviceRecordSchema = z.object({
    answered: z.boolean(),
    dids: z.array(z.string()),
})
const declinedMarker = "1"

/**
 * 呼び出し時のブラウザStorageを取得する。SSRや取得時の例外は利用不可とする。
 * Input: kindはlocalStorageまたはsessionStorage。
 * Output: Storageまたはundefined。例: SSRでlocalStorageを指定するとundefined。
 */
const browserStorage = (
    kind: "localStorage" | "sessionStorage",
): Storage | undefined => {
    try {
        return typeof window === "undefined" ? undefined : window[kind]
    } catch {
        return undefined
    }
}

/**
 * アンケートの回答済み記録を読む。JSONはansweredが真偽、didsが文字列配列であることを検証する。
 * Input: surveyIdは設定済みの識別子、storageは省略時localStorage。
 * Output: 回答済み記録。未保存・破損・使用不可ならfalseと空配列。
 * 例: 未保存のsurveyIdを読むと{ answered: false, dids: [] }。
 */
export const readDeviceRecord = (
    surveyId: string,
    storage?: Storage,
): SurveyDeviceRecord => {
    try {
        const raw = (storage ?? browserStorage("localStorage"))?.getItem(
            `skyshare.survey.${surveyId}`,
        )
        if (raw == null) return { answered: false, dids: [] }
        const result = deviceRecordSchema.safeParse(JSON.parse(raw))
        if (result.success) return result.data
    } catch {
        // 壊れたJSONとStorageの例外は、未保存と同じ扱いにする。
    }
    return { answered: false, dids: [] }
}

/**
 * 回答済みの旗を立て、既存の識別子を保ちながら重複なく追加する。失敗しても投げない。
 * Input: surveyIdは設定済みの識別子、didは回答済みアカウント、storageは省略時localStorage。
 * Output: なし。保存先が使える場合だけ更新する。
 * 例: 同じdidを2回追加してもdidsには1件だけ保存する。
 */
export const rememberAnswered = (
    surveyId: string,
    did: string,
    storage?: Storage,
): void => {
    try {
        const target = storage ?? browserStorage("localStorage")
        if (!target) return
        const record = readDeviceRecord(surveyId, target)
        target.setItem(
            `skyshare.survey.${surveyId}`,
            JSON.stringify({
                answered: true,
                dids: [...new Set([...record.dids, did])],
            }),
        )
    } catch {
        // 容量不足などで保存できなくても利用者の操作を妨げない。
    }
}

/**
 * このタブで辞退済みか固定印を確認する。Storageが使えなければ未辞退とする。
 * Input: surveyIdは設定済みの識別子、storageは省略時sessionStorage。
 * Output: 固定印がある場合だけtrue。例: 未保存ならfalse。
 */
export const isDeclinedInTab = (
    surveyId: string,
    storage?: Storage,
): boolean => {
    try {
        return (
            (storage ?? browserStorage("sessionStorage"))?.getItem(
                `skyshare.survey.${surveyId}.declined`,
            ) === declinedMarker
        )
    } catch {
        return false
    }
}

/**
 * このタブでの辞退を固定印だけで記録する。失敗しても投げない。
 * Input: surveyIdは設定済みの識別子、storageは省略時sessionStorage。
 * Output: なし。例: 記録成功後のisDeclinedInTab(surveyId)はtrue。
 */
export const markDeclinedInTab = (
    surveyId: string,
    storage?: Storage,
): void => {
    try {
        ;(storage ?? browserStorage("sessionStorage"))?.setItem(
            `skyshare.survey.${surveyId}.declined`,
            declinedMarker,
        )
    } catch {
        // 辞退の保存に失敗してもダイアログを閉じる操作を妨げない。
    }
}

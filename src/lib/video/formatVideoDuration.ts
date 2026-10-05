/**
 * 秒数を `m:ss`（1時間以上は `h:mm:ss`）へ整形する。四捨五入し、最小は `0:01`。
 * 分・時は桁揃えなし、秒（1時間以上は分も）は2桁。
 *
 * 動画 entry の heading（X のリンクカード上で動画の再生時間に見せる）に使う。
 *
 * 例:
 * - 入力: `5` → 出力: `"0:05"`
 * - 入力: `600` → 出力: `"10:00"`
 * - 入力: `3600` → 出力: `"1:00:00"`
 */
export const formatVideoDuration = (sec: number): string => {
    const total = Math.max(1, Math.round(sec))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = String(total % 60).padStart(2, "0")
    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
        : `${minutes}:${seconds}`
}

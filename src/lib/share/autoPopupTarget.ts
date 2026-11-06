/**
 * 「自動ポップアップするSNS」の値と型。
 *
 * 責務と処理概要:
 * - 選べる値の一覧（`AUTO_POPUP_TARGETS`）と、その型（`AutoPopupTarget`）を持つ。
 * - 設定の読み書き（`lib/settings/shareSettings.ts`）が参照する。
 *   `lib/share` から `lib/settings` を参照すると循環するため、値と型はこの `lib/share` 側に置く。
 */

/** 投稿後に自動でポップアップするSNS（"ask" は投稿先選択ダイアログを開く）。 */
export const AUTO_POPUP_TARGETS = [
    "ask",
    "x",
    "taittsuu",
    "mastodon",
    "misskey",
] as const
export type AutoPopupTarget = (typeof AUTO_POPUP_TARGETS)[number]

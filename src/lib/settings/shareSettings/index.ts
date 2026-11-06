/**
 * 投稿共有設定の永続化ユーティリティの公開入口。
 *
 * 責務と処理概要:
 * - 種類ごとの実装（自動ポップアップ・インスタンスドメイン・チェックの設定・行数）を再エクスポートする。
 * - 分割前の `lib/settings/shareSettings` と同じ export 名を提供し、import 元の変更を不要にする。
 */

// 自動ポップアップの設定
export {
    DEFAULT_AUTO_POPUP_TARGET,
    isAutoPopupTarget,
    readAutoPopupTargetSetting,
    writeAutoPopupTargetSetting,
} from "./autoPopup"

// インスタンスドメインの設定
export {
    DEFAULT_MASTODON_INSTANCE_DOMAIN,
    DEFAULT_MISSKEY_INSTANCE_DOMAIN,
    readMastodonInstanceDomainSetting,
    readMisskeyInstanceDomainSetting,
    removeMastodonInstanceDomainSetting,
    removeMisskeyInstanceDomainSetting,
    resolveInstanceDomainFor,
    resolveMastodonInstanceDomain,
    resolveMisskeyInstanceDomain,
    writeMastodonInstanceDomainSetting,
    writeMisskeyInstanceDomainSetting,
} from "./instanceDomain"

// チェックの設定（トグル）
export {
    DEFAULT_LINK_CARD_PRIORITY,
    readEffectiveLinkCardPriority,
    readLinkCardPrioritySetting,
    readManualImageAttachSetting,
    readPinnedFormDisabledSetting,
    readPopupIntentInsteadOfWebshareSetting,
    readTruncateIntentTextSetting,
    writeLinkCardPrioritySetting,
    writeManualImageAttachSetting,
    writePinnedFormDisabledSetting,
    writePopupIntentInsteadOfWebshareSetting,
    writeTruncateIntentTextSetting,
} from "./toggles"

// テキストエリアの行数の設定
export {
    readTextareaRowsSetting,
    writeTextareaRowsSetting,
} from "./textareaRows"

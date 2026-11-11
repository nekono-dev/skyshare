/**
 * 投稿共有設定の公開入口。
 *
 * - 既存の import 元が使う export 名を維持する。
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

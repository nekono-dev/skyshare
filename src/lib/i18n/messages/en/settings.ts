/** 設定画面の文言（英語）。キー集合・スロット名は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const settings = {
    "settings.helpLink": "Need help? Click here.",
    "settings.display.title": "Display",
    "settings.theme.label": "Theme",
    "settings.theme.system": "Follow system settings",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.locale.label": "Language",
    "settings.locale.system": "Follow system settings",
    "settings.postForm.title": "Post form",
    "settings.pinnedFormDisabled.label": "Don't pin the post form",
    "settings.pinnedFormDisabled.description":
        "When on, the post form is no longer pinned to the top of the screen. Open it with the sidebar or the floating new post button.",
    "settings.popupIntent.label": "Open a popup instead of {share}",
    "settings.popupIntent.description":
        "When on, sharing after posting opens a post intent popup {popup} instead of the Web Share API (the share menu shown by {share}).",
    "settings.manualImageAttach.label": "Attach images manually",
    "settings.manualImageAttach.description":
        "When on, no Skyshare URL is issued. When using {share}, image data is shared with the target app. When using a post intent (popup {popup}), set the images in the target SNS's post form.",
    "settings.truncateIntentText.label": "Truncate long text when sharing",
    "settings.truncateIntentText.description":
        'When on, when sharing to X or Taittsuu, the text is shortened with "..." so that it fits within the 140-character limit. Not available while Attach images manually is on.',
    "settings.hashtagSuggest.label": "Show hashtag suggestions",
    "settings.hashtagSuggest.description":
        'When on, a list of hashtag suggestions appears when you type "#" in the post text.',
    "settings.mentionSuggest.label": "Show mention suggestions",
    "settings.mentionSuggest.description":
        'When on, a list of mention suggestions appears when you type "@" in the post text.',
    "settings.gate.title": "Default reply and quote settings",
    "settings.gate.description":
        "Default settings for who can reply and whether quoting is allowed, used as the initial values for new posts.",
    "settings.gate.editButton": "Edit default reply and quote settings",
    "settings.syncGate.label": "Remember reply and quote options",
    "settings.syncGate.description":
        "When on, the reply and quote settings you choose when posting become the defaults from next time. When off, they return to the saved defaults after posting.",
    "settings.autoPopupTarget.description":
        'Choose which social network\'s post screen opens automatically after posting. With "Choose when posting", a dialog to pick the destination is shown after posting.',
    "settings.mastodon.instance.label": "Mastodon{mastodon} instance",
    "settings.mastodon.instance.description":
        "The instance domain used when sharing to Mastodon. If not set, mastodon.social is used.",
    "settings.mastodon.domainError":
        "The domain format is invalid. Enter only the domain name, without a scheme (such as https://) or a path (anything after /).",
} satisfies MessageEntries

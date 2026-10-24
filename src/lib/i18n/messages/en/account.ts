/** アカウント画面（ログイン・切り替え）の文言（英語）。キー集合・スロット名は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const account = {
    "account.login.handleLabel": "Handle (the part after @)",
    "account.login.appPasswordLabel": "App password ({link})",
    "account.login.appPasswordLink": "create one here",
    "account.login.submit": "Log in",
    "account.login.progress": "Logging in…",
    "account.login.success": "Logged in. Redirecting…",
    "account.login.tabsAria": "Login method",
    "account.login.tabOAuth": "Log in with Bluesky",
    "account.login.tabPassword": "App password",
    "account.login.oauthHint":
        "You will be taken to Bluesky to enter your handle and password and approve access. Works with accounts hosted by Bluesky (such as bsky.social).",
    "account.login.oauthSubmit": "Log in with Bluesky",
    "account.login.oauthRedirecting": "Taking you to Bluesky…",
    "account.oauthResult.title": "Log in with Bluesky",
    "account.oauthResult.close": "Close",
    "account.oauthResult.ok": "Logged in. Redirecting…",
    "account.oauthResult.Denied": "Access was not approved on Bluesky.",
    "account.oauthResult.retry":
        "The login attempt is no longer valid. Please try again.",
    "account.oauthResult.AccountUnverified":
        "This account can't log in with Bluesky. Please log in with an app password.",
    "account.oauthResult.failed":
        "Failed to log in. Please try again later.",
    "account.panel.reauthTitle": "Log in again as @{handle}",
    "account.panel.addTitle": "Add another account",
    "account.panel.reauthHint":
        "Your session has expired. Please log in again.",
    "account.switcher.active": "Active",
    "account.switcher.needsReauth": "Re-login required",
    "account.switcher.logout": "Log out",
    "account.switcher.empty": "No accounts are logged in.",
    "account.switcher.loadFailed": "Failed to load the account list.",
    "account.switcher.switchFailed": "Failed to switch accounts.",
    "account.switcher.logoutFailed": "Failed to log out.",
} satisfies MessageEntries

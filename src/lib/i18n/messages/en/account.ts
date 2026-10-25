/** アカウント画面（ログイン・切り替え）の文言（英語）。キー集合・スロット名は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const account = {
    "account.login.handleLabel": "Handle (the part after @)",
    "account.login.appPasswordLabel": "App password ({link})",
    "account.login.appPasswordLink": "create one here",
    "account.login.submit": "Log in",
    "account.login.progress": "Logging in…",
    "account.login.success": "Logged in. Redirecting…",
    "account.panel.reauthTitle": "Log in again as @{handle}",
    "account.panel.addTitle": "Add another account",
    "account.panel.reauthHint":
        "Your session has expired. Please enter your password again.",
    "account.switcher.active": "Active",
    "account.switcher.needsReauth": "Re-login required",
    "account.switcher.logout": "Log out",
    "account.switcher.empty": "No accounts are logged in.",
    "account.switcher.loadFailed": "Failed to load the account list.",
    "account.switcher.switchFailed": "Failed to switch accounts.",
    "account.switcher.logoutFailed": "Failed to log out.",
} satisfies MessageEntries

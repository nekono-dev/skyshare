/** エラー表示の文言（英語）。キー集合は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const error = {
    "error.generic": "Something went wrong.",
    "error.badRequest": "The request is not valid.",
    "error.unauthorized": "Authentication required.",
    "error.forbidden": "This action is not allowed.",
    "error.notFound": "The requested item was not found.",
    "error.conflict": "This can't be done in the current state.",
    "error.rateLimited": "Too many requests. Please try again later.",
    "error.network": "Could not connect to the server.",
    "error.loginFailed": "Login failed.",
    "error.accountLimitReached":
        "You have reached the maximum number of linked accounts. Please log out of another account first.",
} satisfies MessageEntries

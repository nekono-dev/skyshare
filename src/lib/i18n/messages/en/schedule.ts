/** 予約投稿の文言（英語）。キー集合は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const schedule = {
    "schedule.button": "Schedule",
    "schedule.listLink": "Scheduled posts",
    "schedule.unavailableVideo": "Posts with a video cannot be scheduled.",
    "schedule.dialog.title": "Schedule post",
    "schedule.dialog.runAt": "Post at",
    "schedule.dialog.submit": "Schedule",
    "schedule.dialog.sending": "Scheduling…",
    "schedule.dialog.done": "Scheduled.",
    "schedule.dialog.goList": "View scheduled posts",
    "schedule.dialog.close": "Close",
    "schedule.dialog.cancel": "Cancel",
    "schedule.dialog.limitsFailed": "Could not load the scheduling limits.",
    "schedule.dialog.reload": "Reload",
    "schedule.range.tooSoon":
        "Choose a time at least {minutes} minutes from now.",
    "schedule.range.tooLate": "Choose a time within {days} days from now.",
    "schedule.credential.title": "Authentication for scheduling",
    "schedule.credential.description":
        "The server posts on your behalf at the chosen time, so you log in once for scheduling. Your password is not stored; only the refresh token obtained by logging in is stored encrypted.",
    "schedule.credential.warning":
        "Do not enter your main password. Enter an app password.",
    "schedule.credential.howto":
        "You can create an app password in Bluesky under Settings → Privacy and security → App passwords.",
    "schedule.credential.username": "Username",
    "schedule.credential.password": "App password",
    "schedule.credential.submit": "Register and schedule",
    "schedule.credential.registered": "Scheduling authentication: registered",
    "schedule.credential.notRegistered":
        "Scheduling authentication: not registered",
    "schedule.credential.delete": "Delete credential",
    "schedule.credential.deleteBlocked":
        "It cannot be deleted while a scheduled post is waiting or running.",
    "schedule.list.title": "Scheduled posts",
    "schedule.list.empty": "No scheduled posts.",
    "schedule.list.postCount": "{count} post(s)",
    "schedule.list.cancel": "Cancel",
    "schedule.list.deleteHistory": "Delete history",
    "schedule.list.viewPost": "View post",
    "schedule.list.more": "Show more",
    "schedule.list.reload": "Reload",
    "schedule.list.loadFailed": "Could not load scheduled posts.",
    "schedule.list.cancelTitle": "Cancel scheduled post",
    "schedule.list.cancelMessage": "Cancel this scheduled post?",
    "schedule.list.cancelConfirm": "Cancel post",
    "schedule.status.pending": "Waiting",
    "schedule.status.running": "Running",
    "schedule.status.posted": "Posted",
    "schedule.status.failed": "Failed",
    "schedule.error.invalid": "The scheduled post is not valid.",
    "schedule.error.passwordRejected":
        "Could not log in. Check the app password.",
    "schedule.error.credentialRequired":
        "Authentication for scheduling is required.",
    "schedule.error.running": "It is running and cannot be changed.",
    "schedule.error.credentialInUse":
        "The credential cannot be deleted while a scheduled post is waiting or running.",
    "schedule.error.tooMany":
        "You have reached the limit of scheduled posts. Cancel some first.",
    "schedule.error.server": "Could not process the scheduled post.",
    "schedule.failure.CredentialMissing":
        "The credential for scheduling was not found.",
    "schedule.failure.CredentialInvalid":
        "The credential for scheduling could not be read.",
    "schedule.failure.CredentialExpired":
        "The authentication for scheduling had expired.",
    "schedule.failure.InvalidRecord": "The post content was rejected.",
    "schedule.failure.ImageMissing": "The attached image was not found.",
    "schedule.failure.RetryExceeded":
        "Temporary failures continued and the post was not made.",
    "schedule.failure.unknown": "The post was not made.",
    "pageTitle.schedules": "Scheduled posts | {service}",
} satisfies MessageEntries

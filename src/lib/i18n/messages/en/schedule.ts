/** 予約投稿の文言（英語）。キー集合は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const schedule = {
    "schedule.submit": "Schedule",
    "schedule.submitAll": "Schedule all",
    "schedule.unavailableVideo": "Posts with a video cannot be scheduled.",
    "schedule.unavailableDisabled":
        "Turn on scheduled posts in Settings to use scheduling.",
    "schedule.unavailableLimits": "Could not load the scheduling limits.",
    "schedule.sending": "Scheduling…",
    "schedule.created": "Scheduled.",
    "schedule.updated": "The scheduled post was updated.",
    "schedule.cancelled": "The scheduled post was cancelled.",
    "schedule.loadingEdit": "Loading the scheduled post…",
    "schedule.applied": "Loaded the scheduled post into the form.",
    "schedule.runAtLabel": "Scheduled for {date}",
    "schedule.picker.button": "Set a schedule",
    "schedule.picker.title": "Schedule",
    "schedule.picker.runAt": "Post at",
    "schedule.picker.set": "Set",
    "schedule.picker.clear": "Clear",
    "schedule.picker.close": "Close",
    "schedule.range.tooSoon":
        "Choose a time at least {minutes} minutes from now.",
    "schedule.range.tooLate": "Choose a time within {days} days from now.",
    "schedule.videoConflict.title": "Posts with a video can't be scheduled",
    "schedule.videoConflict.message":
        "A post with a video can't be scheduled. Remove the video to schedule it.",
    "schedule.videoConflict.remove": "Remove the video and schedule",
    "schedule.videoConflict.cancel": "Cancel",
    "schedule.editCancel.title": "Stop editing the scheduled post",
    "schedule.editCancel.cancelSchedule": "Cancel the scheduled post",
    "schedule.editCancel.keep": "Keep it scheduled and close",
    "schedule.editCancel.continue": "Keep editing",
    "schedule.setting.label": "Scheduled posts",
    "schedule.setting.description":
        "Post at a time you choose. Turning this on registers an app password.",
    "schedule.setting.disableTitle": "Turn off scheduled posts",
    "schedule.setting.disableMessage":
        "{count} pending scheduled posts will also be cancelled. Continue?",
    "schedule.setting.disableMessageNone":
        "The registered app password information will be deleted. Continue?",
    "schedule.setting.disableConfirm": "Turn off",
    "schedule.setting.disabled": "Scheduled posts were turned off.",
    "schedule.setting.disabledWithCancel":
        "Scheduled posts were turned off and {count} scheduled posts were cancelled.",
    "schedule.credential.title": "Turn on scheduled posts",
    "schedule.credential.warning":
        "Enter an app password, not your main password.",
    "schedule.credential.howto":
        "Create an app password in Bluesky under Settings → Privacy and security.",
    "schedule.credential.privacy":
        "See the {link} for how the stored information is handled.",
    "schedule.credential.username": "Username",
    "schedule.credential.password": "App password",
    "schedule.credential.submit": "Register",
    "schedule.credential.cancel": "Cancel",
    "schedule.list.empty": "No scheduled posts.",
    "schedule.list.pendingTitle": "Pending",
    "schedule.list.historyTitle": "History",
    "schedule.list.postCount": "{count} posts",
    "schedule.list.edit": "Edit this scheduled post",
    "schedule.list.deleteHistory": "Delete history",
    "schedule.list.restore": "Restore to form",
    "schedule.list.more": "Show more",
    "schedule.list.reload": "Reload",
    "schedule.list.loadFailed": "Could not load the scheduled posts.",
    "schedule.list.deleteTitle": "Delete history",
    "schedule.list.deleteMessage":
        "This scheduled post will be removed from the history. Continue?",
    "schedule.list.deleteConfirm": "Delete",
    "schedule.status.pending": "Pending",
    "schedule.status.running": "Running",
    "schedule.status.failed": "Failed",
    "schedule.error.invalid": "The scheduled post is not valid.",
    "schedule.error.passwordRejected":
        "Could not log in. Check your app password.",
    "schedule.error.notFound":
        "The scheduled post was not found. It may have already run or been cancelled.",
    "schedule.error.credentialRequired":
        "Scheduled posts are turned off. Turn them on in Settings.",
    "schedule.error.running": "It is running and cannot be changed now.",
    "schedule.error.tooMany":
        "You have reached the limit of scheduled posts. Cancel ones you no longer need first.",
    "schedule.error.server": "Failed to process the scheduled post.",
    "schedule.failure.CredentialMissing":
        "Scheduled posts were turned off, so the post was not made.",
    "schedule.failure.CredentialInvalid":
        "The credential for scheduling could not be read.",
    "schedule.failure.CredentialExpired":
        "The app password no longer worked. Turn scheduled posts on again in Settings.",
    "schedule.failure.InvalidRecord": "The post content was not accepted.",
    "schedule.failure.ImageMissing": "An attached image was not found.",
    "schedule.failure.RetryExceeded":
        "Temporary failures continued and the post was not made.",
    "schedule.failure.unknown": "The post was not made.",
} satisfies MessageEntries

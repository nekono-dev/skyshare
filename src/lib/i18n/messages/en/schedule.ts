/** 予約投稿の文言（英語）。キー集合は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const schedule = {
    "schedule.submit": "Schedule",
    "schedule.submitAll": "Schedule all",
    "schedule.unavailableVideo": "Posts with a video cannot be scheduled.",
    "schedule.unavailableDisabled":
        "Turn on scheduled posts in Settings to use scheduling.",
    "schedule.unavailableReauth":
        "Your permission on Bluesky is no longer valid. Press to grant it again.",
    "schedule.unavailableLimits": "Could not load the scheduling limits.",
    "schedule.sending": "Scheduling…",
    "schedule.created": "Scheduled.",
    "schedule.updated": "The scheduled post was updated.",
    "schedule.cancelled": "The scheduled post was cancelled.",
    "schedule.loadingEdit": "Loading the scheduled post…",
    "schedule.applied": "Loaded the scheduled post into the form.",
    "schedule.runAtLabel": "Scheduled for {date}",
    "schedule.setupGuide.title": "Scheduled posts are not enabled",
    "schedule.setupGuide.message":
        "Turn on the feature in Settings to use scheduled posts.",
    "schedule.setupGuide.open": "Open Settings",
    "schedule.setupGuide.close": "Close",
    "schedule.picker.button": "Set a schedule",
    "schedule.picker.title": "Schedule",
    "schedule.picker.runAt": "Post at",
    "schedule.picker.set": "Set",
    "schedule.picker.clear": "Clear",
    "schedule.picker.close": "Close",
    "schedule.picker.slotsLabel": "Scheduled post slots",
    "schedule.picker.slotsRemaining": "{remaining} left (up to {max})",
    "schedule.picker.slotsFull":
        "You have reached the limit of pending scheduled posts. Cancel one to schedule another.",
    "schedule.picker.expiresAt":
        "Permission valid until about {date} (extended each time you schedule a post)",
    "schedule.range.tooSoon":
        "Choose a time at least {minutes} minutes from now.",
    "schedule.range.tooLate": "Choose a time within {days} days from now.",
    "schedule.editCancel.title": "Stop editing the scheduled post",
    "schedule.editCancel.cancelSchedule": "Cancel the scheduled post",
    "schedule.editCancel.keep": "Keep it scheduled and close",
    "schedule.editCancel.continue": "Keep editing",
    "schedule.setting.label": "Scheduled posts",
    "schedule.setting.description":
        "Post at a time you choose. Turning this on asks you to allow scheduled posting on Bluesky. Only {image} posts can be scheduled.",
    "schedule.setting.mediaImageAlt": "Image",
    "schedule.setting.mediaVideoAlt": "Video",
    "schedule.setting.chronoskyLead":
        "For scheduling {video} posts or more advanced features, use {link}.",
    "schedule.setting.chronoskyName": "Chronosky",
    "schedule.setting.chronoskyAria":
        "Chronosky (a scheduled posting service for Bluesky, opens in a new tab)",
    "schedule.setting.disableTitle": "Turn off scheduled posts",
    "schedule.setting.disableMessage":
        "{pending} pending scheduled posts and {failed} failed ones in the history will also be deleted. Continue?",
    "schedule.setting.disableMessagePending":
        "{count} pending scheduled posts will also be cancelled. Continue?",
    "schedule.setting.disableMessageFailed":
        "{count} failed scheduled posts in the history will also be deleted. Continue?",
    "schedule.setting.disableMessageNone":
        "This revokes the permission for scheduled posts on Bluesky and deletes the stored authorization. Continue?",
    "schedule.setting.disableConfirm": "Turn off",
    "schedule.setting.disabled": "Scheduled posts were turned off.",
    "schedule.setting.reauthRequired":
        "Your permission on Bluesky is no longer valid. Grant it again to schedule posts.",
    "schedule.setting.reauthButton": "Grant again",
    "schedule.setting.disabledWithDelete":
        "Scheduled posts were turned off and {count} scheduled posts were deleted.",
    "schedule.credential.title": "Turn on scheduled posts",
    "schedule.credential.reauthTitle": "Grant permission on Bluesky again",
    "schedule.credential.reauthIntro":
        "Your permission for scheduled posts on Bluesky is no longer valid. Grant it again to schedule posts. You will come back to this page afterwards.",
    "schedule.credential.privacy":
        "Your credentials are stored by Skyshare. See the {link} for how the information is handled.",
    "schedule.credential.intro":
        "Allow Skyshare to post to Bluesky at the times you schedule.",
    "schedule.credential.account":
        "Scheduled posts will be turned on for the {handle} account.",
    "schedule.credential.startFailed":
        "Could not open the Bluesky permission page. Please try again later.",
    "schedule.authResult.ok": "Scheduled posts are now on.",
    "schedule.authResult.title": "Permission for scheduled posts on Bluesky",
    "schedule.authResult.close": "Close",
    "schedule.authResult.Denied":
        "Permission was not granted on Bluesky, so scheduled posts stay off.",
    "schedule.authResult.AccountMismatch":
        "Permission was granted with a different account from the one you are logged in with, so scheduled posts were not turned on.",
    "schedule.authResult.SessionRequired":
        "Your login had expired, so scheduled posts were not turned on. Log in again and try once more.",
    "schedule.authResult.failed":
        "Could not turn on scheduled posts. Please try again later.",
    "schedule.credential.submit": "Authenticate",
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
    "schedule.error.notFound":
        "The scheduled post was not found. It may have already run or been cancelled.",
    "schedule.error.credentialRequired":
        "Scheduled posts are turned off. Turn them on in Settings.",
    "schedule.error.reauthRequired":
        "Your permission on Bluesky is no longer valid. Grant it again.",
    "schedule.error.running": "It is running and cannot be changed now.",
    "schedule.error.tooMany":
        "You have reached the limit of scheduled posts. Cancel ones you no longer need first.",
    "schedule.error.server": "Failed to process the scheduled post.",
    "schedule.failure.CredentialMissing":
        "Scheduled posts were turned off, so the post was not made.",
    "schedule.failure.CredentialInvalid":
        "The stored authorization for scheduled posts could not be read. Turn on scheduled posts again in Settings.",
    "schedule.failure.CredentialExpired":
        "The permission for scheduled posts on Bluesky was no longer valid. Turn on scheduled posts again in Settings.",
    "schedule.failure.InvalidRecord": "The post content was not accepted.",
    "schedule.failure.ImageMissing": "An attached image was not found.",
    "schedule.failure.RetryExceeded":
        "Temporary failures continued and the post was not made.",
    "schedule.failure.unknown": "The post was not made.",
} satisfies MessageEntries

/** Entry（一覧・カード・編集・削除・下書き・詳細）関連の文言（英語）。キー集合は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const entry = {
    "entry.noText": "(No text)",
    "entry.card.noCaption": "No caption.",
    "entry.card.deleteConfirmAria": "Confirm Entry deletion",
    "entry.edit.aria": "Edit Entry",
    "entry.edit.heading": "Heading",
    "entry.edit.caption": "Caption",
    "entry.edit.updateFailed": "Failed to update the Entry.",
    "entry.deleteConfirm.legacy":
        "This Entry was created with an older format and can't be deleted together with its Bluesky post. Delete only the Skyshare link, or delete the post directly on Bluesky.",
    "entry.deleteConfirm.unknown":
        "The state of the Bluesky post can't be checked, so deleting together with the post isn't possible right now. Please try again later.",
    "entry.deleteConfirm.deleteLink": "Delete Skyshare link only",
    "entry.deleteConfirm.deleteLinkAndPost": "Delete link and Bluesky post",
    "entry.deletePosts.aria": "Final confirmation to delete Bluesky posts",
    "entry.deletePosts.title": "Really delete the Bluesky posts?",
    "entry.deletePosts.summarySingle": "This will delete 1 Bluesky post.",
    "entry.deletePosts.summaryThread_one":
        "This will delete a Bluesky thread ({count} post).",
    "entry.deletePosts.summaryThread_other":
        "This will delete a Bluesky thread ({count} posts).",
    "entry.deletePosts.warning":
        "This can't be undone. Replies from other people will not be deleted.",
    "entry.deletePosts.listAria": "Bluesky posts to be deleted",
    "entry.deletePosts.deleteAll": "Delete all",
    "entry.draft.thread_one": "Thread ({count} post)",
    "entry.draft.thread_other": "Thread ({count} posts)",
    "entry.draft.empty": "No drafts.",
    "entry.draft.saveConfirmAria": "Confirm saving draft",
    "entry.draft.saving": "Saving draft...",
    "entry.draft.save": "Save draft",
    "entry.draft.discard": "Discard",
    "entry.draft.keepEditing": "Keep editing",
    "entry.draft.paginationAria": "Draft list pagination",
    "entry.list.loadFailed": "Failed to load Entries.",
    "entry.list.empty": "No Entries to show.",
    "entry.list.end": "You've reached the first Entry",
    "entry.list.paginationAria": "Entry list pagination",
    "entry.list.infiniteAria": "Entry list auto-load",
    "entry.list.guestNotice":
        "This is guest mode, which doesn't require logging in. You can't edit real Entries. Deleting an Entry is only simulated on screen and does not affect any real data.",
    "entry.legacy.confirm": "Delete this post?",
    "entry.legacy.deleteFailed": "Failed to delete the post.",
    "entry.detail.viewSource": "View original post on Bluesky",
    "entry.detail.postedAt": "Posted: {date}",
    "entry.detail.noDate": "no data",
    "entry.detail.sourceDeleted":
        "The original post has been deleted, so only the saved content is shown.",
    "entry.detail.error404Title": "Entry Not Found",
    "entry.detail.error404Body": "Entry is not found",
    "entry.detail.errorInvalid": "Invalid skyshare entry",
    "entry.detail.error503Title": "Service Temporarily Unavailable",
    "entry.detail.error503Body":
        "Data fetching is busy. Please try again in a moment.",
    "entry.detail.error500Title": "Internal Server Error",
    "entry.detail.error500Body": "An error occurred while generating the page.",
} satisfies MessageEntries

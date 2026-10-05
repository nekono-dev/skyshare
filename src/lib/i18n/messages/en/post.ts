/** 投稿・タイムライン関連の文言（英語）。キー集合・スロット名は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const post = {
    "post.guestUnavailable": "Not available in guest mode",
    "post.guestNotice":
        "This is guest mode, which doesn't require logging in. Posting to Bluesky is skipped, but you can try the popup, the share sheet, and the post buttons for X, Taittsuu, and Mastodon by pressing the post button.",
    "post.launcher.new": "New post",

    "post.card.openBluesky": "Open in Bluesky",
    "post.card.webShare": "Share with the Web Share API",
    "post.card.openEntry": "Open Entry",
    "post.card.creatingEntry": "Creating Entry...",
    "post.card.deletingEntry": "Deleting Entry...",
    "post.card.checkingDeletion": "Checking what will be deleted...",
    "post.card.loadingImages": "Loading images...",
    "post.entry.createFailed": "Failed to create the Skyshare page.",
    "post.entry.deleteFailed": "Failed to delete the Entry.",
    "post.entry.deleteBlocked":
        "This Entry can't be deleted together with its Bluesky post.",
    "post.webShare.unsupported":
        "Your browser doesn't support sharing this content.",
    "post.webShare.failed": "Failed to share with the Web Share API.",
    "post.entryActions.crosspost": "Cross-post",
    "post.entryActions.deletePost": "Delete post",
    "post.entryActions.creating": "Creating…",
    "post.entryActions.create": "Create Skyshare Entry",
    "post.entryActions.notEligible": "Not eligible for a Skyshare link",
    "post.stats.aria": "Reactions on Bluesky",
    "post.stats.like": "Likes",
    "post.stats.repost": "Reposts",
    "post.stats.reply": "Replies",
    "post.stats.quote": "Quotes",
    "post.threadExpand_one": "Expand thread ({count} reply)",
    "post.threadExpand_other": "Expand thread ({count} replies)",
    "post.threadCollapse": "Collapse",
    "post.suggest.trending": "Trending",

    "post.timeline.loadFailed": "Failed to load posts.",
    "post.timeline.initializing": "Initializing...",
    "post.timeline.paginationAria": "Post list pagination",
    "post.timeline.infiniteAria": "Post list auto-load",
    "post.timeline.guestNotice":
        "This is guest mode. You can try everything except posting to Bluesky. Deleting an Entry is only simulated on screen and does not affect any real data.",

    "post.selfLabel.aria": "Content label",
    "post.selfLabel.none": "No label",
    "post.selfLabel.sexual": "Suggestive (sexual)",
    "post.selfLabel.nudity": "Nudity (nudity)",
    "post.selfLabel.porn": "Adult (porn)",
    "post.selfLabel.spoiler": "Spoiler (spoiler)",
    "post.selfLabel.warn": "Warning (warn)",

    "post.autoPopupTarget.label": "Auto-popup destination",
    "post.autoPopupTarget.ask": "Choose when posting",
    "post.autoPopupTarget.x": "X",
    "post.autoPopupTarget.taittsuu": "Taittsuu",
    "post.autoPopupTarget.mastodon": "Mastodon",
    "post.shareDialog.aria": "Choose where to share",
    "post.shareDialog.x": "Post to X",
    "post.shareDialog.taittsuu": "Post to Taittsuu",
    "post.shareDialog.mastodon": "Post to Mastodon",

    "post.gate.title": "Reply and quote settings",
    "post.gate.mentioned": "People you mention",
    "post.gate.follower": "Your followers",
    "post.gate.following": "People you follow",
    "post.gate.everyone": "Anyone can reply",
    "post.gate.nobody": "No one can reply",
    "post.gate.chooseFromLists": "Choose from lists",
    "post.gate.listsLoading": "Loading lists...",
    "post.gate.listsLoadFailed": "Failed to load your lists.",
    "post.gate.listsEmpty": "You have no lists.",
    "post.gate.limit": "You can select up to {max}.",
    "post.gate.allowQuote": "Allow quoting",

    "post.segment.dropMedia": "Drop an image or video to attach",
    "post.segment.placeholderFirst": "What's up?",
    "post.segment.placeholderNext": "Add to thread...",
    "post.segment.gateOpen": "Anyone can interact",
    "post.segment.gateRestricted": "Interactions are limited",
    "post.segment.addToThread": "Add to thread",
    "post.segment.emptyText": "(No text)",
    "post.segment.removeAria": "Delete this segment",
    "post.segment.remove": "Delete",

    "post.composer.draftListLoadFailed": "Failed to load drafts.",
    "post.composer.draftApplied": "Draft loaded.",
    "post.composer.draftSaveFailed": "Failed to save the draft.",
    "post.composer.sending": "Sending…",
    "post.composer.guestProcessing": "Processing…",
    "post.composer.loadingDrafts": "Loading drafts...",
    "post.composer.draftListTitle": "Drafts",
    "post.composer.formAria": "Post form",
    "post.composer.posting": "Posting...",
    "post.composer.drafts": "Drafts",
    "post.composer.guestSubmitNotice":
        "In guest mode, posting to Bluesky is skipped",
    "post.composer.submitAll": "Post all",
    "post.composer.submit": "Post",
    "post.composer.popupInstead": "Open a popup {popup} instead of {share}",
    "post.composer.manualImageAttach": "Attach images manually (no URL)",
    "post.composer.counterLabel.taittsuu": "Taittsuu",
    "post.composer.truncateIntentText": "Truncate long text when sharing",
    "post.composer.moreOptions": "More options",

    "post.submit.postFailed": "Failed to post to Bluesky.",
    "post.submit.entryCreateFailed":
        "Posted to Bluesky, but failed to create the Skyshare record.",
    "post.submit.unexpected": "An unexpected error occurred while posting.",
    "post.submit.failed": "Failed to post.",

    "post.share.resultSuccess": "Posted to Bluesky",
    "post.share.resultGuest":
        "Skipped posting to Bluesky because this is guest mode",
    "post.share.service.taittsuu": "Taittsuu",
    "post.share.service.mastodon": "Mastodon",
    "post.share.service.x": "x.com",
    "post.share.chooseTarget": "{result}. Choose where to share.",
    "post.share.popupOpened": "{result}. Opened the {service} post screen.",
    "post.share.popupBlocked":
        '{result}. Could not open the {service} post screen. Check your popup blocker. A dialog to choose where to share has been opened, and the auto-popup destination is now "Choose when posting".',
    "post.share.webShareDone": "{result}. Sent the post to the Web Share API.",
    "post.share.webShareCancelled":
        "{result}. The Web Share API share was cancelled.",
    "post.share.reason.unsupported":
        "Because this browser doesn't support the Web Share API",
    "post.share.reason.failed": "Because sharing with the Web Share API failed",
    "post.share.fallbackOpened":
        "{result}. Opened the post screen. {reason}, the option to open a popup has been turned on.",
    "post.share.fallbackBlocked":
        '{result}, but the post screen could not be opened. Check your popup blocker. A dialog to choose where to share has been opened, and the auto-popup destination is now "Choose when posting".',
} satisfies MessageEntries

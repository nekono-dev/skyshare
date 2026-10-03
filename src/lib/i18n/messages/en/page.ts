/** 各ページ固有の文言（英語）。キー集合・スロット名は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const page = {
    "page.help.heading": "Past questions and fixes",
    "page.help.androidMedia.title": "Can't select images",
    "page.help.androidMedia.description":
        '"Permission was denied, so media can\'t be selected" is shown',
    "page.help.androidMedia.intro":
        "This message appears when your browser has not been allowed to access photos and videos.",
    "page.help.androidMedia.step1": 'Open the "Settings" app on your device',
    "page.help.androidMedia.step2":
        '"Apps" → choose the browser you use (such as Chrome)',
    "page.help.androidMedia.step3":
        '"Permissions" → change "Photos and videos" (or "Files and media") to allowed',
    "page.help.androidMedia.outro":
        "If you have installed it as an app (PWA), change the setting of the browser you used to install it.",
    "page.accounts.heading": "Switch account",
    "page.accounts.description":
        'Click a card to switch to that account. Use the "Log out" button on a card to log out of that account.',
    "page.entries.heading": "Skyshare Entries",
    "page.jump.opening": "Opening the post screen…",
    "page.jump.hint":
        "If this doesn't switch after a while, check your popup blocker settings or close this window.",
    "page.login.oldUi": "Looking for the old UI? {link}",
    "page.login.guest":
        "You can {link} as a guest (not available while logged in).",
    "page.login.guestLink": "preview the screens",
    "page.login.v2Notice":
        "★ Skyshare v2 is under development. Here are the differences.",
    "page.login.persist.title": "Persistent Skyshare-generated content",
    "page.login.persist.item1":
        "Until now, images and text data were stored on the developer's backend. Because the developer had to bear the backend costs, data had to be given an expiration date.",
    "page.login.persist.item2":
        "In v2, content generated with Skyshare is stored on your PDS. This means you can keep it forever, as long as you don't delete your account (and Bluesky keeps hosting your PDS) {bold}",
    "page.login.persist.item2Bold": "(data no longer expires)",
    "page.login.thumb.title":
        "More freedom in generating cross-post thumbnails",
    "page.login.thumb.item1":
        "In v1, the cross-post thumbnail (link card image) was generated on the server side in the cloud. In v2 it is generated on the client side.",
    "page.login.thumb.item2":
        "This makes the link card image flexibly editable. {bold}At the moment, you can crop the part you want as the thumbnail and adjust the display position when several images are placed.",
    "page.login.thumb.item2Bold":
        "(editing of generated link card images added)",
    "page.login.thumb.item3":
        "If there is demand, we are considering preparing a separate image for the link card (no automatic generation) and processing depending on labeler state... In short, something like mosaicking the thumbnails of R-18 images.",
    "page.login.other.title":
        "Many other improvements that make it easier to use",
    "page.login.other.item1":
        "Many things that weren't possible in v1 now are. The backend is mostly done, and the release is planned once the layout and feature adjustments and additions and the source code cleanup are finished.",
    "page.login.other.item2":
        "We are hard at work toward the official release, so your impressions and requests with {hashtag} or similar would be a great encouragement.",
    "page.legacyPost.title": "Post by {profile}",
    "page.legacyPost.viewOnBluesky": "View the post on Bluesky",
    "page.legacyPost.noImages": "No images.",
    "page.legacyPost.imagesAria": "Post images",
    "page.legacyPost.error404Title": "Post Not Found",
    "page.legacyPost.notFound": "Post is not found",
    "page.legacyPost.invalidId": "Invalid post identifier",
} satisfies MessageEntries

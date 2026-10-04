/** 動画投稿（添付・アップロード・再生）関連の文言（英語）。キー集合は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const video = {
    "video.picker.add": "Add video",
    "video.picker.addAria": "Add video",
    "video.picker.remove": "Remove video",
    "video.picker.reselect": "Choose another video",
    "video.picker.altAria": "Edit alt text for the video",
    "video.picker.progressAria": "Video upload progress",
    "video.picker.exclusiveWithImage":
        "A video can't be added while images are attached",
    "video.picker.exclusiveWithOgp":
        "A video can't be added while a link card is attached",
    "video.picker.exclusiveWithVideo": "A video is already attached",
    "video.status.uploading": "Uploading… {percent}%",
    "video.status.processing": "Processing… {percent}%",
    "video.status.done": "Upload complete",
    "video.submit.waitUpload": "You can't post until the video upload finishes",
    "video.submit.removeFailed":
        "A video failed to upload. Remove it or choose another one",
    "video.play": "Play video",
    "video.playError": "Couldn't play the video. View on Bluesky",
    "video.unavailable.title": "This video can't be played on Skyshare",
    "video.unavailable.link": "View on Bluesky",
    "video.error.notMp4": "Only mp4 videos can be attached",
    "video.error.tooLarge": "The video must be 300MB or smaller",
    "video.error.tooLong": "The video must be 10 minutes or shorter",
    "video.error.unreadable": "Couldn't read the video",
    "video.error.badAspectRatio":
        "The video's aspect ratio is outside what Bluesky allows",
    "video.error.dailyLimit": "You've reached today's video upload limit",
    "video.error.forbidden":
        "You don't have permission to upload videos (email verification may be required)",
    "video.error.tooManyUploads":
        "Too many video uploads are in progress. Try again later",
    "video.error.overloaded": "The video service is busy. Try again later",
    "video.error.processingFailed": "Video processing failed",
    "video.error.timeout": "Video processing took too long and was stopped",
    "video.error.unsupportedPds":
        "This account can't post videos (only bsky.social accounts are supported)",
    "video.error.network": "Network error. Please try again",
    "video.error.unknown": "Failed to upload the video",
} satisfies MessageEntries

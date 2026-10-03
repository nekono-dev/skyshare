/** ゲストモードのダミー投稿・ダミーEntryの文言（英語）。キー集合は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const guest = {
    "guest.userName": "Guest user",
    "guest.imageLabel": "Image",
    "guest.sampleImageAlt": "Sample image",
    "guest.sampleImage2Alt": "Sample image 2",
    "guest.sampleImageN": "Sample image {index}",
    "guest.post1.text": "This is a sample post for the guest demo.",
    "guest.post2.text":
        "How an image post looks when a URL is issued. (You can cross-post again to other SNS with the share or popup button.)",
    "guest.entry1.heading": "Sample Entry",
    "guest.entry1.postCaption": "This is a dummy Entry for guest mode.",
    "guest.post3.text":
        "How an image post looks when no URL is issued. (You can create a Skyshare Entry later.)",
    "guest.multi.text":
        "How a post with 6 images looks. (All images line up as horizontally scrolling thumbnails.)",
    "guest.threadA.tailText": "Thread A, post 3.",
    "guest.threadA.midText":
        "Thread A, post 2. It has an image and no Entry has been created.",
    "guest.threadA.rootText": "Thread A, post 1 (root, no image).",
    "guest.threadA.imageAlt": "Thread A sample image",
    "guest.threadB.tailText": "Thread B, post 2.",
    "guest.threadB.rootText": "Thread B, post 1 (root, Entry created).",
    "guest.threadB.imageAlt": "Thread B sample image",
    "guest.threadB.entryHeading": "Thread B sample Entry",
    "guest.threadB.entryCaption":
        "This is a dummy thread-based Entry for guest mode.",
    "guest.threadC.tailText": "Thread C, post 3.",
    "guest.threadC.midText": "Thread C, post 2.",
    "guest.threadC.rootText": "Thread C, post 1 (root, with image).",
    "guest.threadC.imageAlt": "Thread C sample image",
    "guest.threadD.midText":
        "Thread D, post 2. An Entry was created for this post under the old format.",
    "guest.threadD.entryHeading": "Thread D sample Entry",
    "guest.threadD.entryCaption":
        "This is a dummy old-format Entry for guest mode.",
    "guest.threadD.rootText": "Thread D, post 1 (root, no image).",
    "guest.unknown.text":
        "A post for checking the display when the state of the Bluesky post can't be determined.",
    "guest.unknown.entryHeading": "Undeterminable sample Entry",
    "guest.unknown.entryCaption":
        "This is a dummy Entry for guest mode whose state can't be determined.",
    "guest.entry2.heading": "Sample with a deleted original post",
    "guest.entry2.caption":
        "A sample where the linked Bluesky post has been deleted. The URL stays viewable as long as the Skyshare Entry is not deleted.",
} satisfies MessageEntries

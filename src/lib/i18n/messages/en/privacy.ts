/**
 * Privacy policy text (English). A courtesy translation: the Japanese text is authoritative.
 * `{operator}`/`{email}`/`{handle}`/`{enactedAt}`/`{revisedAt}` are filled from `operator.ts`.
 */
import type { MessageEntries } from "../../translate"

export const privacy = {
    "privacy.heading": "Privacy Policy",
    "privacy.lead":
        '{operator} (the "Operator") handles the personal information of users of Skyshare (the "Service") in accordance with Japan\'s Act on the Protection of Personal Information and other applicable laws, as described below. This English text is a courtesy translation; the Japanese text prevails.',
    "privacy.operator.title": "1. Operator",
    "privacy.operator.name":
        "Name of the business operator: {operator} (operated by an individual)",
    "privacy.operator.contact":
        "Contact: {email}, or the Bluesky account @{handle}",
    "privacy.operator.definition":
        "In this policy, personal information means information that can identify a specific individual, such as a Bluesky handle, a DID, or the content of a post.",
    "privacy.collected.title": "2. Information we handle",
    "privacy.collected.intro":
        "The Service handles the following information only when you use the corresponding feature. The Service has no account registration, and the Operator keeps no list of users.",
    "privacy.collected.head.category": "Category",
    "privacy.collected.head.data": "Information",
    "privacy.collected.head.place": "Where it is kept",
    "privacy.collected.login.category": "Login",
    "privacy.collected.login.data":
        "Bluesky handle or email address, password (an app password is recommended), authentication tokens (access and refresh tokens), DID, handle, display name, avatar image",
    "privacy.collected.login.place":
        "The password is received only temporarily to authenticate with Bluesky and is not stored. The tokens are stored in a cookie in your browser.",
    "privacy.collected.post.category": "Posts and entries",
    "privacy.collected.post.data":
        "Post text, images, videos, link cards, self-labels, drafts, and Skyshare entries (page information for sharing)",
    "privacy.collected.post.place":
        "Written to your own Bluesky PDS (the server that stores your data). The Operator does not keep it.",
    "privacy.collected.schedule.category": "Scheduled posts",
    "privacy.collected.schedule.data":
        "The content of the scheduled post (text and settings), attached images, the run time, the run status, your DID, and the credential used to run it (an encrypted refresh token and the PDS to connect to)",
    "privacy.collected.schedule.place":
        "Stored in the Operator's Cloudflare database (D1) and storage (R2), only if you use the scheduled post feature.",
    "privacy.collected.device.category": "Stored on your device",
    "privacy.collected.device.data":
        "Theme, display language, sharing, post form and timeline settings, hashtag history, Mastodon instance name",
    "privacy.collected.device.place":
        "Stored in your browser's local storage. It is not sent to the Operator's server.",
    "privacy.collected.log.category": "Access logs",
    "privacy.collected.log.data":
        "Access time, URL, IP address, browser type (User-Agent), error records",
    "privacy.collected.log.place":
        "Recorded by Cloudflare, which hosts the Service, for operation and troubleshooting.",
    "privacy.collected.note1":
        "The Service does not use analytics tools, advertising, or cookies meant to track users.",
    "privacy.collected.note2":
        "The Service does not collect special care-required personal information such as medical history or beliefs. Decide for yourself the audience of any information you include in your posts.",
    "privacy.collected.note3":
        "No credentials are collected when you open pages that can be viewed without logging in, such as public entry pages.",
    "privacy.purpose.title": "3. Purposes of use",
    "privacy.purpose.intro":
        "We use the information only for the following purposes and not for any other purpose.",
    "privacy.purpose.item1":
        "To create and delete posts, drafts, and entries on Bluesky with the account you logged in with",
    "privacy.purpose.item2":
        "To post automatically with your account at the scheduled time",
    "privacy.purpose.item3":
        "To keep the settings you chose, such as language, theme, and sharing",
    "privacy.purpose.item4":
        "To provide the features you use, such as fetching link cards, showing images and videos, and sharing to other social networks",
    "privacy.purpose.item5":
        "To investigate problems, prevent misuse, and run the Service safely",
    "privacy.purpose.item6":
        "To respond to requests such as disclosure under this policy",
    "privacy.external.title":
        "4. Transmission to external services and provision to third parties",
    "privacy.external.intro":
        "The Operator does not provide personal information to third parties without your consent, except when required by law, when necessary to protect a person's life, body, or property and consent is hard to obtain, or when cooperation with a public authority is required. The Service sends information to the following external services to provide its features (this table also serves as the notice of external transmission under the Telecommunications Business Act).",
    "privacy.external.head.dest": "Destination",
    "privacy.external.head.data": "Information sent",
    "privacy.external.head.purpose": "Purpose",
    "privacy.external.pds.dest": "Bluesky PDS (where your account is hosted)",
    "privacy.external.pds.data":
        "Login credentials, records such as posts, drafts, and entries, images, and requests for a video upload token",
    "privacy.external.pds.purpose":
        "Logging in, saving and deleting posts and records, and running scheduled posts",
    "privacy.external.appview.dest": "Bluesky AppView (public API)",
    "privacy.external.appview.data":
        "Handles and DIDs, search terms for mentions and hashtags, list requests",
    "privacy.external.appview.purpose":
        "Showing profiles and suggesting mentions and hashtags",
    "privacy.external.video.dest": "Bluesky video service",
    "privacy.external.video.data":
        "The video you post and a video upload token",
    "privacy.external.video.purpose":
        "Transcoding videos and attaching them to posts",
    "privacy.external.cdn.dest": "Bluesky image CDN",
    "privacy.external.cdn.data":
        "The images you view (and connection information such as your IP address)",
    "privacy.external.cdn.purpose": "Showing images in posts",
    "privacy.external.plc.dest": "PLC Directory",
    "privacy.external.plc.data": "DID",
    "privacy.external.plc.purpose": "Finding your PDS from your DID",
    "privacy.external.ogp.dest": "OGP extraction service (run by the Operator)",
    "privacy.external.ogp.data": "URLs contained in your post",
    "privacy.external.ogp.purpose":
        "Fetching the title, description, and image of a linked page, and preparing the card in advance for sharing",
    "privacy.external.legacy.dest": "Legacy backend (old-format post pages)",
    "privacy.external.legacy.data":
        "The identifier of an old-format post page, and your credentials when you request deletion",
    "privacy.external.legacy.purpose":
        "Showing previously created post pages and letting the author delete them",
    "privacy.external.cloudflare.dest": "Cloudflare, Inc.",
    "privacy.external.cloudflare.data":
        "All communication with the Service, scheduled post data, and access logs",
    "privacy.external.cloudflare.purpose":
        "Delivering the Service, storing and running scheduled posts, and operational records (the hosting provider the Operator relies on)",
    "privacy.external.sns.dest": "Sharing targets (X, Taittsuu, Mastodon)",
    "privacy.external.sns.data":
        "The text to share and a Skyshare URL (passed through the share screen your browser opens when you choose to share)",
    "privacy.external.sns.purpose": "Sharing to the social network you chose",
    "privacy.external.note1":
        "Cloudflare and Bluesky are located in foreign countries such as the United States. Information is sent to them only within the purposes above. Personal information protection systems in those countries may differ from Japan's.",
    "privacy.external.note2":
        "The Operator cannot control how these external services handle personal information. Please check their privacy policies.",
    "privacy.retention.title": "5. Retention",
    "privacy.retention.item1":
        "Login cookies: 7 days from your last login or refresh. They are deleted when you log out.",
    "privacy.retention.item2":
        "Stored on your device: remains in your browser until you delete it.",
    "privacy.retention.item3":
        "Scheduled post content: kept until it runs. The record of a success or failure is deleted automatically 7 days after it finishes. A canceled schedule is deleted immediately.",
    "privacy.retention.item4":
        "Images attached to scheduled posts: deleted when the post succeeds or is canceled. Images that were never used are also deleted automatically 45 days after they were stored.",
    "privacy.retention.item5":
        "Credentials for scheduled posts: deleted automatically when no schedules remain. You can delete them any time from the schedule list page.",
    "privacy.retention.item6":
        "Access logs: kept by Cloudflare for a short period needed for operation, according to its specifications.",
    "privacy.retention.item7":
        "Old-format post pages: kept for the period set by the legacy backend, or until the author deletes them.",
    "privacy.retention.item8":
        "Posts, drafts, and entries stored on your PDS: kept until you delete them or delete your account.",
    "privacy.security.title": "6. Security measures",
    "privacy.security.item1": "All communication is protected with HTTPS.",
    "privacy.security.item2":
        "Authentication cookies are set with HttpOnly, Secure, and SameSite so that scripts in the browser cannot read them.",
    "privacy.security.item3":
        "For scheduled posts, the password itself is not stored. Only the refresh token obtained by authenticating with Bluesky is stored, encrypted with AES-GCM, and only the Operator manages the encryption key.",
    "privacy.security.item4":
        "Scheduled posts require an app password with limited permissions. Do not enter your main password.",
    "privacy.security.item5":
        "Only the Operator can access the Operator's data, and information is deleted after the periods above.",
    "privacy.rights.title": "7. Your rights and contact",
    "privacy.rights.intro":
        "You may request the disclosure, correction, addition, deletion, suspension of use, or suspension of third-party provision of your personal information held by the Operator. Please contact the address below. After confirming your identity, we will respond without delay in accordance with the law.",
    "privacy.rights.contact":
        "Contact: {email}, or the Bluesky account @{handle}",
    "privacy.rights.item1":
        "You can cancel scheduled posts, delete their history, and delete the credentials for scheduled posts yourself on the schedule list page.",
    "privacy.rights.item2":
        "To delete posts, drafts, and entries stored on your Bluesky PDS, use the Service or Bluesky.",
    "privacy.rights.item3":
        "The author of an old-format post page can delete it from the Service.",
    "privacy.rights.item4":
        "You can delete what is stored on your device from your browser settings at any time.",
    "privacy.revision.title": "8. Changes to this policy",
    "privacy.revision.body":
        "The Operator may revise this policy to reflect changes in the law or new features. Important changes will be announced on the Service. A revision takes effect when it is posted on this page.",
    "privacy.revision.dates":
        "Enacted: {enactedAt} / Last revised: {revisedAt}",
    "privacy.link": "Privacy Policy",
    "privacy.scheduleNotice":
        "See the {link} for how the information stored for scheduling is handled.",
} satisfies MessageEntries

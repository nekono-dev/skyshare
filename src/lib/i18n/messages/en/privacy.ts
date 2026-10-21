/**
 * Privacy policy text (English). A courtesy translation: the Japanese text is authoritative.
 * `{operator}`/`{email}`/`{handle}`/`{enactedAt}`/`{revisedAt}` are filled from `operator.ts`.
 */
import type { MessageEntries } from "../../translate"

export const privacy = {
    "privacy.heading": "Privacy Policy",
    "privacy.lead":
        '{operator} (the "Operator") handles the personal information of users of Skyshare (the "Service") in compliance with the Act on the Protection of Personal Information and other laws of Japan, as set out below. This English text is a courtesy translation, and the Japanese text prevails.',
    "privacy.operator.title": "Article 1 (Operator)",
    "privacy.operator.name":
        "The business operator is {operator}, an individual.",
    "privacy.operator.contact":
        "Please contact us at {email} or @{handle} on Bluesky.",
    "privacy.operator.definition":
        "Personal information means information that can identify a specific individual, such as a handle or the content of a post.",
    "privacy.collected.title": "Article 2 (Information we collect)",
    "privacy.collected.intro":
        "When you use the Service, we handle the following information. The Service has no sign-up, and the Operator does not keep a list of users.",
    "privacy.collected.login":
        "When you log in, we receive your handle or email address and your password. The password is not stored.",
    "privacy.collected.post":
        "Post text, images, videos, drafts, and page information for sharing are saved in your own Bluesky account. The Operator does not store them.",
    "privacy.collected.schedule":
        "Only if you use scheduled posts, we store the post content, images, run time, and the login information needed to run the post, in a place managed by the Operator.",
    "privacy.collected.device":
        "Settings such as language and theme are saved only in your browser and are not sent to the Operator.",
    "privacy.collected.log":
        "Access time, URL, IP address, and browser type are recorded as access logs by Cloudflare, which hosts the Service.",
    "privacy.collected.analytics":
        "To understand how the Service is used, we collect the pages viewed, device and browser type, and approximate region through Google Analytics. This uses cookies and applies to every page, whether or not you are logged in.",
    "privacy.collected.note1": "We do not serve advertising.",
    "privacy.collected.note2":
        "We do not collect special care-required personal information, such as medical history or beliefs.",
    "privacy.purpose.title": "Article 3 (Purposes of use)",
    "privacy.purpose.intro":
        "We use the information we collect within the following purposes.",
    "privacy.purpose.item1":
        "To provide the features you use, such as posting to and deleting from Bluesky",
    "privacy.purpose.item2":
        "To post automatically with your account at the scheduled time",
    "privacy.purpose.item3": "To keep the settings you have chosen",
    "privacy.purpose.item4":
        "To show link cards and to share to other social networks",
    "privacy.purpose.item5": "To understand usage and improve the Service",
    "privacy.purpose.item6": "To investigate problems and to prevent misuse",
    "privacy.external.title":
        "Article 4 (Transmission to external services and provision to third parties)",
    "privacy.external.intro":
        "Except where the law requires, the Operator does not provide personal information to third parties without your consent. To provide the Service, however, we send information to the following external services. This also serves as the notice of external transmission under the Telecommunications Business Act.",
    "privacy.external.bluesky":
        "We send login information, posts, images, and videos to Bluesky for logging in and posting.",
    "privacy.external.plc":
        "We send your account identifier (DID) to PLC Directory to find where your data is stored.",
    "privacy.external.ogp":
        "We send URLs in your post to the OGP extraction service run by the Operator, to get the title and image of the linked page.",
    "privacy.external.legacy":
        "We send the identifier of a post to the legacy backend, to show past post pages and let the author delete them.",
    "privacy.external.cloudflare":
        "We entrust the delivery and operation of the Service to Cloudflare, so communication content and scheduled post data are stored with it.",
    "privacy.external.google":
        "We send information about how pages are viewed to Google (Google Analytics) to understand usage.",
    "privacy.external.sns":
        "The text and URL to share are passed to X, Taittsuu, or Mastodon only when you choose to share.",
    "privacy.external.optout":
        "You can stop analytics through your browser's cookie settings or Google's opt-out add-on.",
    "privacy.external.note1":
        "Some of these services are located outside Japan, such as in the United States, where personal information protection rules may differ from Japan's.",
    "privacy.external.note2":
        "For how each service handles information, please see its own privacy policy.",
    "privacy.retention.title": "Article 5 (Retention)",
    "privacy.retention.item1":
        "Login information is kept for 7 days and deleted when you log out.",
    "privacy.retention.item2":
        "Settings on your device remain in your browser until you delete them.",
    "privacy.retention.item3":
        "Scheduled post content is deleted 7 days after it finishes running, or immediately if you cancel it.",
    "privacy.retention.item4":
        "Scheduled post images are deleted when the post runs or is canceled. Unused images are also deleted automatically after 45 days.",
    "privacy.retention.item5":
        "Login information for scheduling is deleted when no schedules remain. You can also delete it yourself at any time.",
    "privacy.retention.item6":
        "Access logs are kept only for the period Cloudflare sets.",
    "privacy.retention.item7":
        "Analytics information is kept according to Google's settings.",
    "privacy.security.title": "Article 6 (Security)",
    "privacy.security.item1": "Communication is protected with encryption.",
    "privacy.security.item2":
        "Login information is stored so that programs in the browser cannot read it.",
    "privacy.security.item3":
        "For scheduled posts, we do not store the password, and we encrypt the login information we keep.",
    "privacy.security.item4":
        "Please use an app password with limited permissions for scheduling. Do not enter your main password.",
    "privacy.security.item5":
        "No one other than the Operator can access the information the Operator manages.",
    "privacy.rights.title":
        "Article 7 (Requests for disclosure, correction, deletion, and so on)",
    "privacy.rights.intro":
        "You may request disclosure, correction, deletion, or suspension of use of your personal information held by the Operator. After confirming your identity, we will respond without delay.",
    "privacy.rights.contact":
        "Please send requests and inquiries to {email} or @{handle} on Bluesky.",
    "privacy.rights.item1":
        "You can cancel scheduled posts, delete their history, and delete the login information for scheduling from the schedule list page.",
    "privacy.rights.item2":
        "Posts and other data saved on Bluesky can be deleted through the Service or Bluesky.",
    "privacy.rights.item3":
        "Settings on your device can be deleted from your browser settings.",
    "privacy.revision.title": "Article 8 (Revisions)",
    "privacy.revision.body":
        "We may revise this policy when laws change or features are added. A revised policy takes effect when it is posted on this page.",
    "privacy.revision.dates":
        "Enacted: {enactedAt} / Last revised: {revisedAt}",
    "privacy.link": "Privacy Policy",
    "privacy.scheduleNotice":
        "See the {link} for how the information stored for scheduling is handled.",
} satisfies MessageEntries

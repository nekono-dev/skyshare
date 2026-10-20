/**
 * Privacy policy text (English). A courtesy translation: the Japanese text is authoritative.
 * `{operator}`/`{email}`/`{handle}`/`{enactedAt}`/`{revisedAt}` are filled from `operator.ts`.
 */
import type { MessageEntries } from "../../translate"

export const privacy = {
    "privacy.heading": "Privacy Policy",
    "privacy.lead":
        '{operator} (the "Operator") handles the personal information used in Skyshare (the "Service") in accordance with Japan\'s Act on the Protection of Personal Information and other laws. This English text is a courtesy translation; the Japanese text prevails.',
    "privacy.operator.title": "1. Operator",
    "privacy.operator.name": "Name: {operator} (run by an individual)",
    "privacy.operator.contact": "Contact: {email}, or @{handle} on Bluesky",
    "privacy.operator.definition":
        "Personal information means information that can identify a person, such as a handle or the content of a post.",
    "privacy.collected.title": "2. Information we handle",
    "privacy.collected.intro":
        "We handle the following only when you use the related feature. The Service has no sign-up, and the Operator keeps no list of users.",
    "privacy.collected.login":
        "Login: your handle or email, your password, and information that keeps you logged in. The password is not stored.",
    "privacy.collected.post":
        "Posts: text, images, videos, drafts, and page information for sharing. They are saved in your own Bluesky account, not by the Operator.",
    "privacy.collected.schedule":
        "Scheduled posts: the post content, images, the run time, and login information for the schedule. Kept in a place the Operator manages, only if you use scheduling.",
    "privacy.collected.device":
        "Settings on your device: settings such as language and theme. Saved only in your browser.",
    "privacy.collected.log":
        "Access logs: time, URL, IP address, and browser type. Recorded by Cloudflare, which hosts the Service, for operation and troubleshooting.",
    "privacy.collected.analytics":
        "Access analytics: pages viewed, device and browser type, and approximate region. Collected with Google Analytics, which uses cookies. It runs on every page, whether or not you are logged in.",
    "privacy.collected.note1": "We do not serve advertising.",
    "privacy.collected.note2":
        "We do not collect special care-required information such as medical history or beliefs.",
    "privacy.purpose.title": "3. Purposes of use",
    "privacy.purpose.intro": "We use the information only for the following.",
    "privacy.purpose.item1": "To post to and delete from Bluesky",
    "privacy.purpose.item2": "To post automatically at the scheduled time",
    "privacy.purpose.item3": "To keep the settings you chose",
    "privacy.purpose.item4":
        "To provide the features you use, such as link display and sharing",
    "privacy.purpose.item5":
        "To understand how the Service is used and improve it",
    "privacy.purpose.item6": "To investigate problems and prevent misuse",
    "privacy.external.title": "4. Sending to external services",
    "privacy.external.intro":
        "Except where the law requires, we do not provide personal information to third parties without your consent. To provide features, we send information to the following services (this also serves as the notice of external transmission under the Telecommunications Business Act).",
    "privacy.external.bluesky":
        "Bluesky: login information, posts, images, and videos. For logging in and posting.",
    "privacy.external.plc":
        "PLC Directory: your account identifier (DID). To find where your data is stored.",
    "privacy.external.ogp":
        "OGP extraction service (run by the Operator): URLs in your post. To get the title and image of a linked page.",
    "privacy.external.legacy":
        "Legacy backend: the identifier of an old-format post. To show past post pages and let the author delete them.",
    "privacy.external.cloudflare":
        "Cloudflare: communication with the Service and scheduled post data. To deliver and run the Service.",
    "privacy.external.google":
        "Google (Google Analytics): how pages are viewed. To understand usage.",
    "privacy.external.sns":
        "Sharing targets (X, Taittsuu, Mastodon): the text and URL to share. Only when you choose to share.",
    "privacy.external.note1":
        "Some destinations are in foreign countries such as the United States, whose rules may differ from Japan's.",
    "privacy.external.optout":
        "Analytics can be stopped with your browser's cookie settings or Google's opt-out add-on.",
    "privacy.external.note2":
        "Please see each service's own privacy policy for how it handles information.",
    "privacy.retention.title": "5. Retention",
    "privacy.retention.item1":
        "Login information: 7 days. Deleted when you log out.",
    "privacy.retention.item2":
        "Settings on your device: kept until you delete them.",
    "privacy.retention.item3":
        "Scheduled post content: kept until it runs. Deleted 7 days after it finishes, or right away if you cancel.",
    "privacy.retention.item4":
        "Scheduled post images: deleted when the post runs or is canceled, and after 45 days even if unused.",
    "privacy.retention.item5":
        "Login information for scheduling: deleted when no schedules remain. You can delete it any time yourself.",
    "privacy.retention.item6":
        "Access logs: kept by Cloudflare for a short period it sets.",
    "privacy.retention.item7":
        "Analytics information: kept according to Google's settings.",
    "privacy.security.title": "6. Security",
    "privacy.security.item1": "Communication is encrypted.",
    "privacy.security.item2":
        "Login information is stored so that programs in the browser cannot read it.",
    "privacy.security.item3":
        "For scheduling, the password is not stored, and the login information is encrypted.",
    "privacy.security.item4":
        "Use an app password with limited permissions for scheduling. Do not enter your main password.",
    "privacy.security.item5":
        "No one but the Operator can access the information the Operator manages.",
    "privacy.rights.title": "7. Your rights and contact",
    "privacy.rights.intro":
        "You may ask to see, correct, delete, or stop the use of your personal information held by the Operator. We will respond without delay after confirming your identity.",
    "privacy.rights.contact": "Contact: {email}, or @{handle} on Bluesky",
    "privacy.rights.item1":
        "You can cancel schedules, delete history, and delete the scheduling login information on the schedule list page.",
    "privacy.rights.item2":
        "Delete posts saved on Bluesky with the Service or Bluesky.",
    "privacy.rights.item3":
        "You can delete settings on your device from your browser settings.",
    "privacy.revision.title": "8. Changes to this policy",
    "privacy.revision.body":
        "We may revise this policy when laws change or features are added. A revision takes effect when it is posted on this page.",
    "privacy.revision.dates":
        "Enacted: {enactedAt} / Last revised: {revisedAt}",
    "privacy.link": "Privacy Policy",
    "privacy.scheduleNotice":
        "See the {link} for how the information stored for scheduling is handled.",
} satisfies MessageEntries

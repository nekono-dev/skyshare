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
    "privacy.operator.name": "The Service is run by {operator}, an individual.",
    "privacy.operator.contact":
        "Please contact us at {email} or @{handle} on Bluesky.",
    "privacy.collected.title": "Article 2 (Information we collect)",
    "privacy.collected.intro":
        "The Service handles the following information. There is no sign-up, and the Operator does not keep a list of users.",
    "privacy.collected.login":
        "When you log in, we receive your handle or email address and your password. The password is not stored.",
    "privacy.collected.schedule":
        "Only if you use scheduled posts, we store the post content, images, run time, and the login information needed to run the post.",
    "privacy.collected.device":
        "Settings such as language are saved only in your browser and are not sent to the Operator.",
    "privacy.collected.log":
        "Access time, URL, IP address, and browser type are recorded as access logs.",
    "privacy.collected.analytics":
        "Google Analytics collects the pages you view, your device and browser type, and your approximate region.",
    "privacy.collected.note":
        "Regular posts and drafts are saved in your own Bluesky account. The Operator does not store them.",
    "privacy.purpose.title": "Article 3 (Purpose of use)",
    "privacy.purpose.intro":
        "We use the information only for the following purposes.",
    "privacy.purpose.item1":
        "To provide the features you use, such as posting to Bluesky",
    "privacy.purpose.item2":
        "To post automatically from your account at the scheduled time",
    "privacy.purpose.item3":
        "To understand how the Service is used and to improve it",
    "privacy.purpose.item4": "To investigate bugs and prevent misuse",
    "privacy.external.title": "Article 4 (Provision to third parties)",
    "privacy.external.intro":
        "The Operator does not provide personal information to third parties without your consent, except in the following cases.",
    "privacy.external.item1": "When required by law",
    "privacy.external.item2":
        "When we send the necessary information to Bluesky for login and posting",
    "privacy.external.item3":
        "When we entrust communication content and scheduled-post data to Cloudflare, which hosts and runs the Service",
    "privacy.external.item4":
        "When we send your browsing activity to Google to understand usage",
    "privacy.external.note1":
        "When you choose to share to another social network, the text and URL you share are passed to it.",
    "privacy.external.note2":
        "Some recipients are outside Japan. Each company handles information under its own policy.",
    "privacy.external.note3":
        "This section also serves as the disclosure of external transmission under the Telecommunications Business Act.",
    "privacy.retention.title": "Article 5 (Retention and security)",
    "privacy.retention.item1":
        "Login information is kept for 7 days and deleted when you log out.",
    "privacy.retention.item2":
        "A scheduled post is deleted 7 days after it runs. If you cancel it, it is deleted immediately.",
    "privacy.retention.item3":
        "Scheduled images are deleted when the post runs or is canceled. Unused images are deleted after 45 days.",
    "privacy.retention.item4":
        "Login information for scheduled posts is stored encrypted. It is deleted when no scheduled posts remain, and you can delete it yourself at any time.",
    "privacy.retention.item5":
        "Access logs and analytics data are kept only for the period each company sets.",
    "privacy.retention.item6": "Communication is protected by encryption.",
    "privacy.retention.item7":
        "For scheduled posts, please use an app password with limited permissions.",
    "privacy.cookies.title": "Article 6 (Cookies and analytics)",
    "privacy.cookies.item1":
        "We use cookies and browser storage to keep you logged in and to save your settings.",
    "privacy.cookies.item2":
        "We use Google Analytics cookies to understand usage. They apply to all pages, whether or not you are logged in.",
    "privacy.cookies.item3":
        "You can stop analytics with your browser's cookie settings or a browser add-on provided by Google.",
    "privacy.cookies.item4": "We do not serve advertising.",
    "privacy.rights.title":
        "Article 7 (Requests for disclosure, correction, or deletion)",
    "privacy.rights.intro":
        "You can ask the Operator to disclose, correct, delete, or stop using your personal information that the Operator holds. We will respond without delay after confirming your identity.",
    "privacy.rights.contact":
        "Please send requests to the contact in Article 1.",
    "privacy.rights.item1":
        "You can cancel scheduled posts and delete history or saved login information from the scheduled posts page.",
    "privacy.rights.item2":
        "Settings saved on your device can be deleted from your browser settings.",
    "privacy.revision.title": "Article 8 (Revision)",
    "privacy.revision.body":
        "We may revise this policy when laws change or features are added. A revision takes effect when it is posted on this page.",
    "privacy.revision.dates":
        "Enacted: {enactedAt} / Last revised: {revisedAt}",
    "privacy.link": "Privacy Policy",
    "privacy.scheduleNotice":
        "See the {link} for how the information stored for scheduling is handled.",
} satisfies MessageEntries

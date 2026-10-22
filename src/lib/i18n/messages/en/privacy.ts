/**
 * Privacy policy text (English). A courtesy translation: the Japanese text is authoritative.
 * `{operator}`/`{email}`/`{handle}`/`{enactedAt}`/`{revisedAt}` are filled from `lib/site/siteConfig.ts`.
 */
import type { MessageEntries } from "../../translate"

export const privacy = {
    "privacy.heading": "Privacy Policy",
    "privacy.lead":
        '{operator} (the "Operator") handles the personal information of users of Skyshare (the "Service") in compliance with the Act on the Protection of Personal Information and other laws of Japan, as set out below. This English text is a courtesy translation, and the Japanese text prevails.',
    "privacy.operator.title": "Article 1 (Operator and contact)",
    "privacy.operator.name":
        "The Service is operated by {operator} (a pseudonym). The Operator's name and address will be provided without delay upon request.",
    "privacy.operator.contact":
        "Inquiries and complaints about the handling of personal information are accepted at {email} or @{handle} on Bluesky.",
    "privacy.operator.contactEmail":
        "Inquiries and complaints about the handling of personal information are accepted at {email}.",
    "privacy.collected.title": "Article 2 (Information we collect)",
    "privacy.collected.intro":
        "The Service collects the following information.",
    "privacy.collected.login":
        "When you log in, we receive your handle or email address and your password. The password is not stored.",
    "privacy.collected.schedule":
        "Only if you use scheduled posts, we store the post content, images, run time, and the account identifier and login information needed to run the post.",
    "privacy.collected.device":
        "Settings such as language are saved only in your browser and are not sent to the Operator.",
    "privacy.collected.log":
        "When you access the Service, the time, URL, IP address, and browser type are recorded.",
    "privacy.collected.analytics":
        "Google Analytics collects the pages you view, your device and browser type, and your approximate region.",
    "privacy.collected.inquiry":
        "When you contact us, we receive your email address or Bluesky account and the content of your inquiry.",
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
    "privacy.purpose.item5": "To answer your inquiries",
    "privacy.purpose.change":
        "We change the purposes only within a scope reasonably related to the original purposes, and publish the changed purposes on this page.",
    "privacy.external.title": "Article 4 (Provision to third parties)",
    "privacy.external.intro":
        "The Operator does not provide personal information to third parties without your prior consent, except in the following cases.",
    "privacy.external.item1": "When required by law",
    "privacy.external.item2":
        "When necessary to protect a person's life, body, or property and it is difficult to obtain your consent",
    "privacy.external.item3":
        "Other cases permitted under the Act on the Protection of Personal Information",
    "privacy.external.note":
        "Posting to Bluesky and sharing to other social networks are transmissions made on your instruction, to the destination you choose.",
    "privacy.retention.title": "Article 5 (Retention)",
    "privacy.retention.item1":
        "Login information is kept in your browser for 7 days and deleted when you log out.",
    "privacy.retention.item2":
        "A scheduled post is deleted 7 days after it runs. If you cancel it, it is deleted immediately.",
    "privacy.retention.item3":
        "Scheduled images are deleted when the post runs or is canceled. Any images left behind are deleted 15 days after they are stored.",
    "privacy.retention.item4":
        "Login information for scheduled posts is deleted when no posts are pending and 30 days have passed since a post was last scheduled, changed, or run. It is also deleted once we find the app password no longer works.",
    "privacy.retention.item5":
        "Access logs are kept only for the period set by Cloudflare.",
    "privacy.retention.item6":
        "Analytics data is kept by Google according to the Google Analytics retention setting.",
    "privacy.security.title": "Article 6 (Security measures)",
    "privacy.security.intro":
        "The Operator takes the following measures to prevent leakage of personal information.",
    "privacy.security.item1":
        "Only the Operator personally handles personal information.",
    "privacy.security.item2": "Communication is protected by encryption.",
    "privacy.security.item3":
        "Login information for scheduled posts is stored encrypted.",
    "privacy.security.item4":
        "Delivery of the Service and storage of scheduled-post data are entrusted to Cloudflare, Inc. in the United States.",
    "privacy.security.item5":
        "Information on the personal information protection system of the United States is available on the website of the Personal Information Protection Commission of Japan.",
    "privacy.security.note":
        "For scheduled posts, please use an app password with limited permissions instead of your main password.",
    "privacy.cookies.title": "Article 7 (Cookies and analytics)",
    "privacy.cookies.titleBasic": "Article 7 (Cookies)",
    "privacy.cookies.item1":
        "We use a cookie to keep you logged in, and browser storage to save your settings.",
    "privacy.cookies.item2":
        "To understand usage, we use Google Analytics, provided by Google LLC in the United States, on all pages.",
    "privacy.cookies.item3":
        "Google Analytics uses cookies and sends the pages you view and your device and browser information to Google.",
    "privacy.cookies.item4":
        "Google handles this information under its privacy policy (https://policies.google.com/privacy).",
    "privacy.cookies.item5":
        "You can stop analytics with your browser's cookie settings or the opt-out browser add-on provided by Google.",
    "privacy.rights.title":
        "Article 8 (Requests for disclosure and other actions)",
    "privacy.rights.intro":
        "You may make the following requests regarding your personal information held by the Operator.",
    "privacy.rights.item1":
        "Notification of the purposes of use, and disclosure",
    "privacy.rights.item2": "Correction, addition, or deletion",
    "privacy.rights.item3":
        "Suspension of use, erasure, and suspension of provision to third parties",
    "privacy.rights.procedure1":
        "Requests are accepted at the contact in Article 1.",
    "privacy.rights.procedure2":
        "We confirm your identity by a message from the Bluesky account concerned.",
    "privacy.rights.procedure3":
        "No fee is charged. Disclosure is made by email.",
    "privacy.rights.procedure4":
        "We respond to requests without delay in accordance with the law.",
    "privacy.rights.self1":
        'You can change or cancel scheduled posts and delete their history from “Drafts & scheduled” in the post form. Turning off scheduled posts in Settings immediately deletes the login information and pending scheduled posts.',
    "privacy.rights.self2":
        "Settings saved on your device can be deleted yourself from your browser settings.",
    "privacy.revision.title": "Article 9 (Revision)",
    "privacy.revision.body":
        "We may revise this policy when laws change or features are added. A revision takes effect when it is posted on this page.",
    "privacy.revision.dates":
        "Enacted: {enactedAt} / Last revised: {revisedAt}",
    "privacy.link": "Privacy Policy",
} satisfies MessageEntries

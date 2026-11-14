/**
 * Privacy policy text (English). A courtesy translation: the Japanese text is authoritative.
 * `{enactedAt}`/`{revisedAt}` are filled from `lib/site/siteConfig.ts`.
 */
import type { MessageEntries } from "../../messageEntries"

export const privacy = {
    "privacy.heading": "Privacy Policy",
    "privacy.lead":
        'Skyshare (the "Service") is a web application that helps you post to Bluesky. This policy explains how the Service handles your information. This English text is a courtesy translation, and the Japanese text prevails.',
    "privacy.operator.title": "Operator and contact",
    "privacy.operator.name": "Operator",
    "privacy.operator.email": "Email",
    "privacy.operator.bluesky": "Bluesky",
    "privacy.collected.title": "Information we collect",
    "privacy.collected.intro": "The Service handles the following information.",
    "privacy.collected.login": "Credentials for your Bluesky account",
    "privacy.collected.schedule":
        "When scheduled posts are enabled: the post content, including attached images, and credentials for your Bluesky account",
    "privacy.collected.traffic":
        "Your IP address and browser information collected by the hosting provider",
    "privacy.collected.analytics": "Usage data collected by Google Analytics",
    "privacy.collected.inquiry":
        "Your email address or Bluesky account and the content of your inquiry when you contact us",
    "privacy.collected.feedback":
        "When you use the bug report and feature request form: the information you enter, account identification information, your device information, and information about the Service",
    "privacy.collected.survey":
        "When you answer a survey: your answers and an identifier used to prevent duplicate responses",
    "privacy.purpose.title": "How we use information",
    "privacy.purpose.intro":
        "We use the information only for the following purposes.",
    "privacy.purpose.item1":
        "Providing the features of the Service, such as posting to Bluesky",
    "privacy.purpose.item2": "Posting automatically at the scheduled time",
    "privacy.purpose.item3":
        "Understanding how the Service is used and improving it",
    "privacy.purpose.item4": "Investigating bugs and preventing misuse",
    "privacy.purpose.item5": "Answering your inquiries",
    "privacy.external.title": "Sharing of information",
    "privacy.external.intro":
        "We do not share your information with third parties except in the following cases.",
    "privacy.external.item1":
        "Posting to Bluesky or sharing to other social networks on your instruction",
    "privacy.external.item2":
        "Handling by the hosting provider, which we use to deliver the Service and store its data",
    "privacy.external.item3": "Sending data to Google for analytics",
    "privacy.external.github": "Publishing bug reports or feature requests",
    "privacy.external.item4": "When required by law",
    "privacy.external.surveyResults": "Publication of survey results",
    "privacy.retention.title": "Data retention",
    "privacy.retention.item1":
        "Login information is kept in your browser for 7 days and deleted when you log out.",
    "privacy.retention.item2":
        "Scheduled posts and their images are deleted when the post succeeds or is canceled. Failed posts are deleted after 7 days, and leftover images within 15 days.",
    "privacy.retention.item3":
        "When scheduled posts are enabled, credentials are deleted if they become invalid or the feature goes unused for 30 days.",
    "privacy.retention.item4":
        "Traffic information is kept only for the period set by the hosting provider.",
    "privacy.retention.item5":
        "Analytics data is kept according to the Google Analytics retention setting.",
    "privacy.retention.feedback":
        "Bug reports and feature requests remain as GitHub issues. Contact us if you want one deleted.",
    "privacy.retention.surveyAnswer":
        "Survey answers are deleted as soon as the survey has closed and its aggregated result has been saved.",
    "privacy.security.title": "Security",
    "privacy.security.intro":
        "We take the following measures to protect your information.",
    "privacy.security.item1": "Communication is encrypted.",
    "privacy.security.item2":
        "Credentials for scheduled posts are stored encrypted.",
    "privacy.security.item3": "Only the Operator handles the information.",
    "privacy.cookies.title": "Cookies and analytics",
    "privacy.cookies.titleBasic": "Cookies",
    "privacy.cookies.item1":
        "We use a cookie to keep you logged in, and browser storage to save your settings.",
    "privacy.cookies.item2":
        "We use Google Analytics by Google LLC to analyze usage. It uses cookies and sends the pages you view and your device information to Google.",
    "privacy.cookies.item3":
        "For how Google handles this information, see Google's privacy policy (https://policies.google.com/privacy).",
    "privacy.cookies.item4":
        "You can stop analytics with your browser's cookie settings or Google's opt-out browser add-on.",
    "privacy.rights.title": "Your rights",
    "privacy.rights.intro":
        "You may ask us to disclose, correct, or delete your information. Please use the contact details above.",
    "privacy.rights.self":
        "You can change, cancel, or delete scheduled posts from “Drafts & scheduled” in the post form. If you turn off scheduled posts, the scheduled post contents and credentials for your Bluesky account are deleted.",
    "privacy.rights.survey":
        "You cannot withdraw survey answers after submitting them.",
    "privacy.revision.title": "Changes to this policy",
    "privacy.revision.body":
        "We may change this policy as needed. Changes apply from when they are posted on this page.",
    "privacy.revision.dates":
        "Enacted: {enactedAt} / Last revised: {revisedAt}",
    "privacy.link": "Privacy Policy",
} satisfies MessageEntries

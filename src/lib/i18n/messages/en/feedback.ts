/** 不具合の報告・新機能の提案のフォームの文言（英語）。キー集合は日本語辞書と一致させる。 */
import type { MessageEntries } from "../../translate"

export const feedback = {
    "feedback.heading": "Report a bug / Request a feature",
    "feedback.lead":
        "Send us bug reports and ideas for new features in Skyshare.",
    "feedback.loginRequired":
        "Please log in with your Bluesky account to send a report.",
    "feedback.loginLink": "Log in",
    "feedback.kind.label": "Type",
    "feedback.kind.bug": "Bug report",
    "feedback.kind.enhancement": "Feature request",
    "feedback.title.bug": "Describe the bug briefly",
    "feedback.title.enhancement": "Describe the feature briefly",
    "feedback.counter": "chars",
    "feedback.steps.label": "What did you do?",
    "feedback.steps.placeholder":
        "Which screen, what you did, and what happened.",
    "feedback.reproducibility.label": "Does it happen again if you retry?",
    "feedback.reproducibility.always": "Every time",
    "feedback.reproducibility.sometimes": "Sometimes",
    "feedback.reproducibility.no": "No",
    "feedback.reproducibility.untested": "Not tried",
    "feedback.description.label": "What feature would you like?",
    "feedback.description.placeholder":
        "The feature you want and what it would let you do.",
    "feedback.technicalNotes.label": "Technical notes (optional)",
    "feedback.technicalNotes.placeholder":
        "Implementation ideas or useful references, if any.",
    "feedback.notice.title": "Before you send",
    "feedback.notice.body":
        "In addition to what you enter, your Bluesky handle and the environment information below are collected automatically and shared with the developers.",
    "feedback.notice.public":
        "They are published as a public GitHub issue that anyone can read. Do not include personal information or passwords.",
    "feedback.collected.account": "Bluesky",
    "feedback.collected.version": "Skyshare version",
    "feedback.collected.commit": "Commit",
    "feedback.collected.os": "OS",
    "feedback.collected.browser": "Browser",
    "feedback.collected.standalone": "Launched from home screen (PWA)",
    "feedback.collected.userAgent": "User agent",
    "feedback.collected.yes": "Yes",
    "feedback.collected.no": "No",
    "feedback.submit": "Send",
    "feedback.submitting": "Sending...",
    "feedback.success": "Sent. Thank you for your help.",
    "feedback.successLink": "View the created issue (#{number})",
    "feedback.error.rateLimited":
        "You cannot send again so soon. Please wait about a minute and try again.",
    "feedback.error.unavailable":
        "Reports are not being accepted right now. Please try again later.",
    "feedback.back": "Back to settings",
} satisfies MessageEntries

/**
 * Run mutation analysis on high-priority unit modules and report surviving mutants.
 * No mutation score gate is enforced (`break: null`); run locally or on a schedule.
 */
export default {
  testRunner: "vitest",
  vitest: { configFile: "config/test/vitest.unit.config.ts" },
  mutate: [
    "src/lib/session/cookies/codec.ts",
    "src/lib/session/cookies/model.ts",
    "src/lib/session/cookies/pool.ts",
    "src/lib/session/cookies/headers.ts",
    "src/lib/schedule/credentialCrypto.ts",
    "src/lib/survey/respondentHash.ts",
    "src/lib/entry/createBskyThread.ts",
    "src/lib/entry/resolveEntryDeleteScope.ts",
    "src/lib/entry/resolveDeleteTargets.ts",
    "src/lib/feedback/issueContent.ts",
    "src/lib/feedback/githubIssue.ts",
    "src/lib/i18n/locale.ts",
    "src/lib/share/shareBody.ts",
    "src/lib/share/counterReserve.ts",
  ],
  coverageAnalysis: "perTest",
  reporters: ["clear-text", "progress"],
  thresholds: { high: 80, low: 60, break: null },
  tempDirName: ".cache/stryker-tmp",
  // 作業ツリーの複製から、エージェントの設定や生成物などを外す（複製が失敗するため）
  ignorePatterns: [
    ".agents",
    ".claude",
    ".kiro",
    ".git",
    ".wrangler",
    ".astro",
    "dist",
    "node_modules",
    "_legacy",
    "_tests",
    "hack",
  ],
}

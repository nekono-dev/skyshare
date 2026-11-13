# Delegating to sub-agents (implement / review / debug)

Quick reference for running the "hand it to a sub-agent" steps of `/kiro-impl`, `kiro-review` and `kiro-debug` in this repository without hesitation. The rules themselves live in `CLAUDE.md` ("Codex as a Child Agent (MCP)", items 9 and 11); this file holds only the execution details. Think in English; replies to the user and Markdown content written to the project stay in Japanese.

## 1. Who does what, and which model / effort

| Work                                   | Codex usable                                                                                                                 | Codex not usable (Claude agent)                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Implement / fix                        | `codex_exec`, `sandbox: "workspace-write"` (Luna, effort medium). `effort: "high"` only for design-heavy or cross-file tasks | `impl-implementer-haiku` (Haiku, high)                                       |
| Review / investigate                   | `codex_exec`, `sandbox: "read-only"` (Sol, medium fixed; `effort` is rejected). Returns `Review Verdict`                     | `impl-reviewer-sonnet` (Sonnet, medium, read-only). Returns `Review Verdict` |
| Debug (`kiro-debug`)                   | `codex_exec`, `sandbox: "read-only"` (Sol). Returns `Debug Report`                                                           | `impl-debugger-sonnet` (Sonnet, medium, read-only). Returns `Debug Report`   |
| Design (requirements / design / tasks) | CLAUDE.md item 10                                                                                                            | `spec-designer-sonnet`, `spec-designer-haiku`, `design-reviewer`             |

- Model and effort are decided by `sandbox` (and `effort`), not by the prompt (`MODEL_BY_SANDBOX` in `scripts/agent/codex-exec-request.mjs`). Asking for another model in the prompt has no effect.
- A Claude agent's definition (`.claude/agents/*.md`) fixes its model and effort. Do not pass `model` when calling it (the same alias as the definition is allowed).
- A review is always a fresh call, never the call that wrote the code.

## 2. Before the first call

1. `codex_exec` is a deferred tool: only its name is listed. Load it with `ToolSearch` (`select:mcp__codex__codex_exec`) first; calling it unloaded fails input validation.
2. Check `which codex`. If MCP fails, send the same request through the CLI (CLAUDE.md item 6).
3. Build the prompt from `.claude/skills/kiro-impl/templates/*.md` and add what is missing using sections 4 and 5 below. Codex does not read `CLAUDE.md`.

## 3. Verification split (some commands cannot run in the Codex sandbox)

In the Codex sandbox, listening on localhost and `tsx` inter-process sockets fail with `EPERM`.

- **Codex may run**: `npm run test:type`, and targeted `npx vitest run -c <config> <file>` (unit, component). If it is unclear whether the route layer (workerd) runs, try it before the call or run it yourself.
- **The conductor (Claude) always runs itself**: the whole `npm run test:unit`, `npm run test:imports`, `npm run test:route`, `npx prettier --check <changed files>`. Treat Codex's report as unverified; only results you ran count (CLAUDE.md item 8).
- When a reviewer needs to run tests, pass `scratch: true`. If tests are slow or need workerd or the network, run them first and put the command and result in the prompt.

## 4. Implementer prompt skeleton (`workspace-write`)

Always include: absolute paths; spec, task number, requirement numbers and design sections; Boundary; completion state; verification commands (following section 3); task kind (behavioral, or non-behavioral such as types or config); and these rules.

- No git commit, push or branch operations. Do not edit `tasks.md` or `spec.json`. Do not change anything outside the Boundary.
- Comments are in Japanese. **Put a `/** … */` purpose block (≤ 6 lines) at the top of every module** (`.ts`, `.tsx`, `.astro`, `.mjs`; tests included; generated files, `*.d.ts` and fixtures excluded; the exact scope is defined in `.kiro/steering/comments.md`, which Codex may read). Not `//` line comments. No history, requirement numbers or work records in comments.
- Leave no TBD, TODO or FIXME. Do not stop at a mock or placeholder.
- Write the test first and make it fail (RED), then implement (GREEN). Put the failing output in the report.
- End the reply with exactly one `## Status Report` block (same fields as `templates/implementer-prompt.md`; `- STATUS:` is `READY_FOR_REVIEW | BLOCKED | NEEDS_CONTEXT`).
- If a verification command cannot run because of the sandbox, say so and include the output in `TESTS_RUN`; never claim it passed.

## 5. Reviewer prompt skeleton (`read-only`)

- First have it read `.claude/skills/kiro-review/SKILL.md` and follow its checklist, severity rules and output format.
- Have it read the actual `git diff` and `git status` (untracked files included) itself; the implementer's report is context only.
- Pass the task, the requirement and design sections, the Boundary, the completion state, and `.kiro/steering/comments.md` (e.g. the top-block rule).
- Pass the verification results you ran (command and result); do not ask it to rerun what cannot run.
- Reply is exactly one `## Review Verdict` block with `- VERDICT: APPROVED | REJECTED`; a rejection needs an actionable fix. No taste or guesses.
- Pass the implementer's `Status Report` fields (especially `RED_PHASE_OUTPUT`); a behavioral task without RED evidence is rejected by `kiro-review`. If the implementer's RED output is thin, reproduce RED yourself (stash the source change, run the test) and put that in the prompt.
- The review sandbox denies reading `.env*` and `.dev.vars*`, so tracked files such as `_legacy/**/.env.template` or `config/.dev.vars.template` can look modified in its `git status`. Tell the reviewer this is a sandbox artifact and give your own `git status --porcelain`.
- Have it audit the Boundary: changes belonging to another task must not be mixed in.

## 6. What the conductor does

- Read a reply block only by its defined heading and the `- STATUS:` / `- VERDICT:` / `- NEXT_ACTION:` line. If a `Status Report` or `Review Verdict` is missing, ask once for that block only. If the debug protocol or a valid `Debug Report` is missing, do not guess or dispatch another implementer: stop the feature and report the missing input (`kiro-impl` SKILL.md).
- Before marking a task done, follow `kiro-verify-completion` and take fresh evidence yourself: rerun every verification command named in the prompt (including those Codex could not run), plus type check, the whole unit run, the import check and prettier. If the task names build or smoke checks, include them.
- Only the conductor commits, staging explicit files plus `tasks.md` (never `-A` or `.`).
- In the final report, list who did each piece (Codex, CLI fallback, Claude agent), what the conductor did directly and why, and what is still unverified.

# Agentic SDLC and Spec-Driven Development

Kiro-style Spec-Driven Development on an agentic SDLC

## Session Initialization Rules

- This file (CLAUDE.md) is not overwritten by the cc-sdd installation (`scripts/agent/install-cc-sdd.sh`). Project rules are managed by editing this file directly.
- The cc-sdd installed files (`.claude/skills/kiro-*/`, `.kiro/settings/`) are in `.gitignore` and are not committed. The SessionStart installation runs at every start (including `resume`, `clear`, and `compact`) and reinstalls the pinned version.
- Skills with `disable-model-invocation: true` (`kiro-discovery`, `kiro-impl`) are not listed in the model's skill list; only the user can call them with `/kiro-*`. The skill list is built when the session starts, so other skills may also be missing right after installation. Read `.claude/skills/<name>/SKILL.md` for the request and carry out its steps to the end (do not switch to other work in the middle). If the steps say "present a recommendation and stop", stop there and return to the user.
- If a SKILL.md cannot be found, tell the user that the installation is not complete and suggest running `scripts/agent/install-cc-sdd.sh --claude`.
- A session started with a `/kiro-*` slash command is forced by the hook (`scripts/agent/kiro-gate.mjs`) to Read the procedure file first. Until it is read, no other tool can be used, and the end of the turn is blocked when a new roadmap spec has no brief.md. Natural-language requests are not subject to this enforcement; judge them by following the steps in this file.

## Working Agreements (Basis for Judgment)

- Spec-Driven Development is a mechanism for consistency and clarity; it does not prohibit work outside a spec. As a spec rule, enforce only "what the spec describes exists" (spec → implementation). Do not enforce "all code appears in a spec" (implementation → spec).
- Because v2 is not yet released, prefer consistent naming and design over minimal diffs or backward-compatible wrappers. However, do not break the signatures of functions and types used by others in externally published APIs (confirm changes that affect callers).
- Commit and push to a work branch without asking for permission. Do not clean up worktrees at push time; clean them up with `brw finish` after merging into develop (or after creating a PR to main).
- For work spanning multiple specs, write the discovery outputs first (`.kiro/steering/roadmap.md` and a `brief.md` for each new spec). Do not leave the split only in conversation or in records. Do not imitate the old format of existing specs (such as tasks that name old IDs or function names); create them under the cc-sdd rules.
- D1 migrations: outside `release/**` branches, `migrations/` holds only `0001_initial.sql`. `develop` and `main` must always build from the initial state, with no operational upgrade path in mind. To change the schema, edit `0001_initial.sql` directly and recreate the `develop` D1 (the user does the recreate; the deploy applies `0001` to the empty database). Add `0002` and later only on a `release/**` branch, and never carry them into `develop` or `main`. Enforced by `scripts/git/check-migrations.mjs` (`npm run test:migrations`, run by the pre-commit hook, `test:all` and the `e2e` CI workflow) and by the PreToolUse hook `scripts/agent/migration-gate.mjs`, which denies creating or writing `0002`+ outside a release branch. Do not work around the hook (for example by building the path in a shell variable): the git hook and CI still reject it.
- Record decisions in `.kiro/` (feature briefs, steering, roadmap). Use `docs/` only for human-readable prose (such as DEVELOP.md); do not put decisions or rules for AI there. Do not use AI work records (auto-memory); keep everything in the repository.

## Project Context

### Paths
- Steering: `.kiro/steering/`
- Specs: `.kiro/specs/`

### Steering vs Specification

**Steering** (`.kiro/steering/`) - Guide AI with project-wide rules and context
**Specs** (`.kiro/specs/`) - Formalize development process for individual features

### Active Specifications
- Check `.kiro/specs/` for active specifications
- Use `/kiro-spec-status [feature-name]` to check progress

## Development Guidelines
- Think in English, generate responses in Japanese. All Markdown content written to project files (e.g., requirements.md, design.md, tasks.md, research.md, validation reports) MUST be written in the target language configured for this specification (see spec.json.language).

## Minimal Workflow
- Phase 0 (optional): `/kiro-steering`, `/kiro-steering-custom`
- Discovery: `/kiro-discovery "idea"` — determines action path, writes brief.md + roadmap.md for multi-spec projects
- Phase 1 (Specification):
  - Single spec: `/kiro-spec-quick {feature} [--auto]` or step by step:
    - `/kiro-spec-init "description"`
    - `/kiro-spec-requirements {feature}`
    - `/kiro-validate-gap {feature}` (optional: for existing codebase)
    - `/kiro-spec-design {feature} [-y]`
    - `/kiro-validate-design {feature}` (optional: design review)
    - `/kiro-spec-tasks {feature} [-y]`
  - Multi-spec: `/kiro-spec-batch` — creates all specs from roadmap.md in parallel by dependency wave
- Phase 2 (Implementation): `/kiro-impl {feature} [tasks] [--review required|inline|off]`
  - Without task numbers: autonomous mode (subagent per task + independent review + final validation)
  - With task numbers: manual mode (selected tasks in main context, still reviewer-gated before completion)
  - `--review off` skips task-local review; use it intentionally and keep `/kiro-validate-impl {feature}` as the final quality gate
  - `/kiro-validate-impl {feature}` (standalone re-validation)
- Progress check: `/kiro-spec-status {feature}` (use anytime)

## Skills Structure
Skills are located in `.claude/skills/kiro-*/SKILL.md`
- Each skill is a directory with a `SKILL.md` file
- Skills run inline with access to conversation context
- Skills may delegate parallel research to subagents for efficiency
- Additional files (templates, examples) can be added to skill directories
- `kiro-review` — task-local adversarial review protocol used by reviewer subagents
- `kiro-debug` — root-cause-first debug protocol used by debugger subagents
- `kiro-verify-completion` — fresh-evidence gate before success or completion claims
- Use skills explicitly requested by the user and skills relevant to the task's domain, including design, accessibility, and UX.
- Select skills from their descriptions or metadata first, then read only the selected skills and the references needed for the task.
- Follow explicit host and project rules and retain required workflow checks. Do not skip relevant skills just because the task is small.

## Development Rules
- 3-phase approval workflow: Requirements → Design → Tasks → Implementation
- Human review required each phase; use `-y` only for intentional fast-track
- Keep steering current and verify alignment with `/kiro-spec-status`
- Follow the user's instructions precisely, and within that scope act autonomously: gather the necessary context and complete the requested work end-to-end in this run, asking questions only when essential information is missing or the instructions are critically ambiguous.

## Steering Configuration
- For spec and implementation work, load the core steering files below from `.kiro/steering/`. Reuse current context rather than rereading unchanged files.
- Load additional steering only when required by project rules or relevant to the task.
- Default files: `product.md`, `tech.md`, `structure.md`
- Custom files are supported (managed via `/kiro-steering-custom`)

## Codex as a Child Agent (MCP)

Codex is available to Claude as the MCP tool `codex_exec`. Before starting any thinking-heavy work, check the tool list for `codex_exec`. If `codex_exec` is not in the tool list, find the cause as described in item 6 and fall back to the CLI as item 6 allows. Only when Codex cannot be used at all, follow item 9.

1. **Delegate thinking-heavy work.** Delegate to `codex_exec` any work that needs deep thinking, except the work in the do-not-delegate list below. This is not limited to review. It includes design, analysis, requirements review, new implementation and fixes, root-cause debugging, independent review, and broad exploration.
   Do not delegate the following work to Codex, even when it is thinking-heavy:
   - decisions or approvals that the user must make;
   - destructive operations (reset, forced deletion, deleting a login or a volume);
   - operations that act on external systems;
   - work that handles secrets or credentials.
   Destructive operations and operations that act on external systems are not delegated and are not done without explicit approval from the user; ask the user first, and do them yourself only after the user approves them.
2. **Delegate proactively.** Delegate before doing the work directly. After delegating, focus on writing instructions, verifying results, reporting, changing approval state, and asking the user questions. Wait for the response instead of redoing the delegated work yourself. While waiting, a client-side call time limit is not a reason to stop work; the server limits are 10 minutes for execution and 2 minutes for waiting in the queue.
3. **Do not self-review.** Never present your own review of a spec or an implementation as an independent review. Independent review is done by `codex_exec`, and its findings are the input for the next step.
4. **Order the calls.**
   - Read-only calls (`sandbox` set to `read-only`) that do not depend on each other must be sent in the same turn, so that they run in parallel.
   - Write calls (`sandbox` set to `workspace-write`) are sent one at a time. They never overlap with reads or with other write calls.
   - A call is complete when its result (success or error) comes back. Wait for it before starting the next call.
   - Do not instruct a read call while a write call is running. If a read call covers a directory that other work is changing, the prompt must include a warning about it.
   - The CLI fallback in item 6 follows the same order and runs in the foreground.
   - **Models and effort are chosen by `sandbox`, in `scripts/agent/codex-exec-request.mjs` (`MODEL_BY_SANDBOX`), not in the prompt.** `read-only` (independent review, investigation, analysis) runs Sol (`gpt-6.1-sol`) at medium effort. `workspace-write` (implementation, fixes) runs Luna (`gpt-6-luna`) at medium effort by default; pass `effort: "high"` only for work that needs it (for example a design-heavy or cross-file change). `effort` is rejected on `read-only`. Do not change the model in `~/.codex/config.toml` to steer a single call.
5. **Report delegation and direct work.** Describe each delegation and its purpose in the final report. If you skip delegation for thinking-heavy work, state the reason in the final report. Work directly without delegation in these cases:
   - mechanical fixes of one to a few lines (typos, configuration value changes);
   - decisions that wait for the user;
   - changes to the `spec.json` approval flag;
   - destructive operations and operations that act on external systems, only after the user has explicitly approved them (see item 1);
   - git operations;
   - handling of secrets;
   - when Codex cannot be used (items 6 and 9).
   State the reason for each piece of direct work in the final report.
6. **Fall back when MCP fails.**
   - If a `codex_exec` call returns an error and the `codex` executable works, run the same request through the CLI with the same `sandbox` value:
     `codex -a never exec --sandbox <same value> --model <gpt-6.1-sol for read-only, gpt-6-luna for workspace-write> --config 'model_reasoning_effort="<medium or high>"' --cd <repo root> - < <prompt file>`
     Put `-a never` before `exec`. Use the same model and effort that the MCP tool would have used (item 4).
   - Write the prompt file in the session scratchpad, never in `/tmp`.
   - If the call failed because the wait limit was reached, first wait for the preceding write call to finish, then run the CLI fallback.
   - If `codex_exec` is unavailable and the cause is a plan limit (a usage or billing limit in the response), do not delegate. Do the work directly and state the reason in the final report. Codex is then treated as not usable for this work (item 9).
   - If a `codex_exec` call returns a plan-limit error while the `codex` executable exists, follow the CLI rule above. If the CLI result is also a plan limit, do the work directly and state the reason in the final report.
   - If `codex_exec` is unavailable and the cause is not a plan limit, or the cause is unclear, try the CLI and follow its result.
   - If neither the MCP tool nor the CLI works, do the work directly and state the reason in the final report.
   - Always state in the final report that the CLI fallback was used.
7. **Write prompts that Codex can use alone.**
   - Make each prompt self-contained. Include the goal, the absolute repository paths of the target files, the requirement, design, and task numbers, the constraints (boundary and language rules), and the output format.
   - Do not paste the whole conversation. Include only the parts that Codex needs.
   - Name the directories Codex may read; for a request that may write, also name the directories it may write.
   - For implementation, include the test command and the completion criteria.
   - Set `sandbox` per call according to the request: `read-only` when no files should change, `workspace-write` when files should change. Do not fix the sandbox to read-only.
   - Codex does not read `AGENTS.md`. Copy only the needed project rules from this file into the prompt.
   - Never include tokens, passwords, or account identifiers.
   - State in the prompt that Codex must not run git commit, push, or branch operations, and must not change the approval state in `spec.json`.
8. **Verify the results.**
   - Treat Codex output as unverified until you check it.
   - Before claiming completion, run `git diff` to check the changes, and run the tests named in the prompt.
   - If you find a defect, state the specific defect, then either call `codex_exec` again with the defect or fix it yourself.
   - The final report lists what Codex did, what Claude verified, and what is still unverified.
   - Follow `kiro-verify-completion` before any success or completion claim.
9. **Work without Codex.** Codex is not usable only when the `codex` executable is absent (check with `which codex`; do not assume it from the kind of environment, because cloud sessions may have it), or when item 6 decides not to delegate because of a plan limit, or when both `codex_exec` and the CLI fallback are unusable. Where Codex is not usable, do not stop: complete the work alone. Otherwise the delegation duty in items 1 and 2 applies. If the `codex` MCP server fails to start (for example, when `sh` or `git` is missing), continue the work without `codex_exec`.
   When the work is delegated to Claude subagents instead (the Agent tool), choose the model by the kind of work, the same way as for Codex: independent review runs on `model: "sonnet"` (Sonnet 5.5); implementation and fixes run on `model: "haiku"`. Set `model` explicitly on every Agent call; do not rely on the default. Exception: for the agent types defined in `.claude/agents/` (item 10), the definition fixes both model and reasoning effort; the Agent tool cannot set effort, and a `model` passed on the call overrides the definition, so pass no `model` (or exactly the alias written in the definition). Investigation and debugging that only reads files follows the review rule. Subagent review is still independent only when it is a fresh agent that did not write the code under review.
10. **Design work (spec requirements, design, tasks).** Drafting and reviewing are separate steps done by different agents.
    - **With Codex** (items 1–6): draft through `codex_exec` with `sandbox: "read-only"` (Sol; effort is fixed at medium for read-only). Ask for concrete edit blocks (file, a quoted anchor from the original text, the new text) instead of free prose. Apply them with a separate `workspace-write` call (Luna) that follows the blocks mechanically and does not redesign; give the applier the boundary (which directory it may edit, `spec.json` approvals untouched, no git operations) and the check to run (requirement IDs in both directions, `npx prettier --check`).
    - **Without Codex** (the conditions of item 9): draft with the project agent `spec-designer-sonnet` (Sonnet, effort medium) for new designs and for designs that span several specs, or `spec-designer-haiku` (Haiku, effort high) for fixing one spec from explicit findings and decisions. Haiku stops and reports when a decision is missing instead of guessing.
    - **Review** of any design: the project agent `design-reviewer` (Sonnet, effort medium, read-only), a fresh agent that did not write the design. Fix the findings through the drafting path above and review again, at most 3 rounds; a finding that needs a user decision is asked, not decided by an agent.
    - The agent definitions are `.claude/agents/spec-designer-sonnet.md`, `spec-designer-haiku.md` and `design-reviewer.md`. Reasoning effort can only be set in these definitions (the Agent tool has no effort parameter), so use these agent types for design work instead of `general-purpose`. Report in the final result which path (Codex or Claude agents) drafted, applied and reviewed each design.
11. **Dispatch in cc-sdd skills (`kiro-impl`, `kiro-review`, `kiro-debug`).** These skills say "dispatch via the Agent tool as a fresh subagent". The skill files are reinstalled at every session start and are not edited, so this item overrides that dispatch mechanism: when Codex is usable (item 9), read the skill's template and protocol the same way, but send the prompt to Codex instead of the Agent tool. The skill's other rules (one task per iteration, strict `Status Report` / `Review Verdict` / `Debug Report` parsing, review round limits, parent-only commits with explicit file staging) stay unchanged.
    - **Implementer** (`templates/implementer-prompt.md`): `codex_exec` with `sandbox: "workspace-write"` (Luna, effort medium; `high` only for design-heavy or cross-file tasks). Codex does not read `CLAUDE.md`: put the needed project rules (comment language, no git operations, no `tasks.md` or `spec.json` edits) in the prompt, and tell it to return the exact `## Status Report` block.
    - **Reviewer** (`templates/reviewer-prompt.md` with `kiro-review`) and **debugger** (`templates/debugger-prompt.md` with `kiro-debug`): `codex_exec` with `sandbox: "read-only"` (Sol). A plain read-only run cannot create the temporary files that vitest needs. Pass `scratch: true` when the reviewer must run the tests (it adds a per-call temporary directory and the vitest cache directory as the only writable places; the repository stays read-only). When the tests are slow, or need workerd or the network, run them yourself first and put the command and its result in the prompt; the reviewer then checks the diff against the spec and does not rerun them. A rejection whose only reason is "tests could not be run" is not a valid rejection: rerun the review with `scratch: true` or with your evidence.
    - **Permissions are chosen by the conductor on every call.** `sandbox` decides whether the repository is read-only or writable (a write call can write the whole repository, except `.git`). `network` (default `false`) allows external network. `scratch` (default `false`) adds the temporary writable places above. `read_paths` (read-only calls only) limits what can be read to the listed repository paths; `deny_read` adds glob patterns that cannot be read. Always denied, whatever the call says: `.dev.vars` and `.env` files in the repository, the credentials in the home directory (`~/.ssh`, `~/.aws`, `~/.config/gh`, `~/.git-credentials`, `~/.codex/auth.json`), and writes to `.git`. Keep the defaults and open only what the task needs: review and investigation use `read-only` without `network`; implementation uses `workspace-write`; give a reviewer `read_paths` when the diff touches a narrow area and the rest of the repository is not needed.
    - Send write calls one at a time and never while a read call is running (item 4). The reviewer must be a fresh call that did not write the code under review.
    - On a `codex_exec` error, follow item 6 (CLI fallback with the same sandbox), then item 9.
    - Report in the final result, for each task, which of Codex, the CLI fallback or a Claude subagent implemented and reviewed it.
    - **Quick reference: `.kiro/steering/delegation.md`.** Read it before the first dispatch in a session. It has the model/effort table, the prompt skeletons for implementer and reviewer, and the split of verification (what Codex runs, what the conductor must run itself because the Codex sandbox cannot run `npm run test:unit` as a whole, `test:imports` or `test:route`). `codex_exec` is a deferred tool: load it with `ToolSearch` (`select:mcp__codex__codex_exec`) before the first call.
    - When Codex is not usable, use the project agents `impl-implementer-haiku` (implementation, Haiku, effort high), `impl-reviewer-sonnet` (review, Sonnet, effort medium), and `impl-debugger-sonnet` (debug, Sonnet, effort medium) from `.claude/agents/`; do not pass `model` (item 9).

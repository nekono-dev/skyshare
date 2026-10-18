#!/usr/bin/env node
// branch-release-workflow の CLI。サブコマンド:
//   hook                       PreToolUse フック（標準入力の JSON を判定して deny/ask を返す）
//   create <名前> [--base b] [--branch-only]   作業ブランチ（と worktree）を命名規則に従って作成
//   url [ブランチ]             プレビューURLを表示
//   check                      宣言・workflow・provider 設定の整合検査
//   gen-workflow [--write]     provider の preview workflow 雛形を出力（--write で .github/workflows/preview.yaml へ）
//   cleanup <ブランチ> [--execute]  provider 固有の後始末（既定は表示のみ）
//   wrangler-config [ファイル] [--write]  独自ドメインの有効状況に応じて wrangler 設定の workers_dev / preview_urls を設定
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONFIG_REL, checkName, currentBranch, git, globToRegExp, judgeBranch, loadConfig, matchesAny, repoRoot,
  scanWorkflows, shortRef, undeclaredCiBranches, aliasOf,
} from "./lib.mjs";
import { getProvider, previewUrl } from "../providers/index.mjs";
import { applyWorkersDev } from "../providers/cloudflare-previews.mjs";

// ---- フック用: シェルコマンドから git commit / push を抽出 --------------------------

function tokenize(seg) {
  const toks = [];
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(seg))) toks.push(m[1] ?? m[2] ?? m[3]);
  return toks;
}

// コマンド文字列を解析し、{ kind: "commit"|"push", cwd, args }[] を返す
export function extractGitOps(command, cwd) {
  const ops = [];
  let cur = cwd;
  for (const seg of command.split(/&&|\|\||;|\||\n/)) {
    const t = tokenize(seg.trim());
    if (t[0] === "cd" && t[1]) {
      cur = join(cur, t[1].replace(/^~$/, process.env.HOME ?? "~"));
      if (t[1].startsWith("/")) cur = t[1];
      continue;
    }
    const gi = t.indexOf("git");
    if (gi < 0 || !t.slice(0, gi).every((x) => /^\w+=/.test(x))) continue; // 前置は環境変数代入のみ許容
    let dir = cur;
    let i = gi + 1;
    while (i < t.length && t[i].startsWith("-")) {
      if (t[i] === "-C" && t[i + 1]) {
        dir = t[i + 1].startsWith("/") ? t[i + 1] : join(dir, t[i + 1]);
        i += 2;
      } else if (t[i] === "-c") i += 2;
      else i += 1;
    }
    if (t[i] === "commit" || t[i] === "push") ops.push({ kind: t[i], cwd: dir, args: t.slice(i + 1) });
  }
  return ops;
}

// push の対象ブランチ一覧。null は特定不能（--all / --mirror）
export function pushTargets(args, cwd) {
  if (args.some((a) => a === "--all" || a === "--mirror" || a === "--branches")) return null;
  const pos = args.filter((a) => !a.startsWith("-"));
  const refspecs = pos.slice(1); // 先頭はリモート名
  if (!refspecs.length) {
    const b = currentBranch(cwd);
    return b ? [b] : [];
  }
  const out = [];
  for (const r of refspecs) {
    if (r.startsWith("refs/tags/") || args.includes("--tags")) continue;
    const dst = r.includes(":") ? r.split(":")[1] : r;
    if (dst === "HEAD" || dst === "") {
      const b = currentBranch(cwd);
      if (b) out.push(b);
    } else out.push(shortRef(dst));
  }
  return out;
}

const rank = { allow: 0, ask: 1, deny: 2 };

export function judgeCommand(command, cwd) {
  const ops = extractGitOps(command, cwd);
  let worst = { decision: "allow", reason: "" };
  for (const op of ops) {
    const root = repoRoot(op.cwd);
    if (!root) continue;
    const { config, error } = loadConfig(root);
    let r;
    if (error) r = { decision: "ask", reason: error };
    else if (!config) r = { decision: "ask", reason: `宣言ファイル ${CONFIG_REL} がありません。作業ブランチ運用を確認してから進めてください（スキル branch-release-workflow を参照）。` };
    else if (op.kind === "commit") r = judgeBranch(config, currentBranch(op.cwd));
    else {
      const targets = pushTargets(op.args, op.cwd);
      if (targets === null) r = { decision: "ask", reason: "--all / --mirror は保護ブランチを含みうるため確認が必要です。" };
      else {
        r = { decision: "allow", reason: "" };
        for (const b of targets) {
          const j = judgeBranch(config, b);
          if (rank[j.decision] > rank[r.decision]) r = j;
        }
      }
    }
    if (rank[r.decision] > rank[worst.decision]) worst = r;
  }
  return worst;
}

async function hook() {
  let input = "";
  for await (const c of process.stdin) input += c;
  let ev;
  try {
    ev = JSON.parse(input);
  } catch {
    return; // 判定不能なときは何もしない
  }
  if (ev.tool_name !== "Bash" || !ev.tool_input?.command) return;
  const r = judgeCommand(ev.tool_input.command, ev.cwd ?? process.cwd());
  if (r.decision === "allow") return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: r.decision, permissionDecisionReason: `[branch-release-workflow] ${r.reason}` },
  }));
}

// ---- 各サブコマンド -------------------------------------------------------------

function need(root) {
  const { config, error } = loadConfig(root);
  if (error) fail(error);
  if (!config) fail(`宣言ファイル ${CONFIG_REL} がありません。templates/config.example.json を元に作成してください。`);
  return config;
}

function fail(msg, code = 1) {
  console.error(`エラー: ${msg}`);
  process.exit(code);
}

// 作業ブランチ名の接頭辞（workBranches の最初の "xxx/*" 形式）
function branchPrefix(config) {
  const g = config.workBranches.find((w) => /\/\*+$/.test(w));
  return g ? g.replace(/\*+$/, "") : null;
}

function create(args) {
  const root = repoRoot(process.cwd()) ?? fail("git リポジトリ内で実行してください。", 2);
  const config = need(root);
  let name, base = config.baseBranch, branchOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base") base = args[++i] ?? fail("--base に値が必要です。", 2);
    else if (args[i] === "--branch-only") branchOnly = true;
    else if (!name) name = args[i];
    else fail("引数が不正です。", 2);
  }
  if (!name) fail("使い方: create <名前> [--base <ブランチ>] [--branch-only]", 2);
  const prefix = branchPrefix(config);
  const branch = matchesAny(config.workBranches, name) ? name : prefix ? prefix + name : fail(`workBranches（${config.workBranches.join(", ")}）に新規作成できるパターン（xxx/*）がありません。`);
  if (matchesAny(config.protectedBranches ?? [], branch)) fail(`'${branch}' は保護ブランチです。`);
  const bad = checkName(config, branch);
  if (bad) fail(`${bad}\n  namePattern: ${config.namePattern ?? "(なし)"} / 最大 ${config.maxNameLength} 文字`);
  if (git(root, "show-ref", "--verify", "--quiet", `refs/heads/${branch}`) !== null || git(root, "show-ref", "--verify", "--quiet", `refs/remotes/origin/${branch}`) !== null)
    fail(`ブランチ ${branch} は既に存在します。`);
  if (git(root, "fetch", "origin", base, "--quiet") === null) console.error(`警告: origin/${base} を取得できませんでした。ローカルの ${base} を使います。`);
  const start = git(root, "show-ref", "--verify", "--quiet", `refs/remotes/origin/${base}`) !== null ? `origin/${base}`
    : git(root, "show-ref", "--verify", "--quiet", `refs/heads/${base}`) !== null ? base : fail(`分岐元ブランチ ${base} が見つかりません。`);
  if (branchOnly) {
    execFileSync("git", ["branch", "--no-track", branch, start], { cwd: root, stdio: "inherit" });
    console.log(`ブランチを作成しました: ${branch}（分岐元: ${start}）`);
  } else {
    const wt = join(root, ".claude/worktrees", aliasOf(branch));
    mkdirSync(join(root, ".claude/worktrees"), { recursive: true });
    execFileSync("git", ["worktree", "add", "--no-track", "-b", branch, wt, start], { cwd: root, stdio: "inherit" });
    console.log(`ブランチと worktree を作成しました: ${branch}\n  worktree: ${wt}`);
  }
  const url = previewUrl(config, branch);
  if (url) console.log(`プレビューURL（push 後）: ${url}`);
}

function url(args) {
  const root = repoRoot(process.cwd()) ?? fail("git リポジトリ内で実行してください。", 2);
  const config = need(root);
  const branch = args[0] ?? currentBranch(root) ?? fail("ブランチを特定できません。", 2);
  if (config.preview.provider === "none") fail("宣言の preview が無効（provider: none）のため、プレビューURLはありません。");
  if (!matchesAny(config.workBranches, branch) || checkName(config, branch)) fail(`ブランチ '${branch}' は作業ブランチの命名規則に合わないため、プレビューは発行されません。`);
  console.log(previewUrl(config, branch));
}

function check() {
  const root = repoRoot(process.cwd()) ?? fail("git リポジトリ内で実行してください。", 2);
  const config = need(root);
  const findings = [];
  for (const f of undeclaredCiBranches(config, scanWorkflows(root)))
    findings.push({ level: "warn", message: `${f.file}: push 対象 '${f.glob}' が宣言の workBranches / protectedBranches に含まれません（意図しない CI/デプロイの可能性）。` });
  findings.push(...getProvider(config).check(root, config));
  for (const f of findings) console.log(`${f.level === "error" ? "ERROR" : "WARN "} ${f.message}`);
  console.log("\n注意: workflow が本番向けかどうか（wrangler deploy か preview か等）と、リポジトリ外の設定（Pages の本番ブランチ等）は機械判定できません。");
  if (findings.some((f) => f.level === "error")) process.exit(1);
  if (!findings.length) console.log("整合性の問題は見つかりませんでした。");
}

function genWorkflow(args) {
  const root = repoRoot(process.cwd()) ?? fail("git リポジトリ内で実行してください。", 2);
  const config = need(root);
  const text = getProvider(config).workflow(config);
  if (!text) fail(`provider '${config.preview.provider}' には workflow 雛形がありません。`);
  if (!args.includes("--write")) return process.stdout.write(text);
  const path = join(root, ".github/workflows/preview.yaml");
  if (existsSync(path)) fail(`${path} は既に存在します（上書きしません）。`);
  mkdirSync(join(root, ".github/workflows"), { recursive: true });
  writeFileSync(path, text);
  console.log(`作成しました: ${path}`);
}

function cleanup(args) {
  const root = repoRoot(process.cwd()) ?? fail("git リポジトリ内で実行してください。", 2);
  const config = need(root);
  const branch = args.find((a) => !a.startsWith("--")) ?? fail("使い方: cleanup <ブランチ> [--execute]", 2);
  const c = getProvider(config).cleanup(config, branch);
  if (!c) return console.log(`provider '${config.preview.provider}' には後始末がありません。`);
  console.log(`${c.cmd} ${c.args.join(" ")}`);
  if (!args.includes("--execute")) return console.log("（表示のみ。実行するには --execute）");
  process.exit(spawnSync(c.cmd, c.args, { cwd: root, stdio: "inherit" }).status ?? 1);
}

// 宣言ファイルや git リポジトリには依存しない（CI の設定生成でも使えるようにするため）
function wranglerConfig(args) {
  const file = args.find((a) => !a.startsWith("--")) ?? "wrangler.jsonc";
  if (!/\.jsonc?$/.test(file)) fail(`${file} は JSONC / JSON ではありません（toml は対象外です）。`);
  if (!existsSync(file)) fail(`${file} が見つかりません。`);
  let r;
  try {
    r = applyWorkersDev(readFileSync(file, "utf8"));
  } catch (e) {
    fail(`${file} を処理できません: ${e.message}`);
  }
  if (!args.includes("--write")) return process.stdout.write(r.text);
  writeFileSync(file, r.text);
  console.log(`${file}: 有効な独自ドメインが${r.active ? "あるため workers_dev / preview_urls を false にしました" : "ないため workers_dev / preview_urls を true にしました"}`);
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const [sub, ...rest] = process.argv.slice(2);
  const cmds = { hook, create, url, check, "gen-workflow": genWorkflow, cleanup, "wrangler-config": wranglerConfig };
  if (!cmds[sub]) fail(`サブコマンドは ${Object.keys(cmds).join(" / ")} のいずれかです。`, 2);
  await cmds[sub](rest);
}

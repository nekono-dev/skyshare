#!/usr/bin/env node
// 判定ロジックと各サブコマンドの自己テスト。一時 git リポジトリで実行する。 使い方: node tests/selftest.mjs
// テスト名の「<spec名>/AC-n」は、仕様書の受け入れ条件との対応を表す。
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeCommand, selfUpdate } from "../scripts/brw.mjs";
import { globToRegExp, loadConfig, parsePushBranches, undeclaredCiBranches, validateConfig } from "../scripts/lib.mjs";
import { getProvider, previewUrl } from "../providers/index.mjs";
import * as cloudflare from "../providers/cloudflare-previews.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brw = join(root, "scripts/brw.mjs");
let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n     got : ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`}`);
};

const g = (cwd, ...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd, stdio: "ignore" });
const mkRepo = (branch, config) => {
  const d = mkdtempSync(join(tmpdir(), "brw-"));
  g(d, "init", "-q", "-b", "main");
  g(d, "commit", "-q", "--allow-empty", "-m", "i");
  if (branch !== "main") g(d, "checkout", "-q", "-b", branch);
  if (config) {
    mkdirSync(join(d, ".claude"));
    writeFileSync(join(d, ".claude/branch-release-workflow.json"), JSON.stringify(config));
  }
  return d;
};
const run = (cwd, ...args) => spawnSync("node", [brw, ...args], { cwd, encoding: "utf8" });
const cfg = { workBranches: ["dev/*"], protectedBranches: ["main", "develop"], namePattern: "^dev/[a-z0-9]+(-[a-z0-9]+)*$", preview: { provider: "url-template", urlTemplate: "https://{alias}.example.com" } };
const d = (cmd, repo) => judgeCommand(cmd, repo).decision;

const onMain = mkRepo("main", cfg);
const onDev = mkRepo("dev/foo", cfg);
const onOther = mkRepo("feature/x", cfg);
const noCfg = mkRepo("main", null);
const badCfg = mkRepo("dev/foo", { workBranches: "x" });

// ---- branch-guard ----
eq("branch-guard/AC-1 作業ブランチが空の宣言は不正", validateConfig({ workBranches: [], protectedBranches: [] }).length, 1);
eq("branch-guard/AC-1 不正な宣言ファイルは読み込みでエラー", typeof loadConfig(badCfg).error, "string");
eq("branch-guard/AC-1 正常な宣言は検証を通る", validateConfig(cfg), []);
eq("branch-guard/AC-2 保護ブランチの commit は deny", d("git commit -m x", onMain), "deny");
eq("branch-guard/AC-2 作業ブランチの commit は allow", d("git commit -m x", onDev), "allow");
eq("branch-guard/AC-2 宣言外ブランチの commit は deny", d("git commit -m x", onOther), "deny");
eq("branch-guard/AC-3 宣言ファイルが無ければ ask", d("git commit -m x", noCfg), "ask");
eq("branch-guard/AC-3 宣言が不正なら ask", d("git push", badCfg), "ask");
eq("branch-guard/AC-3 --all は ask", d("git push --all origin", onDev), "ask");
eq("branch-guard/AC-4 HEAD:main への push は deny", d("git push origin HEAD:main", onDev), "deny");
eq("branch-guard/AC-4 refs/heads/main への push は deny", d("git push origin dev/foo:refs/heads/main", onDev), "deny");
eq("branch-guard/AC-4 作業ブランチの push は allow", d("git push -u origin dev/foo", onDev), "allow");
eq("branch-guard/AC-4 引数なし push は現在のブランチで判定", d("git push", onMain), "deny");
eq("branch-guard/AC-4 タグの push は allow", d("git push origin refs/tags/v1", onMain), "allow");
eq("branch-guard/AC-4 git -C を判定", d(`git -C ${onMain} commit -m x`, onDev), "deny");
eq("branch-guard/AC-4 cd && git を判定", d(`cd ${onMain} && git commit -m x`, onDev), "deny");
eq("branch-guard/AC-4 連結コマンドの2つ目も判定", d("git status && git push origin main", onDev), "deny");
eq("branch-guard/AC-4 git 以外は allow", d("echo git commit", onMain), "allow");

const created = mkRepo("develop", cfg);
const bad = run(created, "create", "Bad_Name", "--branch-only");
eq("branch-guard/AC-5 命名規則違反は終了コード 1", bad.status, 1);
eq("branch-guard/AC-5 命名規則違反はブランチを作らない", spawnSync("git", ["branch", "--list", "dev/*"], { cwd: created, encoding: "utf8" }).stdout.trim(), "");
eq("branch-guard/AC-5 規則に合う名前は作成される", run(created, "create", "good-name", "--branch-only").status, 0);

const plain = mkdtempSync(join(tmpdir(), "brw-copy-"));
cpSync(join(root, "scripts"), join(plain, "scripts"), { recursive: true });
const msg = selfUpdate(plain);
eq("branch-guard/AC-6 作業ツリーでないスキルは更新できない旨と導入方法を返す", msg.startsWith("更新できません") && msg.includes("git clone"), true);

// 自己更新: ローカルの bare リモートを使った早送り更新
const bare = mkdtempSync(join(tmpdir(), "brw-bare-"));
g(bare, "init", "-q", "--bare", "-b", "main");
const work = mkRepo("main", null);
g(work, "remote", "add", "origin", bare);
g(work, "push", "-q", "-u", "origin", "main");
const clone = join(mkdtempSync(join(tmpdir(), "brw-clone-")), "skill");
execFileSync("git", ["clone", "-q", bare, clone]);
eq("自己更新: 変更が無ければ最新", selfUpdate(clone), "スキルは最新です。");
g(work, "commit", "-q", "--allow-empty", "-m", "next");
g(work, "push", "-q");
eq("自己更新: リモートが進んでいれば更新", selfUpdate(clone), "スキルを更新しました。SKILL.md を読み直してください。");
g(clone, "commit", "-q", "--allow-empty", "-m", "local");
g(work, "commit", "-q", "--allow-empty", "-m", "diverge");
g(work, "push", "-q");
eq("自己更新: 履歴が分岐していれば強制せず更新できない旨", selfUpdate(clone).startsWith("更新できません"), true);

const t0 = Date.now();
for (let i = 0; i < 16; i++) judgeCommand("git commit -m x", onDev);
eq("branch-guard/AC-7 判定 16 件が 10 秒以内", Date.now() - t0 <= 10_000, true);

const imports = [];
for (const dir of ["scripts", "providers"])
  for (const f of readdirSync(join(root, dir)))
    for (const m of readFileSync(join(root, dir, f), "utf8").matchAll(/from "([^"]+)"/g)) imports.push(m[1]);
eq("branch-guard/AC-8 import は標準モジュールと相対パスのみ", imports.filter((m) => !m.startsWith("node:") && !m.startsWith(".")), []);

// ---- preview ----
eq("preview/AC-1 斜線をハイフンにした alias のURLを算出", previewUrl({ preview: cfg.preview }, "dev/foo-bar"), "https://dev-foo-bar.example.com");
eq("preview/AC-2 provider none ではURLが無い", previewUrl({ preview: { provider: "none" } }, "dev/foo"), null);
eq("preview/AC-2 provider none では後始末が無い", getProvider({ preview: { provider: "none" } }).cleanup({}, "dev/foo"), null);

const wf = [{ file: "w", push: [{ glob: "release/**" }, { glob: "dev/**" }, { glob: "main" }] }];
eq("preview/AC-3 宣言外の push 対象を警告", undeclaredCiBranches(cfg, wf), [{ file: "w", glob: "release/**" }]);
eq("workflow: flow 形式", parsePushBranches('on:\n  push:\n    branches: ["dev/**", main]\n'), [{ glob: "dev/**" }, { glob: "main" }]);
eq("workflow: block 形式", parsePushBranches("on:\n  push:\n    branches:\n      - 'dev/**'\n      - develop # コメント\n  pull_request:\n"), [{ glob: "dev/**" }, { glob: "develop" }]);
eq("workflow: 全 push", parsePushBranches("on: [push, pull_request]\n"), [{ any: true }]);
eq("workflow: tags のみはブランチ対象外", parsePushBranches("on:\n  push:\n    tags: ['v*']\n"), []);
eq("workflow: push 空指定は全ブランチ", parsePushBranches("on:\n  push:\n  pull_request:\n"), [{ any: true }]);
eq("glob: dev/* は dev/a/b に合わない", globToRegExp("dev/*").test("dev/a/b"), false);
eq("glob: dev/** は dev/a/b に合う", globToRegExp("dev/**").test("dev/a/b"), true);

const cf = mkdtempSync(join(tmpdir(), "brw-cf-"));
writeFileSync(join(cf, "wrangler.jsonc"), '{ "name": "x" }');
eq("preview/AC-4 有効化設定が無ければ誤りを報告", cloudflare.check(cf, { preview: {} }).some((f) => f.level === "error" && f.message.includes("previews_enabled")), true);

const withWf = mkRepo("dev/foo", { ...cfg, preview: { provider: "cloudflare-previews", urlTemplate: "https://{alias}.example.com" } });
mkdirSync(join(withWf, ".github/workflows"), { recursive: true });
writeFileSync(join(withWf, ".github/workflows/preview.yaml"), "name: keep\n");
eq("preview/AC-5 既存の workflow は上書きせず終了コード 1", run(withWf, "gen-workflow", "--write").status, 1);
eq("preview/AC-5 既存の workflow の内容は変わらない", readFileSync(join(withWf, ".github/workflows/preview.yaml"), "utf8"), "name: keep\n");
const cl = run(withWf, "cleanup", "dev/foo");
eq("preview/AC-6 実行指定なしはコマンドを表示するだけ", cl.status === 0 && cl.stdout.includes("wrangler preview delete --name dev-foo") && cl.stdout.includes("表示のみ"), true);

console.log(failed ? `\n${failed} 件失敗` : "\nすべて成功");
process.exit(failed ? 1 : 0);

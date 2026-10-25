#!/usr/bin/env node
// 判定ロジックと各サブコマンドの自己テスト。一時 git リポジトリで実行する。 使い方: node tests/selftest.mjs
// テスト名の「<spec名>/AC-n」は、仕様書の受け入れ条件との対応を表す。
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeCommand } from "../scripts/brw.mjs";
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
eq("branch-guard/AC-4 リダイレクトは送り先と見なさない", [d("git push origin dev/foo 2>&1", onDev), d("git push 2>/dev/null", onDev), d("git push -u origin dev/foo > log.txt", onDev)], ["allow", "allow", "allow"]);
eq("branch-guard/AC-4 リダイレクトがあっても保護ブランチへの push は deny", d("git push origin main 2>&1", onDev), "deny");

const created = mkRepo("develop", cfg);
const bad = run(created, "create", "Bad_Name", "--branch-only");
eq("branch-guard/AC-5 命名規則違反は終了コード 1", bad.status, 1);
eq("branch-guard/AC-5 命名規則違反はブランチを作らない", spawnSync("git", ["branch", "--list", "dev/*"], { cwd: created, encoding: "utf8" }).stdout.trim(), "");
eq("branch-guard/AC-5 規則に合う名前は作成される", run(created, "create", "good-name", "--branch-only").status, 0);

// push 後の片付けと再開。一時の bare リポジトリを origin にする
const remote = mkdtempSync(join(tmpdir(), "brw-remote-"));
g(remote, "init", "-q", "--bare");
const fin = mkRepo("develop", cfg);
g(fin, "remote", "add", "origin", remote);
g(fin, "push", "-q", "origin", "develop");
run(fin, "create", "fin-work");
const finWt = join(fin, ".claude/worktrees/dev-fin-work");
g(finWt, "commit", "-q", "--allow-empty", "-m", "w");
const hasBranch = (b) => spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${b}`], { cwd: fin }).status === 0;
eq("branch-guard/AC-8 push していない commit があれば片付けず終了コード 1", run(finWt, "finish").status, 1);
eq("branch-guard/AC-8 片付けなかった worktree は残る", existsSync(finWt), true);
g(finWt, "push", "-q", "origin", "dev/fin-work");
writeFileSync(join(finWt, "dirty.txt"), "x");
eq("branch-guard/AC-8 commit していない変更があれば片付けない", run(finWt, "finish").status, 1);
rmSync(join(finWt, "dirty.txt"));
eq("branch-guard/AC-8 push 済みなら worktree の中から片付けられる", run(finWt, "finish").status, 0);
eq("branch-guard/AC-8 worktree とローカルブランチが消える", [existsSync(finWt), hasBranch("dev/fin-work")], [false, false]);
eq("branch-guard/AC-8 作業ブランチでなければ片付けない", run(fin, "finish", "develop").status, 1);
// submodule を含む worktree も片付けられる
const sub = mkRepo("main", null);
g(fin, "-c", "protocol.file.allow=always", "submodule", "add", "-q", sub, "sub");
g(fin, "commit", "-q", "-m", "sub");
g(fin, "push", "-q", "origin", "develop");
run(fin, "create", "fin-sub");
const subWt = join(fin, ".claude/worktrees/dev-fin-sub");
g(subWt, "-c", "protocol.file.allow=always", "submodule", "update", "-q", "--init");
g(subWt, "push", "-q", "origin", "dev/fin-sub");
eq("branch-guard/AC-8 submodule を含む worktree も片付けられる", [run(subWt, "finish").status, existsSync(subWt)], [0, false]);
eq("branch-guard/AC-9 リモートのブランチから worktree を作り直せる", run(fin, "resume", "dev/fin-work").status, 0);
eq("branch-guard/AC-9 作り直した worktree はリモートの commit を持ち、追跡先がリモートになる", [
  spawnSync("git", ["log", "-1", "--format=%s"], { cwd: finWt, encoding: "utf8" }).stdout.trim(),
  spawnSync("git", ["rev-parse", "--abbrev-ref", "@{u}"], { cwd: finWt, encoding: "utf8" }).stdout.trim(),
], ["w", "origin/dev/fin-work"]);
eq("branch-guard/AC-9 ローカルに残っていれば作り直さない", run(fin, "resume", "dev/fin-work").status, 1);

const t0 = Date.now();
for (let i = 0; i < 16; i++) judgeCommand("git commit -m x", onDev);
eq("branch-guard/AC-6 判定 16 件が 10 秒以内", Date.now() - t0 <= 10_000, true);

const imports = [];
for (const dir of ["scripts", "providers"])
  for (const f of readdirSync(join(root, dir)))
    for (const m of readFileSync(join(root, dir, f), "utf8").matchAll(/from "([^"]+)"/g)) imports.push(m[1]);
eq("branch-guard/AC-7 import は標準モジュールと相対パスのみ", imports.filter((m) => !m.startsWith("node:") && !m.startsWith(".")), []);

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
const stripCfg = { ...cfg, preview: { ...cfg.preview, provider: "cloudflare-previews", aliasStripPrefix: "dev/" } };
eq("preview/AC-9 接頭辞を除いた alias のURLを算出", previewUrl(stripCfg, "dev/foo-bar"), "https://foo-bar.example.com");
eq("preview/AC-9 後始末の名前も接頭辞を除く", getProvider(stripCfg).cleanup(stripCfg, "dev/foo-bar").args.at(-1), "foo-bar");
eq("preview/AC-9 接頭辞が文字列でなければ不正", validateConfig({ ...cfg, preview: { ...cfg.preview, aliasStripPrefix: 1 } }).length, 1);
const cl = run(withWf, "cleanup", "dev/foo");
eq("preview/AC-6 実行指定なしはコマンドを表示するだけ", cl.status === 0 && cl.stdout.includes("wrangler preview delete --name dev-foo") && cl.stdout.includes("表示のみ"), true);

// ---- preview: workers.dev 関連キー ----
const withDomain = `{
  // 名前
  "name": "x",
  "routes": [{ "pattern": "a.example.com", "custom_domain": true, "enabled": true, }],
  "workers_dev": true, // 旧設定
  "preview_urls": true,
  "previews": { "workers_dev": true },
}
`;
const noDomain = '{\n  "name": "x",\n  "routes": [{ "pattern": "a", "custom_domain": true, "enabled": false }],\n  "workers_dev": false\n}\n';
const wcDir = mkdtempSync(join(tmpdir(), "brw-wc-"));
const wcFile = join(wcDir, "wrangler.jsonc");
writeFileSync(wcFile, withDomain);
const wcShow = run(wcDir, "wrangler-config");
eq("preview/AC-7 書き込み指定なしはファイルを変えない", readFileSync(wcFile, "utf8"), withDomain);
eq("preview/AC-7 書き込み指定なしは変更後を標準出力へ出す", wcShow.stdout.includes('"preview_urls": false'), true);
run(wcDir, "wrangler-config", "--write");
eq("preview/AC-7 有効な独自ドメインがあれば両キーを false にし他は変えない", readFileSync(wcFile, "utf8"), withDomain.replace('"workers_dev": true,', '"workers_dev": false,').replace('"preview_urls": true,', '"preview_urls": false,'));
eq("preview/AC-7 入れ子の previews 内のキーは変えない", readFileSync(wcFile, "utf8").includes('"previews": { "workers_dev": true }'), true);
writeFileSync(wcFile, noDomain);
run(wcDir, "wrangler-config", "--write");
const wcOut = cloudflare.parseJsonc(readFileSync(wcFile, "utf8"));
eq("preview/AC-7 有効な独自ドメインがなければ両方 true", [wcOut.workers_dev, wcOut.preview_urls], [true, true]);
writeFileSync(wcFile, '{ "name": "x" }');
run(wcDir, "wrangler-config", "--write");
const wcAdded = cloudflare.parseJsonc(readFileSync(wcFile, "utf8"));
eq("preview/AC-7 キーがなければ追加される", [wcAdded.name, wcAdded.workers_dev, wcAdded.preview_urls], ["x", true, true]);
const wcDirty = (text) => { const w = mkdtempSync(join(tmpdir(), "brw-wc-")); writeFileSync(join(w, "wrangler.jsonc"), text); return cloudflare.check(w, { preview: {} }).filter((f) => f.level === "warn" && /workers_dev|preview_urls/.test(f.message)).length; };
eq("preview/AC-8 有効な独自ドメインがあり workers_dev: true は警告", wcDirty(withDomain) >= 2, true);
eq("preview/AC-8 無効な独自ドメインのみで workers_dev: false は警告", wcDirty(noDomain), 1);
writeFileSync(wcFile, '{ "routes": [{ "pattern": "a", "custom_domain": true }] }');
run(wcDir, "wrangler-config", "--write");
const wcFalse = cloudflare.parseJsonc(readFileSync(wcFile, "utf8"));
eq("preview/AC-7 有効な独自ドメインでキーがなければ false で追加される", [wcFalse.workers_dev, wcFalse.preview_urls], [false, false]);
eq("preview/AC-8 有効な独自ドメインがありキーなしは警告しない", wcDirty('{ "routes": [{ "pattern": "a", "custom_domain": true }] }'), 0);

console.log(failed ? `\n${failed} 件失敗` : "\nすべて成功");
process.exit(failed ? 1 : 0);

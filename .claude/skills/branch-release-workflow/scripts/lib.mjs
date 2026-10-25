// 共通処理: 宣言ファイルの読み込み・検証、ブランチ判定、workflow の走査。
// 外部依存なし（Node 標準ライブラリのみ）。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_REL = ".claude/branch-release-workflow.json";

export function git(cwd, ...args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function repoRoot(cwd) {
  return git(cwd, "rev-parse", "--show-toplevel");
}

// glob（* は "/" を除く任意文字列、** は "/" を含む任意文字列）を正規表現へ変換する
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export const matchesAny = (globs, branch) => globs.some((g) => globToRegExp(g).test(branch));

// 宣言ファイルを読み込む。無ければ { config: null }、不正なら { error } を返す
export function loadConfig(root) {
  const path = join(root, CONFIG_REL);
  if (!existsSync(path)) return { config: null, path };
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return { error: `${CONFIG_REL} の JSON が不正です: ${e.message}`, path };
  }
  const errors = validateConfig(raw);
  if (errors.length) return { error: `${CONFIG_REL} が不正です:\n- ${errors.join("\n- ")}`, path };
  return { config: normalizeConfig(raw), path };
}

const PROVIDERS = ["none", "url-template", "cloudflare-previews"];

export function validateConfig(c) {
  const errs = [];
  const strArr = (k) => {
    if (!Array.isArray(c[k]) || c[k].some((s) => typeof s !== "string" || !s)) errs.push(`${k} は文字列の配列にしてください`);
  };
  if (typeof c !== "object" || c === null || Array.isArray(c)) return ["ルートはオブジェクトにしてください"];
  strArr("workBranches");
  strArr("protectedBranches");
  if (Array.isArray(c.workBranches) && c.workBranches.length === 0) errs.push("workBranches は1つ以上必要です");
  if (c.baseBranch !== undefined && typeof c.baseBranch !== "string") errs.push("baseBranch は文字列にしてください");
  if (c.namePattern !== undefined) {
    try {
      new RegExp(c.namePattern);
    } catch {
      errs.push("namePattern が正規表現として不正です");
    }
  }
  if (c.maxNameLength !== undefined && !Number.isInteger(c.maxNameLength)) errs.push("maxNameLength は整数にしてください");
  if (c.preview !== undefined) {
    const p = c.preview;
    const provider = p.provider ?? (p.urlTemplate ? "url-template" : "none");
    if (!PROVIDERS.includes(provider)) errs.push(`preview.provider は ${PROVIDERS.join(" / ")} のいずれかにしてください`);
    if (provider !== "none" && typeof p.urlTemplate !== "string") errs.push("preview.urlTemplate が必要です（{alias} を含める）");
    if (typeof p.urlTemplate === "string" && !p.urlTemplate.includes("{alias}")) errs.push("preview.urlTemplate には {alias} を含めてください");
    if (p.aliasStripPrefix !== undefined && typeof p.aliasStripPrefix !== "string") errs.push("preview.aliasStripPrefix は文字列にしてください");
  }
  return errs;
}

export function normalizeConfig(c) {
  const preview = c.preview
    ? { provider: c.preview.provider ?? (c.preview.urlTemplate ? "url-template" : "none"), ...c.preview }
    : { provider: "none" };
  return { baseBranch: "develop", maxNameLength: 54, ...c, preview };
}

// 'refs/heads/' を除いた短いブランチ名にする
export const shortRef = (r) => r.replace(/^refs\/heads\//, "").replace(/^\+/, "");

export function currentBranch(cwd) {
  const b = git(cwd, "branch", "--show-current");
  return b || null; // detached HEAD は null
}

// ブランチの判定。戻り値: { decision: "allow"|"deny"|"ask", reason }
export function judgeBranch(config, branch) {
  if (!branch) return { decision: "ask", reason: "ブランチを特定できません（detached HEAD など）。" };
  if (matchesAny(config.protectedBranches ?? [], branch))
    return { decision: "deny", reason: `'${branch}' は保護ブランチです。作業ブランチ（${config.workBranches.join(", ")}）で作業してください。` };
  if (matchesAny(config.workBranches, branch)) return { decision: "allow", reason: `'${branch}' は作業ブランチです。` };
  return { decision: "deny", reason: `'${branch}' は宣言（workBranches: ${config.workBranches.join(", ")}）に無いブランチです。作業ブランチへ切り替えてください。` };
}

// ブランチ名 → alias（DNS ラベルになるため "/" を "-" に置き換える）
export const aliasOf = (branch) => branch.replace(/\//g, "-");

// ブランチ名 → プレビュー名。宣言の preview.aliasStripPrefix（例: "dev/"）があれば、その接頭辞を除いてから alias にする
export const previewAliasOf = (config, branch) => {
  const prefix = config.preview?.aliasStripPrefix ?? "";
  return aliasOf(prefix && branch.startsWith(prefix) ? branch.slice(prefix.length) : branch);
};

// worktree の一覧（git worktree list --porcelain）。先頭が本体の作業ツリー。戻り値: { path, branch|null }[]
export function worktrees(cwd) {
  const out = [];
  for (const block of (git(cwd, "worktree", "list", "--porcelain") ?? "").split(/\n\n+/)) {
    const path = block.match(/^worktree (.+)$/m)?.[1];
    if (path) out.push({ path, branch: block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? null });
  }
  return out;
}

// 作業ブランチ名（dev/XXXX の XXXX 部分）が命名規則に合うか
export function checkName(config, branch) {
  if (config.namePattern && !new RegExp(config.namePattern).test(branch)) return `'${branch}' は namePattern（${config.namePattern}）に合いません。`;
  if (branch.length > config.maxNameLength) return `'${branch}' は ${config.maxNameLength} 文字を超えています（${branch.length}文字）。`;
  return null;
}

// ---- workflow 走査 -------------------------------------------------------

// on.push.branches を簡易的に取り出す（flow / block 形式に対応。YAML 完全対応ではない）
export function parsePushBranches(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+#.*$/, "").replace(/^#.*$/, ""));
  const indentOf = (l) => l.match(/^ */)[0].length;
  const unq = (s) => s.trim().replace(/^["']|["']$/g, "");
  const flow = (s) => s.replace(/^\[|\]$/g, "").split(",").map(unq).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^(on|"on"|'on'):\s*(.*)$/.test(lines[i])) continue;
    const inline = lines[i].replace(/^[^:]+:\s*/, "").trim();
    if (inline.startsWith("[") || /^\w+$/.test(inline)) {
      if (inline === "push" || inline.replace(/[\[\]\s]/g, "").split(",").includes("push")) out.push({ any: true });
      return out;
    }
    // on: 配下の push: を探す
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === "") continue;
      if (indentOf(lines[j]) === 0) break;
      const m = lines[j].match(/^(\s+)push:\s*(.*)$/);
      if (!m) continue;
      const pushIndent = m[1].length;
      let hasTags = false;
      for (let k = j + 1; k < lines.length && (lines[k].trim() === "" || indentOf(lines[k]) > pushIndent); k++)
        if (/^\s+tags(-ignore)?:/.test(lines[k])) hasTags = true;
      for (let k = j + 1; k < lines.length; k++) {
        if (lines[k].trim() === "") continue;
        if (indentOf(lines[k]) <= pushIndent) break;
        const bm = lines[k].match(/^\s+branches:\s*(.*)$/);
        if (!bm) continue;
        const bIndent = indentOf(lines[k]);
        out.length = 0;
        if (bm[1].trim().startsWith("[")) out.push(...flow(bm[1]).map((b) => ({ glob: b })));
        else
          for (let n = k + 1; n < lines.length; n++) {
            if (lines[n].trim() === "") continue;
            const lm = lines[n].match(/^(\s+)-\s*(.+)$/);
            if (!lm || lm[1].length < bIndent) break;
            out.push({ glob: unq(lm[2]) });
          }
        return out;
      }
      if (hasTags) return out; // tags のみの指定はブランチ push ではない
      out.push({ any: true });
      return out; // branches 指定なし = 全ブランチ
    }
    return out;
  }
  return out;
}

export function scanWorkflows(root) {
  const dir = join(root, ".github/workflows");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => {
      const text = readFileSync(join(dir, f), "utf8");
      return { file: `.github/workflows/${f}`, text, push: parsePushBranches(text) };
    });
}

// 宣言の workBranches / protectedBranches に含まれないのに push で CI が走るブランチ指定を返す
export function undeclaredCiBranches(config, workflows) {
  const declared = [...config.workBranches, ...(config.protectedBranches ?? [])];
  const findings = [];
  for (const w of workflows)
    for (const p of w.push) {
      if (p.any) findings.push({ file: w.file, glob: "(全ブランチ)" });
      else if (!declared.includes(p.glob) && !declared.some((d) => globToRegExp(p.glob).test(d.replace(/\*+/g, "x"))))
        findings.push({ file: w.file, glob: p.glob });
    }
  return findings;
}

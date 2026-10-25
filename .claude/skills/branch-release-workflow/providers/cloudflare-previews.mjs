// Cloudflare Workers の Previews（wrangler preview）用 provider。
// 詳細は references/cloudflare-previews.md を参照。
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { previewAliasOf } from "../scripts/lib.mjs";

const MIN_WRANGLER = [4, 135, 0];

const gte = (v, min) => {
  for (let i = 0; i < 3; i++) if ((v[i] ?? 0) !== min[i]) return (v[i] ?? 0) > min[i];
  return true;
};

// JSONC（コメント・末尾カンマ入りの JSON）を読む。文字列の中身は変えない
export function parseJsonc(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2);
      if (i < 0) throw new Error("コメントが閉じていません");
      i++;
    } else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

// 有効な独自ドメイン（custom_domain: true で enabled: false でない route）があるか
export function hasActiveCustomDomain(conf) {
  const routes = [...(Array.isArray(conf.routes) ? conf.routes : []), ...(conf.route ? [conf.route] : [])];
  return routes.some((r) => r && typeof r === "object" && r.custom_domain === true && r.enabled !== false);
}

// 独自ドメインの有効状況に応じて workers_dev / preview_urls を設定した設定文章を返す（コメントは保つ）。
// 有効: トップレベルの両キーを false にする / 無効: 両方 true にする。
// 省略しても deploy の結果は同じだが、毎回 wrangler が警告を出し既定値にも依存するため、明示する
export function applyWorkersDev(text) {
  const active = hasActiveCustomDomain(parseJsonc(text));
  const value = String(!active);
  let out = text;
  for (const k of ["workers_dev", "preview_urls"]) {
    const re = new RegExp(`^[ \\t]*"${k}"\\s*:\\s*(true|false)`, "gm");
    const m = [...out.matchAll(re)].find((x) => depthAt(out, x.index) === 1); // トップレベルのキーだけ
    if (m) out = out.slice(0, m.index) + m[0].replace(/(true|false)$/, value) + out.slice(m.index + m[0].length);
    else {
      const open = out.indexOf("{"); // 先頭のオブジェクトの直後に足す（末尾カンマは JSONC で許される）
      out = `${out.slice(0, open + 1)}\n  "${k}": ${value},${out.slice(open + 1)}`;
    }
  }
  parseJsonc(out); // 壊れた結果を書かない
  return { active, text: out };
}

// 位置 pos の直前までの括弧の深さ（文字列とコメントは数えない）
function depthAt(text, pos) {
  let depth = 0;
  for (let i = 0; i < pos; i++) {
    const c = text[i];
    if (c === '"') { i++; while (i < pos && text[i] !== '"') i += text[i] === "\\" ? 2 : 1; }
    else if (c === "/" && text[i + 1] === "/") while (i < pos && text[i] !== "\n") i++;
    else if (c === "/" && text[i + 1] === "*") i = text.indexOf("*/", i + 2) + 1;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
  }
  return depth;
}

export function check(root, config) {
  const out = [];
  // wrangler 設定（wrangler.jsonc / json / toml、およびテンプレート）に previews_enabled があるか
  const files = readdirSync(root).filter((f) => /^wrangler(\..+)?\.(jsonc|json|toml)$/.test(f));
  if (!files.length) out.push({ level: "warn", message: "wrangler の設定ファイルが見つかりません（生成物の場合は無視してよい）。" });
  else if (!files.some((f) => /previews_enabled\W+true/.test(readFileSync(join(root, f), "utf8"))))
    out.push({ level: "error", message: `${files.join(", ")} に previews_enabled: true が見つかりません。独自ドメインでプレビューを配信できません。` });
  // 独自ドメインの有効状況と workers_dev / preview_urls の整合
  for (const f of files.filter((f) => /\.jsonc?$/.test(f))) {
    let conf;
    try { conf = parseJsonc(readFileSync(join(root, f), "utf8")); } catch { continue; }
    const active = hasActiveCustomDomain(conf);
    for (const k of ["workers_dev", "preview_urls"])
      if (conf[k] === active)
        out.push({ level: "warn", message: `${f}: 有効な独自ドメインが${active ? "あるのに" : "ないのに"} ${k}: ${conf[k]} です。\`brw wrangler-config ${f} --write\` で直せます。` });
  }
  // wrangler のバージョン
  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const spec = { ...pkg.dependencies, ...pkg.devDependencies }.wrangler;
    const m = spec?.match(/(\d+)\.(\d+)\.(\d+)/);
    if (!spec) out.push({ level: "warn", message: "package.json に wrangler がありません（CI で npx wrangler を使う場合は 4.135.0 以上が必要）。" });
    else if (m && !gte(m.slice(1).map(Number), MIN_WRANGLER)) out.push({ level: "error", message: `wrangler ${spec} は古いです。wrangler preview には 4.135.0 以上が必要です。` });
  }
  // workflow に wrangler preview があるか
  const wfDir = join(root, ".github/workflows");
  const wfs = existsSync(wfDir) ? readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f)) : [];
  if (!wfs.some((f) => /wrangler\s+preview\b/.test(readFileSync(join(wfDir, f), "utf8"))))
    out.push({ level: "error", message: ".github/workflows に `wrangler preview` を実行する workflow がありません（gen-workflow で雛形を作れます）。" });
  if (wfs.some((f) => /versions\s+upload[^\n]*--preview-alias/.test(readFileSync(join(wfDir, f), "utf8"))))
    out.push({ level: "warn", message: "旧方式（wrangler versions upload --preview-alias）が残っています。Previews へ移行してください。" });
  return out;
}

export function workflow(config) {
  const globs = config.workBranches.map((g) => `"${g.endsWith("/*") ? g + "*" : g}"`).join(", ");
  const pattern = config.namePattern ?? "^.+$";
  return `# 作業ブランチへの push で Cloudflare Workers の Preview を作成・更新する（本番は変えない）。
# このファイルは branch-release-workflow の gen-workflow で生成した雛形。ビルド手順などはリポジトリに合わせて直すこと。
# 同じブランチへ再 push しても URL は変わらず、中身だけ最新になる。
name: preview

on:
  push:
    branches: [${globs}]

concurrency:
  group: preview-\${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  preview:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci

      # ブランチ名から Preview 名を作る（宣言の aliasStripPrefix を除き、"/" を "-" にする）。宣言の namePattern / 文字数に合わなければスキップする
      - name: Resolve preview alias
        id: alias
        env:
          BRANCH_NAME: \${{ github.ref_name }}
        run: |
          if printf '%s' "$BRANCH_NAME" | grep -Eq '${pattern}' && [ "\${#BRANCH_NAME}" -le ${config.maxNameLength} ]; then
            echo "valid=true" >> "$GITHUB_OUTPUT"
            name="\${BRANCH_NAME#${config.preview.aliasStripPrefix ?? ""}}"
            echo "alias=\${name//\\//-}" >> "$GITHUB_OUTPUT"
          else
            echo "valid=false" >> "$GITHUB_OUTPUT"
            echo "::warning::ブランチ名 '$BRANCH_NAME' は命名規則に合わないため、プレビューをスキップします"
          fi

      - name: Run build
        if: steps.alias.outputs.valid == 'true'
        run: npm run build

      - name: Deploy preview
        if: steps.alias.outputs.valid == 'true'
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          PREVIEW_ALIAS: \${{ steps.alias.outputs.alias }}
          COMMIT_SHA: \${{ github.sha }}
        run: |
          npx wrangler preview \\
            --name "$PREVIEW_ALIAS" \\
            --tag "\${COMMIT_SHA::7}" \\
            --message "preview: $PREVIEW_ALIAS @ \${COMMIT_SHA::7}"

      - name: Show preview URL
        if: steps.alias.outputs.valid == 'true'
        env:
          PREVIEW_ALIAS: \${{ steps.alias.outputs.alias }}
        run: |
          echo "- URL: ${config.preview.urlTemplate.replace("{alias}", "${PREVIEW_ALIAS}")}" >> "$GITHUB_STEP_SUMMARY"
`;
}

export const cleanup = (config, branch) => ({ cmd: "npx", args: ["wrangler", "preview", "delete", "--name", previewAliasOf(config, branch)] });

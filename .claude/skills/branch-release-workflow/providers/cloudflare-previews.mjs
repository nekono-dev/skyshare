// Cloudflare Workers の Previews（wrangler preview）用 provider。
// 詳細は references/cloudflare-previews.md を参照。
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { aliasOf } from "../scripts/lib.mjs";

const MIN_WRANGLER = [4, 135, 0];

const gte = (v, min) => {
  for (let i = 0; i < 3; i++) if ((v[i] ?? 0) !== min[i]) return (v[i] ?? 0) > min[i];
  return true;
};

export function check(root, config) {
  const out = [];
  // wrangler 設定（wrangler.jsonc / json / toml、およびテンプレート）に previews_enabled があるか
  const files = readdirSync(root).filter((f) => /^wrangler(\..+)?\.(jsonc|json|toml)$/.test(f));
  if (!files.length) out.push({ level: "warn", message: "wrangler の設定ファイルが見つかりません（生成物の場合は無視してよい）。" });
  else if (!files.some((f) => /previews_enabled\W+true/.test(readFileSync(join(root, f), "utf8"))))
    out.push({ level: "error", message: `${files.join(", ")} に previews_enabled: true が見つかりません。独自ドメインでプレビューを配信できません。` });
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

      # ブランチ名から Preview 名を作る（"/" を "-" にする）。宣言の namePattern / 文字数に合わなければスキップする
      - name: Resolve preview alias
        id: alias
        env:
          BRANCH_NAME: \${{ github.ref_name }}
        run: |
          if printf '%s' "$BRANCH_NAME" | grep -Eq '${pattern}' && [ "\${#BRANCH_NAME}" -le ${config.maxNameLength} ]; then
            echo "valid=true" >> "$GITHUB_OUTPUT"
            echo "alias=\${BRANCH_NAME//\\//-}" >> "$GITHUB_OUTPUT"
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

export const cleanup = (config, branch) => ({ cmd: "npx", args: ["wrangler", "preview", "delete", "--name", aliasOf(branch)] });

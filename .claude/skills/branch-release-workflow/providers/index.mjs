// プレビュー provider の共通部分。provider は宣言の preview.provider で切り替わる。
//
// provider の規約（各ファイルが export する）:
//   check(root, config)            -> { level: "error"|"warn", message }[]   宣言と設定の整合検査
//   workflow(config)               -> string | null                           preview 用 workflow の雛形
//   cleanup(config, branch)        -> { cmd, args } | null                    ブランチ削除時の後始末コマンド
import { aliasOf, previewAliasOf } from "../scripts/lib.mjs";
import * as none from "./none.mjs";
import * as urlTemplate from "./url-template.mjs";
import * as cloudflarePreviews from "./cloudflare-previews.mjs";

const providers = { none, "url-template": urlTemplate, "cloudflare-previews": cloudflarePreviews };

export const getProvider = (config) => providers[config.preview.provider];

export { aliasOf, previewAliasOf };

// プレビューURL。provider が none の場合は null
export function previewUrl(config, branch) {
  if (config.preview.provider === "none") return null;
  return config.preview.urlTemplate.replaceAll("{alias}", previewAliasOf(config, branch)).replaceAll("{branch}", branch);
}

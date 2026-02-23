const fs = require("fs")
const path = require("path")

const src = path.join(
  __dirname,
  "..",
  "src",
  "components",
  "LanguageSelect",
  "index.tsx",
)
const out = path.join(__dirname, "sorted-array.txt")

const content = fs.readFileSync(src, "utf8")

const blockMatch = content.match(
  /export const BLUESKY_POST_LANGUAGES: LanguageOption\[\] = \[([\s\S]*?)\]\s*\n/,
)
if (!blockMatch) {
  console.error("Could not find BLUESKY_POST_LANGUAGES block")
  process.exit(1)
}
const block = blockMatch[1]

const entryRe =
  /\{\s*label:\s*"([\s\S]*?)",\s*code:\s*"([A-Za-z0-9-]+)"\s*\},?/gs
let m
const entries = []
while ((m = entryRe.exec(block)) !== null) {
  entries.push({ label: m[1], code: m[2] })
}

entries.sort((a, b) => a.code.localeCompare(b.code))

const escape = s => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
const lines = entries.map(
  e => `  { label: "${escape(e.label)}", code: "${e.code}" },`,
)
const output = `export const BLUESKY_POST_LANGUAGES: LanguageOption[] = [\n${lines.join("\n")}\n]\n\n`

fs.writeFileSync(out, output, "utf8")
console.log("Wrote", out)
console.log(output)

const fs = require("fs")
const path = require("path")

const srcPath = path.join(
  __dirname,
  "..",
  "src",
  "components",
  "LanguageSelect",
  "index.tsx",
)
const outPath = path.join(__dirname, "language-autonyms.json")

const content = fs.readFileSync(srcPath, "utf8")
const regex = /code:\s*"([A-Za-z0-9-]+)"/g
let m
const codes = []
while ((m = regex.exec(content)) !== null) {
  codes.push(m[1])
}

// unique while preserving order
const uniq = []
const seen = new Set()
for (const c of codes) {
  if (!seen.has(c)) {
    seen.add(c)
    uniq.push(c)
  }
}

function getDisplayName(locale, code) {
  try {
    if (!Intl || !Intl.DisplayNames) return null
    const dn = new Intl.DisplayNames([locale], { type: "language" })
    const name = dn.of(code)
    return name || null
  } catch (e) {
    return null
  }
}

const results = uniq.map(code => {
  let label = null
  // try autonym
  label = getDisplayName(code, code)
  // fallback to english
  if (!label) label = getDisplayName("en", code)
  // fallback to japanese
  if (!label) label = getDisplayName("ja", code)
  // final fallback to code
  if (!label) label = code
  return { code, label }
})

fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8")
console.log("Wrote", outPath)
console.log(JSON.stringify(results, null, 2))

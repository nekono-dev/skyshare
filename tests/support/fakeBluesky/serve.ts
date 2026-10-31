// 偽の Bluesky を単独のプロセスで起動する（E2E の起動スクリプトが使う）。
// 待ち受けるポートは E2E_FAKE_BLUESKY_PORT（既定 9311）。SIGTERM・SIGINT で停止する。
// DID は起動のたびに作る。アンケートの回答済みの記録や予約は利用者の DID に結び付くため、
// 実行ごとに別の利用者にして、前の実行の記録に影響されないようにする（要件 5.1）。
import { randomBytes } from "node:crypto"
import { TEST_HANDLE } from "../../fixtures/identities"
import { startFakeBluesky } from "./index"

const port = Number(process.env.E2E_FAKE_BLUESKY_PORT ?? "9311")
// did:plc の識別子は小文字と 2〜7 の 24 文字（base32）
const PLC_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"
const plcId = Array.from(randomBytes(24), b => PLC_ALPHABET[b % 32]).join("")
const did = `did:plc:${plcId}`
const fake = await startFakeBluesky({
    port,
    fixtures: { did, handle: TEST_HANDLE },
})
console.log(`fake bluesky listening on ${fake.origin}`)

const stop = async (): Promise<void> => {
    await fake.close()
    process.exit(0)
}
process.on("SIGTERM", stop)
process.on("SIGINT", stop)

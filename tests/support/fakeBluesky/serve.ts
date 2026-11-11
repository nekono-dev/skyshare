/**
 * Runs the fake Bluesky service for E2E flows.
 * A fresh DID isolates saved answers and scheduled posts between runs.
 */
import { randomBytes } from "node:crypto"
import { TEST_HANDLE } from "../../fixtures/identities"
import { startFakeBluesky } from "./index"

const port = Number(process.env.E2E_FAKE_BLUESKY_PORT ?? "9311")
// A PLC identifier uses 24 lowercase base32 characters.
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

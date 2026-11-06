// 各テストの前に、D1 へ本番と同じマイグレーションを適用する
import { applyD1Migrations, env } from "cloudflare:test"

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

/**
 * Applies the production migrations to the route test database.
 */
import { applyD1Migrations, env } from "cloudflare:test"

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

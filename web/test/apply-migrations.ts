import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// テストのたびに, 空の D1 に migrations を当てる.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

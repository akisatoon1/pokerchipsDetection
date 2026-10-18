import type { D1Migration } from "cloudflare:test";

// テストの中だけで使う束縛. vitest.config.ts で渡す.
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

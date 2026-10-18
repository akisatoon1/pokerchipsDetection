// Worker が受け取る束縛. wrangler.toml の設定と合わせる.
declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
    }

    // exports.default を型付きで使えるようにする (テストで Worker を呼ぶため).
    interface GlobalProps {
      mainModule: typeof import("./index");
    }
  }
}

export {};

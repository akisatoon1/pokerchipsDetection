/** このブラウザが, あるマッチでどのプレイヤーかを表す. */
export interface Membership {
  playerId: string;
  token: string;
}

/** このブラウザが参加したマッチ. トップページの一覧に出す. */
export interface SavedMatch {
  matchId: string;
  membership: Membership;
  // 最後にマッチの画面を開いた時刻 (ミリ秒). 一覧をこの新しい順に並べる.
  lastOpenedAt: number;
}

// 端末に保存する形. マッチ名や自分の名前は保存せず, 開くたびに API で読む.
// 名前の変更やマッチの削除を一覧に反映するため (docs/web/app.md).
interface StoredMembership {
  playerId: string;
  token: string;
  lastOpenedAt: number;
}

const STORAGE_KEY_PREFIX = "pokerchip:match:";

function storageKey(matchId: string): string {
  return `${STORAGE_KEY_PREFIX}${matchId}`;
}

/**
 * マッチに参加したときのトークンをブラウザに保存する.
 *
 * ログインがないので, 本人の確認はここに保存したトークンで行う (docs/web/app.md).
 * マッチごとに別のキーで保存するので, 複数のマッチに参加しても前のトークンは消えない.
 * @param matchId マッチの id.
 * @param membership プレイヤーの id とトークン.
 * @throws ブラウザが保存を許さないとき (プライベートモードなど).
 */
export function saveMembership(matchId: string, membership: Membership): void {
  writeStored(matchId, { ...membership, lastOpenedAt: Date.now() });
}

/**
 * 保存したトークンを読む.
 *
 * @param matchId マッチの id.
 * @returns 保存したもの. なければ, または読めなければ null.
 */
export function loadMembership(matchId: string): Membership | null {
  const stored = readStored(matchId);
  if (stored === null) {
    return null;
  }
  return { playerId: stored.playerId, token: stored.token };
}

/**
 * マッチの画面を開いたことを記録する. 一覧を最後に開いた順に並べるため.
 *
 * 保存の失敗は一覧の順が古いままになるだけなので, 利用者には知らせない.
 * @param matchId マッチの id. トークンを保存していなければ何もしない.
 */
export function recordMatchOpened(matchId: string): void {
  const stored = readStored(matchId);
  if (stored === null) {
    return;
  }
  try {
    writeStored(matchId, { ...stored, lastOpenedAt: Date.now() });
  } catch {
    // 一覧の順が古いままになるだけなので, 続ける.
  }
}

/**
 * このブラウザが参加したマッチを, 最後に開いた新しい順に返す.
 *
 * @returns 参加したマッチ. 壊れた値や読めないものは含めない. 保存を許さないブラウザなら空.
 */
export function listSavedMatches(): SavedMatch[] {
  const matchIds: string[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(STORAGE_KEY_PREFIX) === true) {
        matchIds.push(key.slice(STORAGE_KEY_PREFIX.length));
      }
    }
  } catch {
    return [];
  }
  const saved: SavedMatch[] = [];
  for (const matchId of matchIds) {
    const stored = readStored(matchId);
    if (stored !== null) {
      saved.push({
        matchId,
        membership: { playerId: stored.playerId, token: stored.token },
        lastOpenedAt: stored.lastOpenedAt,
      });
    }
  }
  return saved.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

/**
 * 保存したトークンを消す.
 *
 * マッチを削除したときと, 一覧で見つからなかったマッチに使う.
 * 消すと, このブラウザはそのマッチの本人として戻れなくなる.
 * @param matchId マッチの id.
 */
export function removeMembership(matchId: string): void {
  try {
    localStorage.removeItem(storageKey(matchId));
  } catch {
    // 保存を許さないブラウザなら, もともと保存されていない.
  }
}

function writeStored(matchId: string, stored: StoredMembership): void {
  localStorage.setItem(storageKey(matchId), JSON.stringify(stored));
}

function readStored(matchId: string): StoredMembership | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(matchId));
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "playerId" in parsed &&
      "token" in parsed &&
      typeof parsed.playerId === "string" &&
      typeof parsed.token === "string"
    ) {
      // 開いた時刻がない, または壊れていれば, いちばん古いものとして扱う.
      const lastOpenedAt =
        "lastOpenedAt" in parsed && typeof parsed.lastOpenedAt === "number"
          ? parsed.lastOpenedAt
          : 0;
      return { playerId: parsed.playerId, token: parsed.token, lastOpenedAt };
    }
  } catch {
    // 壊れた値は, 保存していないものとして扱う.
  }
  return null;
}

import { describe, expect, it } from "vitest";
import {
  closeRound,
  matchWithOpenRound,
  putEntry,
  readMatch,
  send,
  startRound,
} from "./helpers";

type Setup = Awaited<ReturnType<typeof matchWithOpenRound>>;

// A, B, C の順に持ち点を入れる.
async function enterAll(
  setup: Setup,
  roundId: string,
  points: [number, number, number],
) {
  const players = [setup.leader, setup.playerB, setup.playerC];
  for (const [index, player] of players.entries()) {
    const response = await putEntry(
      roundId,
      player.playerId,
      points[index],
      player.token,
    );
    expect(response.status).toBe(200);
  }
}

describe("ラウンドを確定する", () => {
  it("リーダーなら確定でき, ラウンドが確定になる", async () => {
    const setup = await matchWithOpenRound();
    await enterAll(setup, setup.roundId, [150, 150, 0]);
    const response = await closeRound(setup.roundId, setup.leader.token);
    expect(response.status).toBe(200);
    const match = await readMatch(setup.leader.matchId);
    expect(match.rounds[0]?.status).toBe("closed");
  });

  it("リーダーでなければ拒否する", async () => {
    const setup = await matchWithOpenRound();
    await enterAll(setup, setup.roundId, [150, 150, 0]);
    expect((await closeRound(setup.roundId, setup.playerB.token)).status).toBe(
      403,
    );
    expect((await closeRound(setup.roundId)).status).toBe(401);
    const match = await readMatch(setup.leader.matchId);
    expect(match.rounds[0]?.status).toBe("open");
  });

  it("未入力の人がいたら拒否する", async () => {
    const setup = await matchWithOpenRound();
    await putEntry(
      setup.roundId,
      setup.leader.playerId,
      100,
      setup.leader.token,
    );
    await putEntry(
      setup.roundId,
      setup.playerB.playerId,
      100,
      setup.playerB.token,
    );
    expect((await closeRound(setup.roundId, setup.leader.token)).status).toBe(
      409,
    );
  });

  it("合計が合っていなくても確定でき, 確定したあとも印が残る", async () => {
    const setup = await matchWithOpenRound();
    await enterAll(setup, setup.roundId, [100, 100, 150]);
    expect((await closeRound(setup.roundId, setup.leader.token)).status).toBe(
      200,
    );
    const round = (await readMatch(setup.leader.matchId)).rounds[0];
    expect(round?.status).toBe("closed");
    expect(round?.hasTotalMismatch).toBe(true);
  });

  it("確定したあとは, 持ち点の入力も, もう一度の確定も拒否する", async () => {
    const setup = await matchWithOpenRound();
    await enterAll(setup, setup.roundId, [150, 150, 0]);
    await closeRound(setup.roundId, setup.leader.token);
    const entry = await putEntry(
      setup.roundId,
      setup.playerB.playerId,
      10,
      setup.playerB.token,
    );
    expect(entry.status).toBe(409);
    expect((await closeRound(setup.roundId, setup.leader.token)).status).toBe(
      409,
    );
  });

  it("確定したあとは, 次のラウンドを始められる", async () => {
    const setup = await matchWithOpenRound();
    await enterAll(setup, setup.roundId, [150, 150, 0]);
    await closeRound(setup.roundId, setup.leader.token);
    const next = await startRound(setup.leader.matchId, setup.leader.token);
    expect(next.status).toBe(201);
    expect(await next.json()).toEqual(expect.objectContaining({ number: 2 }));
  });

  it("知らない項目が入っていたら拒否する", async () => {
    const setup = await matchWithOpenRound();
    await enterAll(setup, setup.roundId, [150, 150, 0]);
    const response = await send(`/api/rounds/${setup.roundId}/close`, {
      method: "POST",
      body: { force: true },
      token: setup.leader.token,
    });
    expect(response.status).toBe(400);
  });

  it("存在しないラウンドなら 404 を返す", async () => {
    const setup = await matchWithOpenRound();
    expect((await closeRound("no-such-round", setup.leader.token)).status).toBe(
      404,
    );
  });
});

describe("累計", () => {
  it("scoring.md の例 (S=100, 3 人, 2 ラウンド) で +30, +50, −80 になる", async () => {
    const setup = await matchWithOpenRound(100);
    await enterAll(setup, setup.roundId, [150, 150, 0]);
    await closeRound(setup.roundId, setup.leader.token);
    const second = await startRound(setup.leader.matchId, setup.leader.token);
    const { roundId } = await second.json<{ roundId: string }>();
    await enterAll(setup, roundId, [80, 100, 120]);
    await closeRound(roundId, setup.leader.token);

    const match = await readMatch(setup.leader.matchId);
    expect(match.totals.map((total) => total.total)).toEqual([30, 50, -80]);
  });

  it("入力中のラウンドは累計に入らない", async () => {
    const setup = await matchWithOpenRound(100);
    await enterAll(setup, setup.roundId, [150, 150, 0]);
    await closeRound(setup.roundId, setup.leader.token);
    const second = await startRound(setup.leader.matchId, setup.leader.token);
    const { roundId } = await second.json<{ roundId: string }>();
    await enterAll(setup, roundId, [80, 100, 120]);

    const match = await readMatch(setup.leader.matchId);
    expect(match.totals.map((total) => total.total)).toEqual([50, 50, -100]);
  });
});

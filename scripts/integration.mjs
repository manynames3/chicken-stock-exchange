import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.GAME_TEST_URL || "http://localhost:8787";
const name = "Integration";
async function request(path, body, token, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}
const tokens = Array.from({ length: 5 }, () =>
  randomUUID().replaceAll("-", ""),
);
let state = (await request("/api/rooms", { name, token: tokens[0] }, null, 201))
  .room;
let code = state.code;
for (let i = 1; i < 4; i++)
  await request(`/api/rooms/${code}/join`, {
    name: `Player ${i}`,
    token: tokens[i],
  });
await request(
  `/api/rooms/${code}/join`,
  { name: "Overflow", token: tokens[4] },
  null,
  409,
);
await request(`/api/rooms/${code}/state`, null, tokens[4], 401);
const command = async (i, body, expected = 200) =>
  await request(
    `/api/rooms/${code}/action`,
    { ...body, match: state.match, round: state.round },
    tokens[i],
    expected,
  );
await command(1, { type: "start" }, 400);
for (let i = 0; i < 4; i++)
  state = (await command(i, { type: "ready", ready: true })).room;
state = (await command(0, { type: "start" })).room;
for (const body of [
  { type: "timer", seconds: 0 },
  { type: "pause" },
  { type: "restart" },
])
  await command(0, body, 400);
const sockets = await Promise.all(
  tokens.slice(0, 2).map(
    (token) =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(
          `${base.replace("http", "ws")}/api/rooms/${code}/socket`,
        );
        const timeout = setTimeout(
          () => reject(new Error("WebSocket auth timed out")),
          5000,
        );
        ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token }));
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "state") {
            clearTimeout(timeout);
            assert.equal(data.room.deck, undefined);
            assert.equal(data.room.players.filter((p) => p.draft).length, 1);
            resolve(ws);
          }
        };
        ws.onerror = reject;
      }),
  ),
);
state = (
  await command(0, {
    type: "draft",
    order: { action: "buy", stock: "coop", quantity: 3, protection: "coop" },
  })
).room;
const opponent = (await request(`/api/rooms/${code}/state`, null, tokens[1]))
  .room;
assert.equal(opponent.players[0].draft, undefined);
assert.equal(JSON.stringify(opponent).includes(tokens[0]), false);
for (let round = 1; round <= 12; round++) {
  for (let i = 0; i < 4; i++) {
    const order =
      i === 0 && round === 1
        ? state.players[0].draft
        : { action: "hold", stock: "coop", quantity: 1, protection: null };
    state = (await command(i, { type: "draft", order, lock: true })).room;
    if (i === 0) await command(0, { type: "draft", order, lock: true }, 400);
  }
  if (state.phase === "ended") break;
  assert.equal(state.phase, "reveal");
  for (let i = 0; i < 4; i++) state = (await command(i, { type: "skip" })).room;
  assert.equal(state.phase, "planning");
}
assert.equal(state.phase, "ended");
const reconnect = (
  await request(`/api/rooms/${code}/join`, {
    name: "Renamed?",
    token: tokens[0],
  })
).room;
assert.equal(reconnect.viewerId, state.players[0].id);
assert.equal(reconnect.players[0].name, name);
state = (await command(0, { type: "rematch" })).room;
assert.equal(state.phase, "lobby");
for (let i = 0; i < 4; i++)
  state = (await command(i, { type: "ready", ready: true })).room;
state = (await command(0, { type: "start" })).room;
assert.equal(state.match, 2);
assert.equal(state.players[0].cash, 100);
assert.equal(state.players[0].protections, 2);
sockets.forEach((ws) => ws.close(1000));
state = (
  await request(
    "/api/rooms",
    { name: "Solo", token: tokens[0], mode: "solo" },
    null,
    201,
  )
).room;
code = state.code;
assert.equal(state.solo, true);
assert.equal(state.players.length, 2);
assert.equal(state.players[1].isComputer, true);
assert.equal(state.players[1].locked, true);
assert.equal(state.players[1].draft, undefined);
for (let round = 1; round <= 12; round++) {
  state = (
    await command(0, {
      type: "draft",
      order: { action: "hold", stock: "coop", quantity: 1 },
      lock: true,
    })
  ).room;
  if (state.phase === "ended") break;
  assert.equal(state.phase, "reveal");
  state = (await command(0, { type: "skip" })).room;
  assert.equal(state.players[1].locked, true);
}
assert.equal(state.phase, "ended");
state = (await command(0, { type: "rematch" })).room;
assert.equal(state.phase, "planning");
assert.equal(state.match, 2);
assert.equal(state.players[1].isComputer, true);
assert.equal(state.players[1].protections, 2);
const invalid = await command(
  0,
  { type: "draft", order: { action: "sell", stock: "coop", quantity: 3 } },
  400,
);
assert.equal(invalid.error, "NOT_ENOUGH_SHARES");
state = (
  await command(0, {
    type: "draft",
    lock: true,
    order: { action: "sell", stock: "coop", quantity: 2 },
  })
).room;
assert.equal(state.players[0].holdings.coop, 0);
assert.equal(state.players[0].cash, 120);
assert.equal(state.recaps[0].settlements.length, 2);
state = (await command(0, { type: "skip" })).room;
const before = structuredClone(state.players[0]);
const oversell = await command(
  0,
  {
    type: "draft",
    lock: true,
    order: { action: "sell", stock: "coop", quantity: 1 },
  },
  400,
);
assert.equal(oversell.error, "NOT_ENOUGH_SHARES");
state = (await request(`/api/rooms/${code}/state`, null, tokens[0])).room;
assert.deepEqual(state.players[0], before);
state = (await command(0, { type: "timer", seconds: 0 })).room;
assert.equal(state.deadline, null);
state = (await command(0, { type: "pause" })).room;
assert.equal(state.phase, "paused");
assert.equal(state.deadline, null);
state = (await command(0, { type: "resume" })).room;
assert.equal(state.phase, "planning");
assert.equal(state.deadline, null);
await command(0, { type: "timer", seconds: 17 }, 400);
state = (await command(0, { type: "timer", seconds: 120 })).room;
assert.ok(state.deadline - Date.now() > 118000);
state = (await command(0, { type: "restart" })).room;
assert.equal(state.match, 3);
assert.equal(state.round, 1);
assert.equal(state.players[0].cash, 100);
assert.equal(state.players[0].holdings.coop, 2);
state = (
  await command(0, {
    type: "draft",
    order: { action: "buy", stock: "coop", quantity: 5 },
  })
).room;
assert.equal(state.players[0].draft.quantity, 5);
// Mixed human/computer lobby permissions, readiness, complete match and rematch.
state = (
  await request("/api/rooms", { name: "Bot host", token: tokens[0] }, null, 201)
).room;
code = state.code;
state = (
  await request(`/api/rooms/${code}/join`, {
    name: "Bot guest",
    token: tokens[1],
  })
).room;
await command(1, { type: "add-computer", difficulty: "hard" }, 400);
await command(0, { type: "add-computer", difficulty: "invalid" }, 400);
state = (await command(0, { type: "add-computer", difficulty: "hard" })).room;
const hard = state.players.find((p) => p.isComputer);
assert.equal(hard.ready, true);
assert.equal(hard.difficulty, "hard");
state = (await command(0, { type: "add-computer", difficulty: "normal" })).room;
assert.equal(state.players.length, 4);
await command(0, { type: "add-computer", difficulty: "easy" }, 400);
await command(
  0,
  { type: "remove-computer", playerId: state.players[0].id },
  400,
);
state = (
  await command(0, {
    type: "computer-level",
    playerId: hard.id,
    difficulty: "easy",
  })
).room;
assert.equal(state.players.find((p) => p.id === hard.id).difficulty, "easy");
state = (
  await command(0, {
    type: "computer-level",
    playerId: hard.id,
    difficulty: "hard",
  })
).room;
for (let i = 0; i < 2; i++)
  state = (await command(i, { type: "ready", ready: true })).room;
state = (await command(0, { type: "start" })).room;
assert.equal(state.players.filter((p) => p.isComputer && p.locked).length, 2);
assert.equal(state.players.filter((p) => p.draft).length, 1);
for (let round = 1; round <= 12; round++) {
  for (let i = 0; i < 2; i++)
    state = (
      await command(i, {
        type: "draft",
        lock: true,
        order: { action: "hold", stock: "coop", quantity: 1 },
      })
    ).room;
  if (state.phase === "ended") break;
  for (let i = 0; i < 2; i++) state = (await command(i, { type: "skip" })).room;
}
assert.equal(state.phase, "ended");
state = (await command(0, { type: "rematch" })).room;
assert.equal(state.phase, "lobby");
assert.equal(state.players.filter((p) => p.isComputer && p.ready).length, 2);
assert.equal(state.players.find((p) => p.id === hard.id).difficulty, "hard");
state = (await command(0, { type: "remove-computer", playerId: hard.id })).room;
assert.equal(state.players.length, 3);
state = (await command(0, { type: "leave" })).room;
assert.equal(state.hostId, state.players.find((p) => !p.isComputer).id);
console.log(
  `PASS: ${base} — full multiplayer and computer matches, privacy, WebSockets, oversell rejection, solo controls, mixed computer lobbies, host permissions and rematches (${code})`,
);

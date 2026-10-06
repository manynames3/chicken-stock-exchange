import {
  STOCKS,
  HOLD,
  resetMatch,
  validateOrder,
  resolveRound,
  nextRound,
  publicRoom,
} from "./rules.js";

const json = (data, status = 200) => Response.json(data, { status });
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const tokenPattern = /^[a-zA-Z0-9_-]{32,100}$/;
const nameOf = (value) =>
  typeof value === "string" ? value.trim().slice(0, 20) : "";
const DAY = 86_400_000;
function allowedOrigin(origin, env) {
  if (!origin) return true; // CLI clients still require a private seat token.
  return (
    origin === env.FRONTEND_ORIGIN ||
    /^https:\/\/[a-z0-9-]+\.chicken-stock-exchange\.pages\.dev$/.test(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
  );
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const origin = request.headers.get("Origin");
    if (!allowedOrigin(origin, env))
      return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin || env.FRONTEND_ORIGIN,
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          Vary: "Origin",
        },
      });
    let response;
    try {
      if (url.pathname === "/api/health")
        response = json({ ok: true, version: "1.0.0" });
      else if (url.pathname === "/api/rooms" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "local";
        const gate = env.ROOMS.get(env.ROOMS.idFromName(`create-rate/${ip}`));
        const permitted = await gate.fetch("https://room/rate");
        if (!permitted.ok) return json({ error: "RATE_LIMITED" }, 429);
        if (Number(request.headers.get("content-length") || 0) > 4096)
          return json({ error: "INVALID_REQUEST" }, 413);
        const body = await request.json();
        if (!nameOf(body.name) || !tokenPattern.test(body.token || ""))
          throw new Error("INVALID_REQUEST");
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (let attempt = 0; attempt < 4; attempt++) {
          const code = Array.from(
            { length: 6 },
            () => alphabet[Math.floor(random() * alphabet.length)],
          ).join("");
          const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
          response = await stub.fetch(
            new Request(`https://room/init?code=${code}`, {
              method: "POST",
              body: JSON.stringify(body),
            }),
          );
          if (response.status !== 409) break;
        }
      } else {
        const match = url.pathname.match(
          /^\/api\/rooms\/([A-Z2-9]{6})\/(join|state|action|socket)$/,
        );
        if (!match) response = json({ error: "NOT_FOUND" }, 404);
        else {
          const stub = env.ROOMS.get(env.ROOMS.idFromName(match[1]));
          const forwarded = new URL(request.url);
          forwarded.pathname = `/${match[2]}`;
          response = await stub.fetch(new Request(forwarded, request));
        }
      }
    } catch (error) {
      response = json(
        {
          error:
            error.message === "INVALID_REQUEST"
              ? error.message
              : "INVALID_REQUEST",
        },
        400,
      );
    }
    if (response.status === 101) return response;
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", origin || env.FRONTEND_ORIGIN);
    headers.set("Vary", "Origin");
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  },
};

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.room = null;
    this.queue = Promise.resolve();
    ctx.blockConcurrencyWhile(async () => {
      this.room = await ctx.storage.get("room");
    });
  }
  serial(task) {
    const result = this.queue.then(task);
    this.queue = result.catch(() => {});
    return result;
  }
  connected() {
    return [
      ...new Set(
        this.ctx
          .getWebSockets()
          .map((ws) => ws.deserializeAttachment()?.playerId)
          .filter(Boolean),
      ),
    ];
  }
  viewer(request) {
    const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
    return this.room?.players.find((p) => p.token === token);
  }
  view(id) {
    return publicRoom(this.room, id, this.connected());
  }
  async save() {
    await this.ctx.storage.put("room", this.room);
    await this.ctx.storage.setAlarm(this.room.deadline || this.room.expiresAt);
  }
  broadcast() {
    for (const ws of this.ctx.getWebSockets()) {
      const id = ws.deserializeAttachment()?.playerId;
      if (id && this.room.players.some((p) => p.id === id)) {
        try {
          ws.send(JSON.stringify({ type: "state", room: this.view(id) }));
        } catch {
          /* closed socket */
        }
      }
    }
  }
  async advance() {
    if (this.room?.deadline && Date.now() >= this.room.deadline) {
      if (this.room.phase === "planning")
        resolveRound(this.room, random, Date.now());
      else if (this.room.phase === "reveal")
        nextRound(this.room, Date.now(), random);
      await this.save();
      this.broadcast();
    }
  }
  fetch(request) {
    return this.serial(() => this.handle(request));
  }
  async handle(request) {
    const path = new URL(request.url).pathname;
    if (path === "/rate") {
      const now = Date.now();
      let rate = await this.ctx.storage.get("rate");
      if (!rate || now >= rate.expires)
        rate = { count: 0, expires: now + 3_600_000 };
      if (rate.count >= 30) return json({ error: "RATE_LIMITED" }, 429);
      rate.count++;
      await this.ctx.storage.put("rate", rate);
      await this.ctx.storage.setAlarm(rate.expires);
      return json({ ok: true });
    }
    if (path === "/init" && request.method === "POST") {
      if (this.room && Date.now() < this.room.expiresAt)
        return json({ error: "ROOM_EXISTS" }, 409);
      const body = await request.json();
      const player = this.player(body.name, body.token);
      this.room = {
        code: new URL(request.url).searchParams.get("code"),
        hostId: player.id,
        phase: "lobby",
        round: 0,
        players: [player],
        stocks: STOCKS.map((s) => ({
          ...s,
          price: 10,
          history: [10],
          delisted: false,
        })),
        deck: [],
        discards: [],
        recaps: [],
        deadline: null,
        expiresAt: Date.now() + DAY,
        match: 0,
      };
      if (body.mode === "solo") {
        const computer = this.player(
          "Captain Cluck",
          crypto.randomUUID().replaceAll("-", ""),
        );
        computer.isComputer = true;
        this.room.players.push(computer);
        this.room.solo = true;
        resetMatch(this.room, random, Date.now());
      }
      await this.save();
      return json({ room: this.view(player.id) }, 201);
    }
    if (!this.room || Date.now() > this.room.expiresAt)
      return json({ error: "ROOM_NOT_FOUND" }, 404);
    await this.advance();
    if (path === "/socket") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
        return json({ error: "WEBSOCKET_REQUIRED" }, 426);
      for (const ws of this.ctx.getWebSockets()) {
        const a = ws.deserializeAttachment();
        if (!a?.playerId && Date.now() - a.connectedAt > 15_000)
          ws.close(1008, "Authentication timeout");
      }
      if (this.ctx.getWebSockets().length >= 24)
        return json({ error: "TOO_MANY_CONNECTIONS" }, 429);
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({
        playerId: null,
        connectedAt: Date.now(),
        count: 0,
        window: Date.now(),
      });
      return new Response(null, { status: 101, webSocket: client });
    }
    if (path === "/join" && request.method === "POST") {
      const body = await request.json();
      if (!nameOf(body.name) || !tokenPattern.test(body.token || ""))
        return json({ error: "INVALID_REQUEST" }, 400);
      let player = this.room.players.find((p) => p.token === body.token);
      if (!player) {
        if (this.room.phase !== "lobby")
          return json({ error: "GAME_ALREADY_STARTED" }, 409);
        if (this.room.players.length >= 4)
          return json({ error: "ROOM_FULL" }, 409);
        player = this.player(body.name, body.token);
        this.room.players.push(player);
        if (!this.room.hostId) this.room.hostId = player.id;
      }
      this.room.expiresAt = Date.now() + DAY;
      await this.save();
      this.broadcast();
      return json({ room: this.view(player.id) });
    }
    const player = this.viewer(request);
    if (!player) return json({ error: "UNAUTHORIZED" }, 401);
    if (path === "/state" && request.method === "GET")
      return json({ room: this.view(player.id) });
    if (path === "/action" && request.method === "POST") {
      if (Number(request.headers.get("content-length") || 0) > 4096)
        return json({ error: "INVALID_REQUEST" }, 413);
      try {
        const body = await request.json();
        if (body.match !== this.room.match || body.round !== this.room.round)
          throw new Error("STALE_ACTION");
        await this.action(player, body);
        if (this.room.players.length) this.room.expiresAt = Date.now() + DAY;
        await this.save();
        this.broadcast();
        return json({ room: this.view(player.id) });
      } catch (error) {
        return json({ error: error.message }, 400);
      }
    }
    return json({ error: "NOT_FOUND" }, 404);
  }
  player(name, token) {
    return {
      id: crypto.randomUUID(),
      name: nameOf(name),
      token,
      cash: 100,
      holdings: Object.fromEntries(STOCKS.map((s) => [s.id, 2])),
      protections: 2,
      ready: false,
      locked: false,
      draft: { ...HOLD },
    };
  }
  async action(player, body) {
    const r = this.room;
    if (body.type === "ready" && r.phase === "lobby")
      player.ready = Boolean(body.ready);
    else if (body.type === "start" && r.phase === "lobby") {
      if (player.id !== r.hostId) throw new Error("HOST_ONLY");
      if (r.players.length < 2 || !r.players.every((p) => p.ready))
        throw new Error("PLAYERS_NOT_READY");
      resetMatch(r, random, Date.now());
    } else if (body.type === "draft" && r.phase === "planning") {
      if (player.locked) throw new Error("ORDER_LOCKED");
      player.draft = validateOrder(r, player, body.order);
      if (body.lock) player.locked = true;
      if (r.players.every((p) => p.locked)) resolveRound(r, random, Date.now());
    } else if (body.type === "skip" && r.phase === "reveal") {
      player.skippedRound = r.round;
      if (r.players.every((p) => p.isComputer || p.skippedRound === r.round))
        nextRound(r, Date.now(), random);
    } else if (body.type === "rematch" && r.phase === "ended") {
      if (player.id !== r.hostId) throw new Error("HOST_ONLY");
      if (r.solo) {
        resetMatch(r, random, Date.now());
        return;
      }
      r.phase = "lobby";
      r.round = 0;
      r.deadline = null;
      r.players.forEach((p) => {
        p.ready = false;
        p.locked = false;
        delete p.skippedRound;
      });
    } else if (body.type === "leave" && r.phase === "lobby") {
      r.players = r.players.filter((p) => p.id !== player.id);
      if (r.hostId === player.id) r.hostId = r.players[0]?.id;
      if (!r.players.length) r.expiresAt = Date.now() + 60_000;
    } else throw new Error("INVALID_PHASE");
  }
  webSocketMessage(ws, message) {
    return this.serial(async () => {
      try {
        if (typeof message !== "string" || message.length > 4096)
          return ws.close(1008, "Invalid message");
        const attachment = ws.deserializeAttachment();
        const body = JSON.parse(message);
        if (!attachment.playerId) {
          const player = this.room?.players.find((p) => p.token === body.token);
          if (
            body.type !== "auth" ||
            !player ||
            Date.now() - attachment.connectedAt > 15_000
          )
            return ws.close(1008, "Unauthorized");
          attachment.playerId = player.id;
          ws.serializeAttachment(attachment);
          await this.advance();
          this.broadcast();
        } else if (body.type === "ping")
          ws.send(JSON.stringify({ type: "pong" }));
        else if (
          body.type === "reaction" &&
          ["🐔", "🔥", "😱"].includes(body.emoji)
        ) {
          const now = Date.now();
          if (now - (attachment.lastReaction || 0) < 2000) return;
          attachment.lastReaction = now;
          ws.serializeAttachment(attachment);
          for (const socket of this.ctx.getWebSockets()) {
            try {
              if (socket.deserializeAttachment()?.playerId)
                socket.send(
                  JSON.stringify({
                    type: "reaction",
                    playerId: attachment.playerId,
                    emoji: body.emoji,
                  }),
                );
            } catch {
              /* peer closed */
            }
          }
        }
      } catch {
        ws.close(1008, "Invalid message");
      }
    });
  }
  webSocketClose(ws, code, reason) {
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, reason);
    } catch {
      /* peer already closed */
    }
    if (this.room) this.broadcast();
  }
  webSocketError(ws) {
    ws.close(1011, "Connection error");
  }
  alarm() {
    return this.serial(async () => {
      if (!this.room) {
        await this.ctx.storage.deleteAll();
        return;
      }
      if (Date.now() >= this.room.expiresAt) {
        for (const ws of this.ctx.getWebSockets())
          ws.close(1000, "Room expired");
        await this.ctx.storage.deleteAll();
        this.room = null;
        return;
      }
      await this.advance();
      await this.ctx.storage.setAlarm(
        this.room.deadline || this.room.expiresAt,
      );
    });
  }
}

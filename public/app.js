import { API_ORIGIN } from "./config.js";
const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let lang = localStorage.getItem("cse-language") || "en";
let room = null,
  socket = null,
  connection = "offline",
  retry = null,
  busy = false,
  poll = null;
let timeOffset = 0,
  pending = { action: "hold", stock: "coop", quantity: 1, protection: null },
  draftTimer;
let lastRoundKey = "",
  readySkip = false;
const joinCode =
  new URL(location.href).searchParams
    .get("room")
    ?.toUpperCase()
    .replace(/[^A-Z2-9]/g, "")
    .slice(0, 6) || "";
let session = null;
try {
  session = JSON.parse(localStorage.getItem("cse-session") || "null");
} catch {
  localStorage.removeItem("cse-session");
}
const t = (en, ko) => (lang === "ko" ? ko : en);
const stockName = (stock) => (lang === "ko" ? stock.ko : stock.en);
const money = (value) =>
  `${Number(value).toLocaleString()} ${t("coins", "코인")}`;
const own = () => room?.players.find((p) => p.id === room.viewerId);
const errors = {
  ROOM_NOT_FOUND: [
    "That room has expired or does not exist.",
    "방이 만료되었거나 존재하지 않아요.",
  ],
  ROOM_FULL: ["This room already has four players.", "이미 4명이 모였어요."],
  GAME_ALREADY_STARTED: [
    "This match has started. Ask your friends for a new room.",
    "이미 게임이 시작됐어요. 새 방 코드를 받아주세요.",
  ],
  NOT_ENOUGH_CASH: [
    "You need more coins for that order.",
    "매수에 필요한 코인이 부족해요.",
  ],
  NOT_ENOUGH_SHARES: [
    "You do not own that many shares.",
    "보유한 주식이 부족해요.",
  ],
  NO_SHARES_TO_PROTECT: [
    "Choose a stock you will own after trading.",
    "거래 후 보유할 주식을 선택하세요.",
  ],
  INVALID_PROTECTION: [
    "That protection is unavailable.",
    "해당 보호 카드를 사용할 수 없어요.",
  ],
  STALE_ACTION: [
    "The round changed. Review your next order.",
    "라운드가 바뀌었어요. 주문을 다시 확인하세요.",
  ],
  ORDER_LOCKED: ["Your order is already locked.", "주문이 이미 확정됐어요."],
  UNAUTHORIZED: [
    "Your seat could not be restored. Join the room again.",
    "자리를 복원할 수 없어요. 다시 입장하세요.",
  ],
  DELISTED: ["This stock has been delisted.", "상장폐지된 주식이에요."],
  PLAYERS_NOT_READY: [
    "At least two players must be ready.",
    "최소 2명이 준비해야 해요.",
  ],
};
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
async function api(path, data, method = "POST") {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    ...(method !== "GET" ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "NETWORK_ERROR");
  return result;
}
function showError(error) {
  toast(
    errors[error.message]
      ? t(...errors[error.message])
      : t(
          "Something went wrong. Please try again.",
          "오류가 발생했어요. 다시 시도하세요.",
        ),
  );
}
function adopt(next) {
  timeOffset = next.serverTime - Date.now();
  const key = `${next.match}:${next.round}:${next.phase}`;
  room = next;
  if (key !== lastRoundKey) {
    pending = { ...own().draft };
    readySkip = false;
    lastRoundKey = key;
  } else if (own()?.locked && own().draft) pending = { ...own().draft };
  render();
}
function connect() {
  clearTimeout(retry);
  clearInterval(poll);
  if (socket) {
    socket.onclose = null;
    socket.close();
  }
  connection = "connecting";
  updateConnection();
  const url = new URL(
    `${API_ORIGIN || location.origin}/api/rooms/${session.code}/socket`,
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(url);
  socket.onopen = () =>
    socket.send(JSON.stringify({ type: "auth", token: session.token }));
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "state") {
      connection = "connected";
      adopt(data.room);
      updateConnection();
    }
    if (data.type === "reaction") {
      const player = room.players.find((p) => p.id === data.playerId);
      toast(`${player?.name || ""} ${data.emoji}`);
    }
  };
  socket.onclose = (event) => {
    connection = "offline";
    updateConnection();
    if (event.code === 1008) {
      toast(
        t(
          "Connection could not be authorized. Reload to restore your seat.",
          "연결 인증에 실패했어요. 새로고침하세요.",
        ),
      );
      return;
    }
    if (session) retry = setTimeout(connect, 2000);
  };
  socket.onerror = () => {
    connection = "offline";
    updateConnection();
  };
  // HTTP recovery also catches deadlines while the WebSocket is reconnecting.
  poll = setInterval(async () => {
    if (connection !== "connected" && session) {
      try {
        adopt(
          (await api(`/api/rooms/${session.code}/state`, null, "GET")).room,
        );
      } catch {
        /* retry on next tick */
      }
    }
  }, 5000);
}
function updateConnection() {
  $("#connection").textContent = room
    ? connection === "connected"
      ? t("Connected", "연결됨")
      : connection === "connecting"
        ? t("Connecting…", "연결 중…")
        : t("Reconnecting…", "재연결 중…")
    : "";
  $("#connection").className = connection === "connected" ? "connected" : "";
}
async function action(type, extra = {}) {
  if (busy) return;
  busy = true;
  try {
    adopt(
      (
        await api(`/api/rooms/${room.code}/action`, {
          type,
          match: room.match,
          round: room.round,
          ...extra,
        })
      ).room,
    );
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    render();
  }
}
function saveSession(code, token, name) {
  session = { code, token, name };
  localStorage.setItem("cse-session", JSON.stringify(session));
  localStorage.setItem("cse-name", name);
  history.replaceState(null, "", `?room=${code}`);
}
async function enter(mode) {
  if (busy) return;
  const name = $("#player-name").value.trim();
  const code = $("#room-code").value.trim().toUpperCase();
  if (!name) {
    $("#player-name").focus();
    return toast(t("Choose a player name first.", "먼저 이름을 입력하세요."));
  }
  if (mode === "join" && !/^[A-Z2-9]{6}$/.test(code)) {
    $("#room-code").focus();
    return toast(
      t("Enter the six-character room code.", "6자리 방 코드를 입력하세요."),
    );
  }
  busy = true;
  const token = crypto.randomUUID().replaceAll("-", "");
  try {
    const result = await api(
      mode !== "join" ? "/api/rooms" : `/api/rooms/${code}/join`,
      { name, token, mode },
    );
    saveSession(result.room.code, token, name);
    adopt(result.room);
    connect();
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    render();
  }
}
function mascot(extra = "") {
  return `<div class="mascot-crop ${extra}" aria-hidden="true"><img src="/assets/news-card.png" alt=""></div>`;
}
function home() {
  return `<div class="start-layout"><section class="start-board"><div class="eyebrow">${t("THE MARKET IS OPEN", "시장이 열렸어요")}</div><h1>${t("Good news.<br>Bad news.<br>Your move.", "호재인가요?<br>악재인가요?<br>당신의 선택은?")}</h1><p class="intro">${t("Buy, sell, and outthink your friends.<br>A little luck. A lot of chicken.", "친구들과 사고팔며 전략을 펼쳐보세요.<br>약간의 운, 그리고 꼬꼬의 힘!")}</p><div class="start-stocks"><span>🥚 COOP</span><span>⚡ NEST</span><span>☀️ SUN</span><span>✈️ WING</span></div><div class="start-meta"><span>1–4 ${t("players", "명")}</span><span>12 ${t("rounds", "라운드")}</span><span>${t("Private rooms", "친구끼리 즐기는 방")}</span></div></section><section class="entry-panel"><div class="entry-art"><img src="/assets/news-card.png" alt="${t("Yellow chicken reading good and bad market news", "호재와 악재 뉴스를 읽는 노란 꼬꼬")}" width="936" height="1681"></div><div class="entry-form"><h2>${t("Take your seat.", "자리에 앉아주세요.")}</h2><label for="player-name">${t("Your name", "플레이어 이름")}</label><input id="player-name" autocomplete="nickname" maxlength="20" placeholder="${t("e.g. Sunny", "예: 꼬꼬")}" value="${escape(localStorage.getItem("cse-name") || "")}"><button id="create-room" class="primary full">${t("Create a room", "방 만들기")}</button><button id="play-solo" class="secondary full solo-button">${t("Play vs computer", "컴퓨터와 플레이")}</button><div class="or">${t("or join your friends", "또는 친구 방에 입장")}</div><label class="sr-only" for="room-code">${t("Room code", "방 코드")}</label><div class="join-row"><input id="room-code" maxlength="6" autocomplete="off" placeholder="${t("ROOM CODE", "방 코드")}" value="${escape(joinCode)}"><button id="join-room" class="secondary">${t("Join", "입장")}</button></div><p class="small">${t("Play solo, or invite friends. No account needed.", "혼자 또는 친구들과. 가입 없이 시작해요.")}</p></div></section></div>`;
}
function lobby() {
  const me = own(),
    allReady = room.players.length >= 2 && room.players.every((p) => p.ready);
  return `<div class="lobby-layout"><section class="lobby-main panel"><div class="eyebrow">${t("YOUR PRIVATE TABLE", "우리만의 게임 테이블")}</div><div class="room-heading"><h1>${t("Gather the flock.", "친구들을 모아주세요.")}</h1>${mascot()}</div><div class="room-code-label">${t("ROOM CODE", "방 코드")}</div><div class="code-row"><strong class="room-code">${room.code}</strong><button id="copy-link" class="secondary">${t("Copy invite", "초대 링크 복사")}</button></div><div class="seats">${room.players.map((p, i) => `<div class="seat player-${i}"><span class="avatar">${["🥚", "⚡", "☀️", "✈️"][i]}</span><div><strong>${escape(p.name)} ${p.id === me.id ? `<small>${t("(you)", "(나)")}</small>` : ""}</strong><span>${p.id === room.hostId ? t("Host · ", "방장 · ") : ""}${p.connected ? t("At the table", "접속 중") : t("Reconnecting", "재연결 중")}</span></div><span class="ready-state">${p.ready ? t("READY", "준비 완료") : t("Getting ready", "준비 중")}</span></div>`).join("")}${Array.from({ length: 4 - room.players.length }, () => `<div class="seat empty-seat"><span class="avatar">＋</span><span>${t("A seat for a friend", "친구를 위한 자리")}</span></div>`).join("")}</div><div class="lobby-actions"><button id="ready" class="${me.ready ? "secondary" : "primary"}">${me.ready ? t("Not ready", "준비 취소") : t("I’m ready", "준비 완료")}</button>${me.id === room.hostId ? `<button id="start-game" class="primary" ${!allReady ? "disabled" : ""}>${t("Open the market", "시장 열기")}</button>` : ""}<button id="leave-room" class="quiet">${t("Leave room", "방 나가기")}</button></div><p class="small">${t("Everyone must be ready. At least two players are needed.", "모두 준비하면 시작해요. 최소 2명이 필요해요.")}</p></section><aside class="lobby-aside"><img class="physical-preview" src="/assets/physical-game.png" alt="${t("The original chicken stock-market board game concept", "꼬꼬 주식 보드게임 콘셉트")}"><div class="quick-rules"><h2>${t("A quick briefing", "시작 전 한눈에")}</h2><p>① ${t("Start with 100 coins + 8 shares.", "100코인과 주식 8주로 시작해요.")}</p><p>② ${t("Choose one trade. Keep it secret.", "한 번의 거래를 비밀리에 선택해요.")}</p><p>③ ${t("News + demand + dice move prices.", "뉴스, 수요, 주사위가 가격을 움직여요.")}</p><p>④ ${t("Most wealth after 12 rounds wins.", "12라운드 후 자산이 가장 많으면 승리!")}</p><button class="quiet more-rules">${t("Read all the rules", "전체 규칙 보기")}</button></div></aside></div>`;
}
function chart() {
  const w = 760,
    h = 320,
    left = 40,
    top = 16,
    bottom = 284,
    right = 716;
  const x = (n) => left + (n / 12) * (right - left),
    y = (price) => bottom - (price / 30) * (bottom - top);
  let grid = "";
  for (let i = 0; i <= 30; i += 5)
    grid += `<line x1="${left}" y1="${y(i)}" x2="${right}" y2="${y(i)}" class="grid-line ${i === 0 ? "zero" : ""}"/><text x="27" y="${y(i) + 5}" text-anchor="end">${i}</text>`;
  for (let i = 0; i <= 12; i++)
    grid += `<line x1="${x(i)}" y1="${top}" x2="${x(i)}" y2="${bottom}" class="grid-line vertical"/><text x="${x(i)}" y="309" text-anchor="middle">${i}</text>`;
  const lines = room.stocks
    .map(
      (s) =>
        `<polyline points="${s.history.map((p, i) => `${x(i)},${y(p)}`).join(" ")}" fill="none" stroke="${s.color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(s.history.length - 1)}" cy="${y(s.price)}" r="5" fill="${s.color}" stroke="#fff" stroke-width="2"/>`,
    )
    .join("");
  return `<svg class="market-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${t("Stock price history from rounds zero to twelve. Current values are listed below.", "0~12라운드 주가 차트. 현재 가격은 아래에 표시됩니다.")}">${grid}${lines}<text x="751" y="20" text-anchor="end">🐔</text><text x="751" y="${y(15)}" text-anchor="end">🐣</text><text x="751" y="${y(0)}" text-anchor="end">⚠</text></svg>`;
}
function diceFace(value, color) {
  const spots = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  return `<div class="die ${color}" aria-label="${t(color === "red" ? "Red die" : "Blue die", color === "red" ? "빨간 주사위" : "파란 주사위")}: ${value}">${Array.from({ length: 9 }, (_, i) => `<span class="${spots[value].includes(i) ? "pip" : ""}"></span>`).join("")}</div>`;
}
function eventText(event) {
  const target =
    event.target === "all"
      ? t("The whole market", "전체 시장")
      : stockName(room.stocks.find((s) => s.id === event.target));
  const positive = event.effect > 0;
  return {
    heading: t(
      positive ? "Good news!" : "Bad news!",
      positive ? "호재 발생!" : "악재 발생!",
    ),
    body: `${target} ${event.effect > 0 ? "+" : "−"}${Math.abs(event.effect)} ${t("coins", "코인")}`,
  };
}
function recapPanel(recap) {
  const news = eventText(recap.event);
  return `<section class="recap-panel panel ${room.phase === "reveal" ? "is-reveal" : ""}"><div class="recap-art"><img src="/assets/news-card.png" alt="Good News / Bad News"></div><div class="recap-main"><div class="eyebrow">${t("ROUND", "라운드")} ${recap.round} ${t("RECAP", "결과")}</div><h2>${news.heading}</h2><p>${escape(news.body)}</p><div class="dice-row">${diceFace(recap.dice[0], "red")}${diceFace(recap.dice[1], "blue")}<span>${t("Market", "시장")} <strong>${recap.market > 0 ? "+" : ""}${recap.market}</strong></span></div><div class="movement-row">${recap.movements.map((m) => `<span style="--stock-color:${room.stocks.find((s) => s.id === m.stock).color}"><b>${room.stocks.find((s) => s.id === m.stock).ticker}</b> ${m.before} → ${m.after}<small>${t("News", "뉴스")} ${m.news > 0 ? "+" : ""}${m.news} · ${t("Demand", "수요")} ${m.demand > 0 ? "+" : ""}${m.demand}${m.delisted ? ` · ${t("DELISTED", "상장폐지")}` : ""}</small></span>`).join("")}</div>${room.phase === "reveal" ? `<button id="skip-reveal" class="secondary" ${readySkip ? "disabled" : ""}>${readySkip ? t("Waiting for friends…", "친구를 기다리는 중…") : t("Ready for next round", "다음 라운드 준비")}</button>` : ""}</div></section>`;
}
function game() {
  const me = own(),
    recap = room.recaps.at(-1),
    hint =
      room.hint === "all"
        ? t("Whole market", "전체 시장")
        : room.stocks.find((s) => s.id === room.hint);
  const disabled = room.phase !== "planning" || me.locked || busy;
  return `<div class="game-top"><div><div class="eyebrow">${room.solo ? t("VS COMPUTER", "컴퓨터 대전") : t("PRIVATE TABLE", "우리의 테이블")} · ${room.code}</div><h1>${room.phase === "ended" ? t("The closing bell.", "장이 마감됐어요.") : t("Make your move.", "당신의 선택은?")}</h1></div><div class="round-box"><span>${t("ROUND", "라운드")}</span><strong>${room.round}<small> / 12</small></strong><span id="timer" class="timer"></span></div></div>
  <div class="players-strip" style="--players:${room.players.length}">${room.players.map((p, i) => `<div class="player-card player-${i} ${p.id === me.id ? "you" : ""}"><div class="player-name"><span>${["🥚", "⚡", "☀️", "✈️"][i]}</span><strong>${p.isComputer && lang === "ko" ? "캡틴 꼬꼬" : escape(p.name)}</strong>${p.isComputer ? `<small>${t("CPU", "컴퓨터")}</small>` : ""}${p.id === me.id ? `<small>${t("YOU", "나")}</small>` : ""}</div><div class="player-value">${p.score}<small>${t("total", "총자산")}</small></div><div class="player-meta"><span>${money(p.cash)}</span><span>🍗 × ${p.protections}</span></div><div class="holding-row">${room.stocks.map((s) => `<span style="--stock-color:${s.color}" title="${escape(stockName(s))}">${s.ticker} <b>${p.holdings[s.id]}</b></span>`).join("")}</div><div class="player-state">${room.phase === "planning" ? (p.locked ? t("✓ Order locked", "✓ 주문 확정") : t("Choosing a trade…", "주문 선택 중…")) : t("At the table", "참여 중")}${!p.connected ? ` · ${t("offline", "연결 끊김")}` : ""}</div></div>`).join("")}</div>
  ${room.phase === "ended" ? results() : ""}
  <div class="game-layout"><section class="market panel"><div class="section-heading"><h2>${t("The market board", "주가 보드")}</h2><span>${t("COINS / SHARE", "코인 / 1주")}</span></div>${chart()}<div class="stock-tiles">${room.stocks.map((s) => `<button class="stock-tile ${pending.stock === s.id ? "selected" : ""} ${s.delisted ? "delisted" : ""}" data-stock="${s.id}" style="--stock-color:${s.color}" ${disabled || s.delisted ? "disabled" : ""}><div><span class="stock-icon">${s.icon}</span><b>${s.ticker}</b><strong>${s.price}</strong></div><span>${escape(stockName(s))}</span><small>${s.delisted ? t("DELISTED", "상장폐지") : `${me.holdings[s.id]} ${t("shares owned", "주 보유")}`}</small></button>`).join("")}</div><div class="delisting-band">${t("DELISTING ZONE · 0 COINS", "상장폐지 구역 · 0코인")}</div></section>
  <aside class="trading-panel panel"><div class="section-heading"><h2>${t("Trading card", "트레이딩 카드")}</h2><span class="panel-number">${room.players.findIndex((p) => p.id === me.id) + 1}</span></div>${room.phase === "planning" ? `<div class="news-hint"><span>${t("NEXT NEWS TARGET", "다음 뉴스 대상")}</span><strong>${typeof hint === "string" ? hint : escape(stockName(hint))}</strong><small>${t("Direction and strength stay hidden.", "방향과 강도는 아직 비밀이에요.")}</small></div>` : `<div class="news-hint"><strong>${room.phase === "ended" ? t("Market closed", "시장 마감") : t("News is out!", "뉴스 공개!")}</strong><small>${t("All trades used the previous prices.", "모든 거래는 이전 가격으로 체결됐어요.")}</small></div>`}<div class="action-tabs" role="group" aria-label="${t("Trade action", "거래 유형")}">${["buy", "sell", "hold"].map((a) => `<button data-action="${a}" class="${pending.action === a ? "active" : ""}" aria-pressed="${pending.action === a}" ${disabled ? "disabled" : ""}>${t(a.toUpperCase(), { buy: "매수", sell: "매도", hold: "관망" }[a])}</button>`).join("")}</div><label for="trade-stock">${t("Stock", "종목")}</label><select id="trade-stock" ${disabled || pending.action === "hold" ? "disabled" : ""}>${room.stocks.map((s) => `<option value="${s.id}" ${pending.stock === s.id ? "selected" : ""} ${s.delisted ? "disabled" : ""}>${escape(stockName(s))} · ${s.price}${s.delisted ? ` · ${t("Delisted", "상장폐지")}` : ""}</option>`).join("")}</select><div class="quantity-row"><label>${t("Shares", "수량")}</label><div class="quantity-buttons" role="group" aria-label="${t("Number of shares", "주식 수량")}">${[1, 2, 3].map((q) => `<button data-quantity="${q}" aria-pressed="${pending.quantity === q}" class="${pending.quantity === q ? "active" : ""}" ${disabled || pending.action === "hold" ? "disabled" : ""}>${q}</button>`).join("")}</div></div><div class="trade-total"><span>${pending.action === "buy" ? t("You pay", "지불액") : pending.action === "sell" ? t("You receive", "수령액") : t("Keep your position", "보유 자산 유지")}</span><strong>${pending.action === "hold" ? "—" : money(room.stocks.find((s) => s.id === pending.stock).price * pending.quantity)}</strong></div><div class="protection-box"><label for="protection">🍗 ${t("Roast-chicken protection", "치킨 보호 카드")} <small>× ${me.protections}</small></label><select id="protection" ${disabled || me.protections === 0 ? "disabled" : ""}><option value="">${t("Save my card", "카드 아끼기")}</option>${room.stocks
    .filter((s) => !s.delisted)
    .map(
      (s) =>
        `<option value="${s.id}" ${pending.protection === s.id ? "selected" : ""}>${t("Protect", "보호:")} ${escape(stockName(s))}</option>`,
    )
    .join(
      "",
    )}</select><p>${t("Pays back a price drop on shares held after trading. Used even if prices rise.", "거래 후 보유 주식의 가격 하락분을 보상해요. 가격이 올라도 소모돼요.")}</p></div><button id="lock-order" class="primary full" ${disabled ? "disabled" : ""}>${me.locked ? t("✓ Order locked", "✓ 주문 확정") : room.phase === "planning" ? t("Lock my order", "주문 확정") : t("Trading paused", "거래 대기")}</button><p id="draft-status" class="small">${me.locked ? t("Your decision is final this round.", "이번 라운드의 주문은 확정됐어요.") : t("Valid drafts are saved. At the deadline, your saved order executes.", "유효한 주문은 저장돼요. 시간이 끝나면 저장된 주문이 체결돼요.")}</p></aside></div>
  ${recap ? recapPanel(recap) : `<div class="first-round-note">${mascot("small-mascot")}<p>${t("Watch the news target. Make a trade.<br>Keep your plans to yourself.", "뉴스 대상을 확인하고 거래를 선택하세요.<br>계획은 비밀로!")}</p></div>`}
  <div class="below-board"><section class="activity panel"><div class="section-heading"><h2>${t("Market journal", "시장 기록")}</h2><span>${room.discards.length} / 30 ${t("cards revealed", "장 공개")}</span></div>${
    room.recaps.length
      ? `<details><summary>${t("Show orders and settlements", "주문 및 정산 내역 보기")}</summary>${[
          ...room.recaps,
        ]
          .reverse()
          .map(
            (r) =>
              `<div class="journal-round"><strong>${t("Round", "라운드")} ${r.round} · ${escape(eventText(r.event).body)}</strong>${r.trades.map((tr) => `<p><b>${escape(tr.name)}</b> · ${tr.action === "hold" ? t("HOLD", "관망") : `${t(tr.action.toUpperCase(), tr.action === "buy" ? "매수" : "매도")} ${tr.quantity} ${room.stocks.find((s) => s.id === tr.stock).ticker} @ ${tr.price}`}${tr.protection ? ` · 🍗 ${room.stocks.find((s) => s.id === tr.protection).ticker} +${tr.compensation}` : ""}</p>`).join("")}</div>`,
          )
          .join("")}</details>`
      : `<p class="small">${t("Revealed cards and completed trades appear here.", "공개된 카드와 완료된 거래가 여기에 표시돼요.")}</p>`
  }</section><div class="reaction-panel"><span>${t("Table reactions", "테이블 리액션")}</span><div>${["🐔", "🔥", "😱"].map((e) => `<button data-reaction="${e}" aria-label="${t("Send reaction", "리액션 보내기")} ${e}">${e}</button>`).join("")}</div><button id="copy-link" class="quiet">${t("Copy room link", "방 링크 복사")}</button></div></div>`;
}
function results() {
  const sorted = [...room.players].sort((a, b) => b.score - a.score),
    highest = sorted[0].score;
  const winners = sorted
    .filter((p) => p.score === highest)
    .map((p) => p.name)
    .join(" & ");
  return `<section class="results"><div><div class="eyebrow">${t("THE WINNING FLOCK", "오늘의 우승자")}</div><h2>🏆 ${escape(winners)}</h2><p>${t("Cash + final share value. Equal scores share the win.", "현금 + 최종 주식 가치. 동점이면 공동 우승이에요.")}</p></div><ol>${sorted.map((p) => `<li><span>${escape(p.name)}</span><strong>${money(p.score)}</strong></li>`).join("")}</ol>${own().id === room.hostId ? `<button id="rematch" class="primary">${t("Play again", "다시 하기")}</button>` : `<p>${t("Your host can start a rematch.", "방장이 다시 시작할 수 있어요.")}</p>`}</section>`;
}
function render() {
  document.documentElement.lang = lang;
  $("#language").textContent = lang === "en" ? "한국어" : "English";
  $("#rules-button").textContent = t("How to play", "게임 방법");
  $("#footer-copy").textContent = t(
    "Fictional stocks. Real friends.",
    "가상의 주식, 진짜 친구들과.",
  );
  const focused = document.activeElement,
    focusId = focused?.id;
  const inputState = ["player-name", "room-code"].includes(focusId)
    ? { value: focused.value, start: focused.selectionStart }
    : null;
  const journalOpen = $(".activity details")?.open;
  $("#app").innerHTML = !room
    ? home()
    : room.phase === "lobby"
      ? lobby()
      : game();
  if (journalOpen && $(".activity details")) $(".activity details").open = true;
  if (!inputState && focusId && $(`#${focusId}`) && !$(`#${focusId}`).disabled)
    $(`#${focusId}`).focus({ preventScroll: true });
  if (inputState && $(`#${focusId}`)) {
    const input = $(`#${focusId}`);
    input.value = inputState.value;
    input.focus();
    input.setSelectionRange(inputState.start, inputState.start);
  }
  $("#create-room")?.addEventListener("click", () => enter("create"));
  $("#play-solo")?.addEventListener("click", () => enter("solo"));
  $("#join-room")?.addEventListener("click", () => enter("join"));
  $("#room-code")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "");
  });
  $("#room-code")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") enter("join");
  });
  $("#player-name")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") enter(joinCode ? "join" : "create");
  });
  $("#copy-link")?.addEventListener("click", copyLink);
  $("#ready")?.addEventListener("click", () =>
    action("ready", { ready: !own().ready }),
  );
  $("#start-game")?.addEventListener("click", () => action("start"));
  $("#leave-room")?.addEventListener("click", leave);
  $(".more-rules")?.addEventListener("click", showRules);
  $("#rematch")?.addEventListener("click", () => action("rematch"));
  document
    .querySelectorAll("[data-stock]")
    .forEach((el) =>
      el.addEventListener("click", () =>
        changeDraft({ stock: el.dataset.stock }),
      ),
    );
  document
    .querySelectorAll("[data-action]")
    .forEach((el) =>
      el.addEventListener("click", () =>
        changeDraft({ action: el.dataset.action }),
      ),
    );
  document
    .querySelectorAll("[data-quantity]")
    .forEach((el) =>
      el.addEventListener("click", () =>
        changeDraft({ quantity: Number(el.dataset.quantity) }),
      ),
    );
  $("#trade-stock")?.addEventListener("change", (e) =>
    changeDraft({ stock: e.target.value }),
  );
  $("#protection")?.addEventListener("change", (e) =>
    changeDraft({ protection: e.target.value || null }),
  );
  $("#lock-order")?.addEventListener("click", () => {
    clearTimeout(draftTimer);
    draftTimer = null;
    action("draft", { order: pending, lock: true });
  });
  $("#skip-reveal")?.addEventListener("click", async () => {
    readySkip = true;
    await action("skip");
  });
  document.querySelectorAll("[data-reaction]").forEach((el) =>
    el.addEventListener("click", () => {
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(
          JSON.stringify({ type: "reaction", emoji: el.dataset.reaction }),
        );
    }),
  );
  updateConnection();
  tick();
}
function changeDraft(update) {
  pending = { ...pending, ...update };
  clearTimeout(draftTimer);
  draftTimer = setTimeout(async () => {
    const order = { ...pending };
    draftTimer = null;
    try {
      const result = await api(`/api/rooms/${room.code}/action`, {
        type: "draft",
        match: room.match,
        round: room.round,
        order,
      });
      adopt(result.room);
    } catch (error) {
      showError(error);
      if ($("#draft-status"))
        $("#draft-status").textContent = t(
          "Draft not saved. Adjust your order.",
          "주문이 저장되지 않았어요. 주문을 수정하세요.",
        );
    }
  }, 250);
  render();
  if ($("#draft-status"))
    $("#draft-status").textContent = t("Saving draft…", "주문 저장 중…");
}
function tick() {
  const timer = $("#timer");
  if (!timer || !room) return;
  if (!room.deadline) {
    timer.textContent = t("CLOSED", "마감");
    return;
  }
  const seconds = Math.max(
    0,
    Math.ceil((room.deadline - Date.now() - timeOffset) / 1000),
  );
  timer.textContent =
    room.phase === "planning"
      ? `${seconds}s`
      : `${t("Next round", "다음 라운드")} · ${seconds}s`;
  timer.classList.toggle("urgent", room.phase === "planning" && seconds <= 10);
}
async function copyLink() {
  try {
    await navigator.clipboard.writeText(
      `${location.origin}/?room=${room.code}`,
    );
    toast(t("Invite link copied.", "초대 링크를 복사했어요."));
  } catch {
    toast(`${t("Room code", "방 코드")}: ${room.code}`);
  }
}
async function leave() {
  try {
    await api(`/api/rooms/${room.code}/action`, {
      type: "leave",
      match: room.match,
      round: room.round,
    });
  } catch (error) {
    showError(error);
    return;
  }
  session = null;
  room = null;
  localStorage.removeItem("cse-session");
  clearTimeout(retry);
  clearInterval(poll);
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  history.replaceState(null, "", "/");
  render();
}
function showRules() {
  $("#rules-title").textContent = t(
    "A little market wisdom.",
    "꼬꼬의 주식 수업",
  );
  const rules = [
    [
      t("Your starting nest egg", "시작 자산"),
      t(
        "100 coins, two shares of each of four stocks, and two protection cards. Every stock starts at 10 coins.",
        "100코인, 네 종목 각각 2주, 보호 카드 2장으로 시작해요. 시작 주가는 모두 10코인이에요.",
      ),
    ],
    [
      t("One secret decision", "비밀 주문 하나"),
      t(
        "Each round lasts up to 60 seconds. Buy or sell 1–3 shares of one stock, or hold. Trades execute at the prices shown before news. No loans or short selling. All trading is with an unlimited bank.",
        "라운드마다 최대 60초 동안 한 종목을 1~3주 매수·매도하거나 관망해요. 뉴스 공개 전 가격으로 거래해요. 대출과 공매도는 없고, 은행과 거래하므로 주식 수량 제한은 없어요.",
      ),
    ],
    [
      t("What moves prices", "주가 변동"),
      t(
        "News: −3 to +3 for its target. Demand: +1 if more shares were bought, −1 if more were sold. Dice: +1 if red wins, −1 if blue wins, 0 on a tie. Add the three effects, then cap prices at 0–30.",
        "뉴스: 대상 종목에 −3~+3. 수요: 매수가 많으면 +1, 매도가 많으면 −1. 주사위: 빨강이 크면 +1, 파랑이 크면 −1, 같으면 0. 세 효과를 더하며 주가는 0~30 범위예요.",
      ),
    ],
    [
      t("Read the signs", "힌트 읽기"),
      t(
        "The next news target is public; direction and strength are secret. The 30-card deck has −3, −2, −1, +1, +2, +3 for each stock and the whole market. Discarded cards and all portfolios are public.",
        "다음 뉴스 대상은 공개하지만 방향과 강도는 비밀이에요. 30장 덱에는 각 종목과 전체 시장에 대한 −3, −2, −1, +1, +2, +3 카드가 있어요. 사용된 카드와 모든 자산은 공개돼요.",
      ),
    ],
    [
      t("Your chicken safety net", "치킨 보호 카드"),
      t(
        "Before news, spend one card to protect one stock. The bank repays its actual price drop times the shares you hold after trading. Protection lasts one round and is spent even if prices rise. You need shares remaining to protect.",
        "뉴스 공개 전 한 종목에 보호 카드 1장을 사용해요. 실제 하락액 × 거래 후 보유 수량만큼 은행이 보상해요. 한 라운드만 적용되며 가격이 올라도 소모돼요. 보호할 주식을 보유해야 해요.",
      ),
    ],
    [
      t("Delisting and the closing bell", "상장폐지와 마감"),
      t(
        "At zero, a stock is permanently delisted and shares become worthless. Protection pays before shares are removed. After 12 rounds—or when all stocks delist—highest cash plus share value wins. Ties share victory.",
        "0코인이면 영구 상장폐지되어 보유 주식이 사라져요. 보호 보상은 주식 제거 전에 지급돼요. 12라운드 또는 전 종목 상장폐지 시 종료하며, 현금과 주식 가치 합계가 가장 높으면 우승해요. 동점은 공동 우승이에요.",
      ),
    ],
    [
      t("Lock, disconnect, reconnect", "확정과 재접속"),
      t(
        "Locking is final. All locked players advance the round early. At the deadline, your latest valid saved draft executes; otherwise you hold. Refresh or return on the same browser to restore your seat. Rooms expire after 24 hours of inactivity.",
        "확정한 주문은 변경할 수 없어요. 모두 확정하면 바로 진행해요. 시간 종료 시 마지막 유효한 저장 주문을 체결하며 없으면 관망해요. 같은 브라우저로 돌아오면 자리가 복원돼요. 방은 24시간 비활동 후 만료돼요.",
      ),
    ],
  ];
  $("#rules-content").innerHTML = rules
    .map(
      ([heading, text]) =>
        `<section><h3>${heading}</h3><p>${text}</p></section>`,
    )
    .join("");
  $("#rules-done").textContent = t(
    "Got it. Let’s trade.",
    "알겠어요. 거래 시작!",
  );
  $("#rules-dialog").showModal();
}
$("#rules-button").addEventListener("click", showRules);
$("#close-rules").addEventListener("click", () => $("#rules-dialog").close());
$("#rules-done").addEventListener("click", () => $("#rules-dialog").close());
$("#language").addEventListener("click", () => {
  lang = lang === "en" ? "ko" : "en";
  localStorage.setItem("cse-language", lang);
  render();
  if ($("#rules-dialog").open) {
    $("#rules-dialog").close();
    showRules();
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && session && socket?.readyState !== WebSocket.OPEN)
    connect();
});
setInterval(tick, 250);
render();
if (session && (!joinCode || joinCode === session.code)) {
  try {
    adopt((await api(`/api/rooms/${session.code}/state`, null, "GET")).room);
    connect();
  } catch (error) {
    localStorage.removeItem("cse-session");
    session = null;
    showError(error);
  }
}

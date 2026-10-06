import { API_ORIGIN } from "./config.js";
import { MAX_TRADE, maxShares, orderError } from "./order.js";
import { renderChart } from "./board.js";
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
let draftState = "saved",
  draftError = "",
  draftRevision = 0;
let draftQueue = Promise.resolve();
let chartView = "history",
  inspectedRound = null;
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
  if (room?.code === next.code && (next.revision || 0) < (room.revision || 0))
    return;
  timeOffset = next.serverTime - Date.now();
  const key = `${next.match}:${next.round}:${next.phase}`;
  room = next;
  if (key !== lastRoundKey) {
    clearTimeout(draftTimer);
    draftTimer = null;
    draftRevision++;
    pending = { ...own().draft };
    draftState = own().locked ? "locked" : "saved";
    draftError = "";
    readySkip = false;
    lastRoundKey = key;
    inspectedRound = null;
  } else if (own()?.locked && own().draft) {
    pending = { ...own().draft };
    draftState = "locked";
    draftError = "";
  } else if (draftState === "saving" && sameOrder(own().draft, pending))
    draftState = "saved";
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
        const code = session.code;
        const result = await api(`/api/rooms/${code}/state`, null, "GET");
        if (session?.code === code) adopt(result.room);
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
  localStorage.setItem(`cse-seat-${code}`, token);
  localStorage.removeItem("cse-resume");
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
  const token =
    (mode === "join" && localStorage.getItem(`cse-seat-${code}`)) ||
    crypto.randomUUID().replaceAll("-", "");
  try {
    const result = await api(
      mode !== "join" ? "/api/rooms" : `/api/rooms/${code}/join`,
      { name, token, mode, seconds: Number($("#solo-timer")?.value ?? 60) },
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
  return `<div class="start-layout"><section class="start-board"><div class="eyebrow">${t("THE MARKET IS OPEN", "시장이 열렸어요")}</div><h1>${t("Good news.<br>Bad news.<br>Your move.", "호재인가요?<br>악재인가요?<br>당신의 선택은?")}</h1><p class="intro">${t("Buy, sell, and outthink your friends.<br>A little luck. A lot of chicken.", "친구들과 사고팔며 전략을 펼쳐보세요.<br>약간의 운, 그리고 꼬꼬의 힘!")}</p><div class="start-stocks"><span>🥚 COOP</span><span>⚡ NEST</span><span>☀️ SUN</span><span>✈️ WING</span></div><div class="start-meta"><span>1–4 ${t("players", "명")}</span><span>12 ${t("rounds", "라운드")}</span><span>${t("Private rooms", "친구끼리 즐기는 방")}</span></div></section><section class="entry-panel"><div class="entry-art"><img src="/assets/news-card.png" alt="${t("Yellow chicken reading good and bad market news", "호재와 악재 뉴스를 읽는 노란 꼬꼬")}" width="936" height="1681"></div><div class="entry-form"><h2>${t("Take your seat.", "자리에 앉아주세요.")}</h2><label for="player-name">${t("Your name", "플레이어 이름")}</label><input id="player-name" autocomplete="nickname" maxlength="20" placeholder="${t("e.g. Sunny", "예: 꼬꼬")}" value="${escape(localStorage.getItem("cse-name") || "")}"><button id="create-room" class="primary full">${t("Create a room", "방 만들기")}</button><button id="play-solo" class="secondary full solo-button">${t("Play vs computer", "컴퓨터와 플레이")}</button><div class="home-timer"><label for="solo-timer">${t("Solo timer", "솔로 타이머")}</label><select id="solo-timer"><option value="60">60 ${t("seconds", "초")}</option><option value="120">120 ${t("seconds", "초")}</option><option value="0">${t("No timer", "시간 제한 없음")}</option></select></div>${localStorage.getItem("cse-resume") ? `<button id="resume-table" class="quiet full">${t("Resume previous table", "이전 게임 이어하기")}</button>` : ""}<div class="or">${t("or join your friends", "또는 친구 방에 입장")}</div><label class="sr-only" for="room-code">${t("Room code", "방 코드")}</label><div class="join-row"><input id="room-code" maxlength="6" autocomplete="off" placeholder="${t("ROOM CODE", "방 코드")}" value="${escape(joinCode)}"><button id="join-room" class="secondary">${t("Join", "입장")}</button></div><p class="small">${t("Play solo, or invite friends. No account needed.", "혼자 또는 친구들과. 가입 없이 시작해요.")}</p></div></section></div>`;
}
function lobby() {
  const me = own(),
    allReady = room.players.length >= 2 && room.players.every((p) => p.ready);
  return `<div class="lobby-layout"><section class="lobby-main panel"><div class="eyebrow">${t("YOUR PRIVATE TABLE", "우리만의 게임 테이블")}</div><div class="room-heading"><h1>${t("Gather the flock.", "친구들을 모아주세요.")}</h1>${mascot()}</div><div class="room-code-label">${t("ROOM CODE", "방 코드")}</div><div class="code-row"><strong class="room-code">${room.code}</strong><button id="copy-link" class="secondary">${t("Copy invite", "초대 링크 복사")}</button></div><div class="seats">${room.players.map((p, i) => `<div class="seat player-${i}"><span class="avatar">${["🥚", "⚡", "☀️", "✈️"][i]}</span><div><strong>${escape(p.name)} ${p.id === me.id ? `<small>${t("(you)", "(나)")}</small>` : ""}</strong><span>${p.id === room.hostId ? t("Host · ", "방장 · ") : ""}${p.connected ? t("At the table", "접속 중") : t("Reconnecting", "재연결 중")}</span></div><span class="ready-state">${p.ready ? t("READY", "준비 완료") : t("Getting ready", "준비 중")}</span></div>`).join("")}${Array.from({ length: 4 - room.players.length }, () => `<div class="seat empty-seat"><span class="avatar">＋</span><span>${t("A seat for a friend", "친구를 위한 자리")}</span></div>`).join("")}</div><div class="lobby-actions"><button id="ready" class="${me.ready ? "secondary" : "primary"}">${me.ready ? t("Not ready", "준비 취소") : t("I’m ready", "준비 완료")}</button>${me.id === room.hostId ? `<button id="start-game" class="primary" ${!allReady ? "disabled" : ""}>${t("Open the market", "시장 열기")}</button>` : ""}<button id="leave-room" class="quiet">${t("Leave room", "방 나가기")}</button></div><p class="small">${t("Everyone must be ready. At least two players are needed.", "모두 준비하면 시작해요. 최소 2명이 필요해요.")}</p></section><aside class="lobby-aside"><img class="physical-preview" src="/assets/physical-game.png" alt="${t("The original chicken stock-market board game concept", "꼬꼬 주식 보드게임 콘셉트")}"><div class="quick-rules"><h2>${t("A quick briefing", "시작 전 한눈에")}</h2><p>① ${t("Start with 100 coins + 8 shares.", "100코인과 주식 8주로 시작해요.")}</p><p>② ${t("Choose one trade. Keep it secret.", "한 번의 거래를 비밀리에 선택해요.")}</p><p>③ ${t("News + demand + dice move prices.", "뉴스, 수요, 주사위가 가격을 움직여요.")}</p><p>④ ${t("Most wealth after 12 rounds wins.", "12라운드 후 자산이 가장 많으면 승리!")}</p><button class="quiet more-rules">${t("Read all the rules", "전체 규칙 보기")}</button></div></aside></div>`;
}
function chart() {
  return (
    renderChart(room, chartView, lang) +
    '<div id="chart-inspection" class="chart-inspection" aria-live="polite"></div>'
  );
}
function inspectRound(round) {
  if (!room || !$("#chart-inspection")) return;
  inspectedRound = Number(round);
  $("#chart-inspection").innerHTML =
    `<strong>${t("Round", "라운드")} ${inspectedRound}</strong>` +
    room.stocks
      .map((s) => {
        const value = s.history[inspectedRound],
          change = inspectedRound ? value - s.history[inspectedRound - 1] : 0;
        return `<span><b>${s.ticker}</b> ${value} <small>${change > 0 ? "+" : ""}${change}</small></span>`;
      })
      .join("");
  if ($("#chart-round")) $("#chart-round").value = inspectedRound;
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
  const headlines = {
    coop: positive
      ? ["Coop Foods is the talk of the town", "꼬꼬푸드, 인기 메뉴로 화제"]
      : ["Coop Foods faces a supply shortage", "꼬꼬푸드, 원재료 공급 부족"],
    nest: positive
      ? ["Nest Tech unveils a hit gadget", "네스트테크, 신제품 흥행"]
      : ["Nest Tech delays its next launch", "네스트테크, 신제품 출시 지연"],
    sun: positive
      ? ["Sunny Energy wins a major contract", "써니에너지, 대형 계약 수주"]
      : ["Storms disrupt Sunny Energy", "써니에너지, 폭풍으로 운영 차질"],
    wing: positive
      ? ["Feather Travel bookings take off", "페더여행, 예약 급증"]
      : ["Feather Travel faces cancellations", "페더여행, 예약 취소 증가"],
    all: positive
      ? ["Confidence returns to the market", "시장에 돌아온 투자 자신감"]
      : ["Uncertainty shakes the market", "불확실성에 흔들리는 시장"],
  };
  return {
    heading: t(...headlines[event.target]),
    badge: t(positive ? "GOOD NEWS" : "BAD NEWS", positive ? "호재" : "악재"),
    positive,
    body: `${target} ${event.effect > 0 ? "+" : "−"}${Math.abs(event.effect)} ${t("coins", "코인")}`,
  };
}
function recapPanel(recap) {
  const news = eventText(recap.event);
  const settlement = recap.settlements?.find(
    (s) => s.playerId === room.viewerId,
  );
  const personal = settlement
    ? `<div class="personal-settlement ${settlement.delta < 0 ? "loss" : "gain"}">${t("Your portfolio", "내 총자산")} <strong>${settlement.delta > 0 ? "+" : ""}${settlement.delta} ${t("coins", "코인")}</strong><span>${settlement.before} → ${settlement.after}</span></div>`
    : "";
  return `<section class="recap-panel panel ${room.phase === "reveal" ? "is-reveal" : ""}"><div class="recap-art"><img src="/assets/news-card.png" alt="Good News / Bad News"></div><div class="recap-main"><div class="eyebrow">${t("ROUND", "라운드")} ${recap.round} ${t("RECAP", "결과")}</div><span class="news-badge ${news.positive ? "positive" : "negative"}">${news.badge}</span><h2>${news.heading}</h2><p>${escape(news.body)}</p>${personal}<div class="dice-row">${diceFace(recap.dice[0], "red")}${diceFace(recap.dice[1], "blue")}<span>${t("Market", "시장")} <strong>${recap.market > 0 ? "+" : ""}${recap.market}</strong></span></div><div class="movement-row">${recap.movements.map((m) => `<span style="--stock-color:${room.stocks.find((s) => s.id === m.stock).color}"><b>${room.stocks.find((s) => s.id === m.stock).ticker}</b> ${m.before} → ${m.after}<small>${t("News", "뉴스")} ${m.news > 0 ? "+" : ""}${m.news} · ${t("Demand", "수요")} ${m.demand > 0 ? "+" : ""}${m.demand}${m.delisted ? ` · ${t("DELISTED", "상장폐지")}` : ""}</small></span>`).join("")}</div>${room.phase === "reveal" ? `<button id="skip-reveal" class="secondary" ${readySkip ? "disabled" : ""}>${readySkip ? t("Waiting for friends…", "친구를 기다리는 중…") : t("Ready for next round", "다음 라운드 준비")}</button>` : ""}</div></section>`;
}
function tradePanel() {
  const me = own(),
    phase = room.phase === "planning",
    stock = room.stocks.find((s) => s.id === pending.stock);
  const disabled = !phase || me.locked || busy || connection !== "connected";
  const error = orderError(room.stocks, me, pending);
  const max = maxShares(room.stocks, me, pending.action, pending.stock);
  const cost = pending.action === "hold" ? 0 : pending.quantity * stock.price;
  const valid = !error;
  const afterCash =
    me.cash +
    (pending.action === "buy" ? -cost : pending.action === "sell" ? cost : 0);
  const afterShares =
    me.holdings[stock.id] +
    (pending.action === "buy"
      ? pending.quantity
      : pending.action === "sell"
        ? -pending.quantity
        : 0);
  const hint =
    room.hint === "all"
      ? t("Whole market", "전체 시장")
      : room.stocks.find((s) => s.id === room.hint);
  const status = me.locked
    ? t("LOCKED · final for this round", "확정 · 이번 라운드 최종 주문")
    : draftState === "saving"
      ? t("SAVING · wait for confirmation", "저장 중 · 확인을 기다려주세요")
      : draftState === "invalid" || draftState === "error"
        ? t("NOT SAVED · previous order remains", "저장 실패 · 이전 주문 유지")
        : t("SAVED · ready to execute", "저장됨 · 체결 준비 완료");
  const message =
    draftError && errors[draftError]
      ? t(...errors[draftError])
      : error && errors[error]
        ? t(...errors[error])
        : "";
  return `<aside class="trading-panel panel"><div class="section-heading"><h2>${t("Your trade", "내 거래")}</h2><span id="trade-timer" class="timer"></span></div>
    ${phase ? `<div class="news-hint"><span>${t("NEXT NEWS TARGET", "다음 뉴스 대상")}</span><strong>${typeof hint === "string" ? hint : escape(stockName(hint))}</strong><small>${t("Direction and strength stay hidden.", "방향과 강도는 아직 비밀이에요.")}</small></div>` : `<div class="news-hint"><strong>${t(room.phase === "ended" ? "Market closed" : "News is out!", room.phase === "ended" ? "시장 마감" : "뉴스 공개!")}</strong></div>`}
    <div class="action-tabs" role="group" aria-label="${t("Trade action", "거래 유형")}">${[
      "buy",
      "sell",
      "hold",
    ]
      .map((a) => {
        const available =
          a === "hold" || maxShares(room.stocks, me, a, pending.stock) > 0;
        return `<button data-action="${a}" class="${pending.action === a ? "active" : ""}" aria-pressed="${pending.action === a}" ${disabled || !available ? "disabled" : ""}>${t(a.toUpperCase(), { buy: "매수", sell: "매도", hold: "관망" }[a])}</button>`;
      })
      .join("")}</div>
    <label for="trade-stock">${t("Stock", "종목")}</label><select id="trade-stock" ${disabled || pending.action === "hold" ? "disabled" : ""}>${room.stocks.map((s) => `<option value="${s.id}" ${pending.stock === s.id ? "selected" : ""} ${s.delisted || (pending.action !== "hold" && maxShares(room.stocks, me, pending.action, s.id) === 0) ? "disabled" : ""}>${escape(stockName(s))} · ${s.price}${pending.action === "sell" ? ` · ${me.holdings[s.id]} ${t("owned", "주 보유")}` : ""}</option>`).join("")}</select>
    <div class="quantity-row"><label>${t("Shares", "수량")}</label><div class="quantity-buttons" role="group" aria-label="${t("Number of shares", "주식 수량")}">${Array.from(
      { length: MAX_TRADE },
      (_, i) => i + 1,
    )
      .map(
        (q) =>
          `<button data-quantity="${q}" class="${pending.quantity === q ? "active" : ""}" aria-pressed="${pending.quantity === q}" ${disabled || pending.action === "hold" || q > max ? "disabled" : ""}>${q}</button>`,
      )
      .join("")}</div></div>
    <p class="quantity-limit">${pending.action === "sell" ? `${me.holdings[stock.id]} ${t("shares owned", "주 보유")} · ${t("maximum", "최대")} ${max}` : pending.action === "buy" ? `${money(me.cash)} · ${t("maximum", "최대")} ${max} ${t("shares", "주")}` : t("Your shares and cash stay unchanged.", "주식과 현금을 그대로 유지해요.")}</p>
    <div class="order-summary ${valid ? "" : "invalid"}"><strong>${valid ? escape(describeOrder(pending)) : t("This order cannot execute", "체결할 수 없는 주문")}</strong>${valid && pending.action !== "hold" ? `<div>${t("Cash", "현금")} ${me.cash} → <b>${afterCash}</b> · ${t("Shares", "주식")} ${me.holdings[stock.id]} → <b>${afterShares}</b></div><div>${t(pending.action === "buy" ? "You pay" : "You receive", pending.action === "buy" ? "지불액" : "수령액")} <b>${money(cost)}</b></div>` : ""}</div>
    <details id="protection-choice" class="protection-box" ${pending.protection ? "open" : ""}><summary>🍗 ${t("Optional protection", "치킨 보호 카드")} <span>${pending.protection ? room.stocks.find((s) => s.id === pending.protection).ticker : `× ${me.protections}`}</span></summary><label for="protection">🍗 ${t("Roast-chicken protection", "치킨 보호 카드")} <small>× ${me.protections}</small></label><select id="protection" ${disabled || me.protections === 0 ? "disabled" : ""}><option value="">${t("Save my card", "카드 아끼기")}</option>${room.stocks
      .filter((s) => !s.delisted)
      .map(
        (s) =>
          `<option value="${s.id}" ${pending.protection === s.id ? "selected" : ""} ${orderError(room.stocks, me, { ...pending, protection: s.id }) ? "disabled" : ""}>${t("Protect", "보호:")} ${escape(stockName(s))}</option>`,
      )
      .join(
        "",
      )}</select><p>${t("Repays this round’s price drop on shares held after trading. The card is spent either way.", "거래 후 보유 주식의 하락분을 보상해요. 상승해도 카드는 소모돼요.")}</p></details>
    <div class="order-commit"><div id="draft-status" class="draft-status ${draftState}" role="status">${status}${message ? `<span>${escape(message)}</span>` : ""}</div><div id="saved-order" class="saved-order">${t(room.deadline === null ? "Saved order:" : "At deadline:", room.deadline === null ? "저장된 주문:" : "시간 종료 시:")} <b>${escape(describeOrder(me.draft))}</b></div><button id="lock-order" class="primary full" ${disabled || !valid ? "disabled" : ""}>${me.locked ? t("✓ Order locked", "✓ 주문 확정") : phase ? `${t("Lock", "확정:")} ${t(pending.action.toUpperCase(), { buy: "매수", sell: "매도", hold: "관망" }[pending.action])}${pending.action !== "hold" ? ` ${pending.quantity} ${stock.ticker}` : ""}` : t("Trading paused", "거래 대기")}</button></div>
    ${room.solo && phase ? `<div class="solo-clock"><label for="round-timer-setting">${t("Solo timer", "솔로 타이머")}</label><select id="round-timer-setting" ${disabled ? "disabled" : ""}>${[60, 120, 0].map((seconds) => `<option value="${seconds}" ${(room.roundSeconds ?? 60) === seconds ? "selected" : ""}>${seconds ? `${seconds} ${t("seconds", "초")}` : t("No timer", "시간 제한 없음")}</option>`).join("")}</select></div>` : ""}</aside>`;
}
function game() {
  const me = own(),
    recap = room.recaps.at(-1),
    disabled = room.phase !== "planning" || me.locked || busy;
  return `<div class="game-top"><div><div class="eyebrow">${room.solo ? t("VS CAPTAIN CLUCK", "캡틴 꼬꼬 대전") : t("PRIVATE TABLE", "우리의 테이블")}${room.solo ? "" : ` · ${room.code}`}</div><h1>${room.phase === "ended" ? t("The closing bell.", "장이 마감됐어요.") : t("Make your move.", "당신의 선택은?")}</h1></div><div class="game-toolbar"><div class="round-box"><span>${t("ROUND", "라운드")}</span><strong>${room.round}<small> / 12</small></strong><span id="timer" class="timer"></span></div>${room.solo ? `<button id="restart-solo" class="quiet">${t("Restart", "다시 시작")}</button>` : ""}<button id="exit-menu" class="quiet">${t("Exit to menu", "메뉴로")}</button></div></div>
    <div class="players-strip" style="--players:${room.players.length}">${room.players.map((p, i) => `<div class="player-card player-${i} ${p.id === me.id ? "you" : ""}"><div class="player-name"><span>${["🥚", "⚡", "☀️", "✈️"][i]}</span><strong>${p.isComputer && lang === "ko" ? "캡틴 꼬꼬" : escape(p.name)}</strong><small>${p.isComputer ? t("CPU", "컴퓨터") : p.id === me.id ? t("YOU", "나") : ""}</small></div><div class="player-value">${p.score}<small>${t("total", "총자산")}</small>${p.lastRoundChange !== null && p.lastRoundChange !== undefined ? `<span class="round-change ${p.lastRoundChange < 0 ? "loss" : "gain"}">${p.lastRoundChange > 0 ? "+" : ""}${p.lastRoundChange} ${t("last round", "지난 라운드")}</span>` : ""}</div><div class="player-meta"><span>${money(p.cash)}</span><span>🍗 × ${p.protections}</span></div><div class="holding-row">${room.stocks.map((s) => `<span style="--stock-color:${s.color}">${s.ticker} <b>${p.holdings[s.id]}</b></span>`).join("")}</div><div class="player-state">${room.phase === "planning" ? (p.locked ? t("✓ Order locked", "✓ 주문 확정") : t("Choosing a trade…", "주문 선택 중…")) : t("At the table", "참여 중")}${!p.connected ? ` · ${t("offline", "연결 끊김")}` : ""}</div></div>`).join("")}</div>
    ${room.phase === "ended" ? results() : ""}<div class="game-layout"><section class="market panel"><div class="section-heading"><h2>${t("The market board", "주가 보드")}</h2><span>${t("COINS / SHARE", "코인 / 1주")}</span></div>${chart()}<div class="stock-tiles">${room.stocks.map((s) => `<button class="stock-tile ${pending.stock === s.id ? "selected" : ""} ${s.delisted ? "delisted" : ""}" data-stock="${s.id}" style="--stock-color:${s.color}" ${disabled || s.delisted || (pending.action !== "hold" && maxShares(room.stocks, me, pending.action, s.id) === 0) ? "disabled" : ""}><div><span class="stock-icon">${s.icon}</span><b>${s.ticker}</b><strong>${s.price}</strong></div><span>${escape(stockName(s))}</span><small>${s.delisted ? t("DELISTED", "상장폐지") : `${me.holdings[s.id]} ${t("shares owned", "주 보유")}`}</small></button>`).join("")}</div><div class="delisting-band">${t("DELISTING ZONE · 0 COINS", "상장폐지 구역 · 0코인")}</div></section>${tradePanel()}</div>${room.phase === "planning" ? `<div class="mobile-order-bar"><div><strong>${escape(describeOrder(pending))}</strong>${draftState === "saved" ? t("Saved for execution", "체결 준비 완료") : draftState === "saving" ? t("Saving…", "저장 중…") : t("Check your order", "주문을 확인하세요")}</div><button id="mobile-lock-order" class="primary" ${disabled || connection !== "connected" || orderError(room.stocks, me, pending) ? "disabled" : ""}>${me.locked ? t("Locked", "확정됨") : t("Lock order", "주문 확정")}</button></div>` : ""}
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
    }</section>${!room.solo ? `<div class="reaction-panel"><span>${t("Table reactions", "테이블 리액션")}</span><div>${["🐔", "🔥", "😱"].map((e) => `<button data-reaction="${e}" aria-label="${t("Send reaction", "리액션 보내기")} ${e}">${e}</button>`).join("")}</div><button id="copy-link" class="quiet">${t("Copy room link", "방 링크 복사")}</button></div>` : ""}</div>`;
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
  document.body.classList.toggle(
    "is-playing",
    Boolean(room && room.phase !== "lobby"),
  );
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
  const protectionOpen = $("#protection-choice")?.open;
  const journalOpen = $(".activity details")?.open;
  $("#app").innerHTML = !room
    ? home()
    : room.phase === "lobby"
      ? lobby()
      : game();
  if (protectionOpen && $("#protection-choice"))
    $("#protection-choice").open = true;
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
    submitDraft(true);
  });
  $("#mobile-lock-order")?.addEventListener("click", () => submitDraft(true));
  $("#exit-menu")?.addEventListener("click", exitToMenu);
  $("#restart-solo")?.addEventListener("click", () => {
    if (
      confirm(
        t(
          "Restart this solo match? Your current progress will be reset.",
          "솔로 게임을 다시 시작할까요? 현재 진행 상황이 초기화돼요.",
        ),
      )
    )
      action("restart");
  });
  $("#resume-table")?.addEventListener("click", resumeTable);
  $("#round-timer-setting")?.addEventListener("change", (e) =>
    action("timer", { seconds: Number(e.target.value) }),
  );
  document.querySelectorAll("[data-chart-view]").forEach((button) =>
    button.addEventListener("click", () => {
      chartView = button.dataset.chartView;
      inspectedRound = null;
      render();
    }),
  );
  $("#chart-round")?.addEventListener("change", (e) =>
    inspectRound(e.target.value),
  );
  document
    .querySelectorAll("[data-chart-round]")
    .forEach((region) =>
      region.addEventListener("pointerenter", () =>
        inspectRound(region.dataset.chartRound),
      ),
    );
  if (room && $(".market-chart"))
    inspectRound(
      inspectedRound === null
        ? room.stocks[0].history.length - 1
        : Math.min(inspectedRound, room.stocks[0].history.length - 1),
    );
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
function sameOrder(a, b) {
  return (
    a &&
    b &&
    ["action", "stock", "quantity", "protection"].every(
      (key) => (a[key] ?? null) === (b[key] ?? null),
    )
  );
}
function describeOrder(order) {
  if (!order) return t("HOLD", "관망");
  const stock = room.stocks.find((s) => s.id === order.stock);
  const trade =
    order.action === "hold"
      ? t("HOLD · keep your shares", "관망 · 주식 유지")
      : `${t(order.action.toUpperCase(), order.action === "buy" ? "매수" : "매도")} ${order.quantity} ${stock.ticker} @ ${stock.price}`;
  const protect = order.protection
    ? ` · 🍗 ${room.stocks.find((s) => s.id === order.protection).ticker}`
    : "";
  return `${trade}${protect}`;
}
function changeDraft(update) {
  if (busy || room.phase !== "planning" || own().locked) return;
  pending = { ...pending, ...update };
  if (pending.action !== "hold") {
    const available = maxShares(
      room.stocks,
      own(),
      pending.action,
      pending.stock,
    );
    pending.quantity = Math.min(
      Math.max(1, pending.quantity),
      Math.max(1, available),
    );
  }
  if (
    pending.protection &&
    orderError(room.stocks, own(), pending) === "NO_SHARES_TO_PROTECT"
  )
    pending.protection = null;
  clearTimeout(draftTimer);
  draftTimer = null;
  draftRevision++;
  draftError = orderError(room.stocks, own(), pending) || "";
  draftState = draftError ? "invalid" : "saving";
  if (!draftError) draftTimer = setTimeout(() => submitDraft(false), 180);
  render();
}
async function submitDraft(lock) {
  clearTimeout(draftTimer);
  draftTimer = null;
  const error = orderError(room.stocks, own(), pending);
  if (error) {
    draftError = error;
    draftState = "invalid";
    render();
    return;
  }
  const version = ++draftRevision;
  const snapshot = {
    code: room.code,
    match: room.match,
    round: room.round,
    order: { ...pending },
  };
  if (lock) busy = true;
  draftState = "saving";
  draftError = "";
  render();
  const previous = draftQueue;
  let release;
  draftQueue = new Promise((resolve) => {
    release = resolve;
  });
  try {
    // Send drafts in order so a slow request cannot overwrite a newer choice on the server.
    await previous;
    if (
      version !== draftRevision ||
      room?.code !== snapshot.code ||
      room?.match !== snapshot.match ||
      room?.round !== snapshot.round
    )
      return;
    const result = await api(`/api/rooms/${snapshot.code}/action`, {
      type: "draft",
      match: snapshot.match,
      round: snapshot.round,
      order: snapshot.order,
      lock,
    });
    if (
      version !== draftRevision ||
      room?.code !== snapshot.code ||
      room?.match !== snapshot.match ||
      room?.round !== snapshot.round
    )
      return;
    draftState = lock ? "locked" : "saved";
    adopt(result.room);
  } catch (error) {
    if (version !== draftRevision || room?.code !== snapshot.code) return;
    draftState = "error";
    draftError = error.message;
    showError(error);
  } finally {
    release();
    if (lock) busy = false;
    if (room) render();
  }
}
function tick() {
  if (!room) return;
  const seconds = room.deadline
    ? Math.max(0, Math.ceil((room.deadline - Date.now() - timeOffset) / 1000))
    : null;
  const text =
    seconds === null
      ? room.phase === "planning"
        ? t("No timer", "시간 제한 없음")
        : room.phase === "paused"
          ? t("Paused", "일시정지")
          : t("CLOSED", "마감")
      : room.phase === "planning"
        ? `${seconds}s`
        : `${t("Next round", "다음 라운드")} · ${seconds}s`;
  for (const id of ["timer", "trade-timer"]) {
    const timer = $(`#${id}`);
    if (timer) {
      timer.textContent = text;
      timer.classList.toggle(
        "urgent",
        room.phase === "planning" && seconds !== null && seconds <= 10,
      );
    }
  }
}
function clearCurrentTable() {
  draftRevision++;
  clearTimeout(draftTimer);
  draftTimer = null;
  clearTimeout(retry);
  clearInterval(poll);
  if (socket) {
    socket.onclose = null;
    socket.onmessage = null;
    socket.close(1000);
    socket = null;
  }
  session = null;
  room = null;
  connection = "offline";
  lastRoundKey = "";
  inspectedRound = null;
  localStorage.removeItem("cse-session");
  history.replaceState(null, "", "/");
}
async function exitToMenu() {
  if (!room || busy) return;
  if (room.phase === "lobby") return leave();
  busy = true;
  try {
    if (room.phase === "planning" && !own().locked) await submitDraft(false);
    if (room.solo && ["planning", "reveal"].includes(room.phase)) {
      await api(`/api/rooms/${room.code}/action`, {
        type: "pause",
        match: room.match,
        round: room.round,
      });
    }
    localStorage.setItem("cse-resume", JSON.stringify(session));
    clearCurrentTable();
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    render();
  }
}
async function resumeTable() {
  if (busy) return;
  busy = true;
  try {
    session = JSON.parse(localStorage.getItem("cse-resume"));
    if (!session) throw new Error("ROOM_NOT_FOUND");
    let result = await api(`/api/rooms/${session.code}/state`, null, "GET");
    if (result.room.phase === "paused")
      result = await api(`/api/rooms/${session.code}/action`, {
        type: "resume",
        match: result.room.match,
        round: result.room.round,
      });
    saveSession(session.code, session.token, session.name);
    adopt(result.room);
    connect();
  } catch (error) {
    session = null;
    showError(error);
    if (["ROOM_NOT_FOUND", "UNAUTHORIZED"].includes(error.message))
      localStorage.removeItem("cse-resume");
  } finally {
    busy = false;
    render();
  }
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
        `Each round lasts up to 60 seconds. Buy or sell 1–${MAX_TRADE} shares of one stock, or hold. Trades execute at the prices shown before news. No loans or short selling. All trading is with an unlimited bank. Solo mode offers 60 seconds, 120 seconds, or no timer.`,
        `라운드마다 최대 60초 동안 한 종목을 1~${MAX_TRADE}주 매수·매도하거나 관망해요. 뉴스 공개 전 가격으로 거래해요. 대출과 공매도는 없고, 은행과 거래하므로 주식 수량 제한은 없어요. 솔로 모드에서는 60초, 120초, 시간 제한 없음을 선택할 수 있어요.`,
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
$(".brand").addEventListener("click", (event) => {
  if (room) {
    event.preventDefault();
    exitToMenu();
  }
});
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
    let result = await api(`/api/rooms/${session.code}/state`, null, "GET");
    if (result.room.phase === "paused")
      result = await api(`/api/rooms/${session.code}/action`, {
        type: "resume",
        match: result.room.match,
        round: result.room.round,
      });
    adopt(result.room);
    connect();
  } catch (error) {
    localStorage.removeItem("cse-session");
    session = null;
    showError(error);
  }
}

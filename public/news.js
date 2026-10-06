import { chicken, e, tr } from "./presentation.js";
const effects = [-3, -2, -1, 1, 2, 3];
const headlines = {
  coop: [
    ["The snack factory runs out of snacks!", "간식 공장에 간식이 없어요!"],
    ["The chicken truck is stuck in mud!", "치킨 트럭이 진흙에 빠졌어요!"],
    ["Oops! The nuggets are a little burnt.", "앗! 너겟이 살짝 탔어요."],
    ["A tasty new dipping sauce arrives!", "맛있는 새 소스가 나왔어요!"],
    ["Everyone wants crispy nuggets!", "모두 바삭한 너겟을 원해요!"],
    ["The giant nugget festival sells out!", "왕너겟 축제, 전부 매진!"],
  ],
  nest: [
    ["Robot chicks all need a reboot!", "로봇 병아리들을 다시 켜야 해요!"],
    ["The new gadget launch is delayed!", "새 기계가 늦게 나온대요!"],
    ["A robot keeps saying “cluck”!", "로봇이 계속 “꼬꼬댁”만 말해요!"],
    ["A robot learns a silly dance!", "로봇이 웃긴 춤을 배웠어요!"],
    ["Robot chicks become the coolest toy!", "로봇 병아리가 최고 인기 장난감!"],
    ["A robot wins the town talent show!", "로봇이 마을 재주 대회에서 우승!"],
  ],
  sun: [
    ["A big storm shuts the solar farm!", "큰 폭풍에 태양광 농장이 멈췄어요!"],
    ["Clouds hide the sun all day!", "구름이 온종일 해를 가렸어요!"],
    ["Sleepy clouds block the sunshine.", "졸린 구름이 햇빛을 가려요."],
    ["A sunny afternoon powers the town!", "맑은 오후, 마을에 전기가 가득!"],
    ["New solar panels soak up sunshine!", "새 태양광 판이 햇빛을 모아요!"],
    ["A sunshine record lights up the town!", "햇빛 신기록! 마을이 반짝반짝!"],
  ],
  wing: [
    ["A big storm cancels the holidays!", "큰 폭풍에 휴가가 취소됐어요!"],
    [
      "Flights wait for a windy day to end!",
      "바람이 잠잠해질 때까지 비행 대기!",
    ],
    ["The holiday bus gets a flat tire.", "여행 버스 타이어에 펑크가 났어요."],
    ["A new picnic trip takes off!", "새 소풍 여행을 떠나요!"],
    ["Chickens rush to book a holiday!", "닭들이 신나게 휴가를 예약해요!"],
    ["Everyone wants Chicken Island tickets!", "모두 치킨섬 표를 원해요!"],
  ],
  all: [
    ["A huge storm closes the town fair!", "큰 폭풍에 마을 축제가 멈췄어요!"],
    ["Rain keeps shoppers at home!", "비 때문에 손님들이 집에 있어요!"],
    ["The town takes a sleepy day off.", "마을이 졸린 하루를 쉬어 가요."],
    ["A cheerful parade brings visitors!", "즐거운 행진에 손님들이 찾아와요!"],
    ["The town fair is packed with chickens!", "마을 축제에 닭들이 북적북적!"],
    [
      "The biggest chicken festival ever opens!",
      "역대 최대 치킨 축제가 열렸어요!",
    ],
  ],
};
const descriptions = {
  coop: [
    [
      "More chickens want tasty snacks from Coop Foods.",
      "더 많은 닭이 꼬꼬푸드의 맛있는 간식을 원해요.",
    ],
    [
      "Coop Foods has fewer snacks to sell today.",
      "오늘은 꼬꼬푸드가 팔 간식이 줄었어요.",
    ],
  ],
  nest: [
    [
      "Customers are excited about Nest Tech’s clever machines.",
      "손님들이 네스트테크의 똑똑한 기계를 좋아해요.",
    ],
    [
      "Nest Tech needs time to fix its gadgets.",
      "네스트테크는 기계를 고칠 시간이 필요해요.",
    ],
  ],
  sun: [
    [
      "Sunny Energy can make more electricity from sunshine.",
      "써니에너지가 햇빛으로 전기를 더 많이 만들어요.",
    ],
    [
      "Sunny Energy can make less electricity today.",
      "오늘은 써니에너지가 만들 전기가 줄어요.",
    ],
  ],
  wing: [
    [
      "More chickens want to travel with Feather Travel.",
      "더 많은 닭이 페더여행과 여행을 떠나고 싶어 해요.",
    ],
    [
      "Feather Travel has fewer trips to sell today.",
      "오늘은 페더여행이 팔 여행 상품이 줄었어요.",
    ],
  ],
  all: [
    [
      "More customers visit businesses all over town.",
      "마을 곳곳의 가게에 손님이 더 많이 찾아와요.",
    ],
    [
      "Businesses all over town have fewer customers today.",
      "오늘은 마을 곳곳의 가게에 손님이 줄었어요.",
    ],
  ],
};
export function newsStory(event, stocks, lang = "en") {
  const t = (en, ko) => tr(lang, en, ko),
    positive = event.effect > 0;
  const stock = stocks.find((s) => s.id === event.target);
  const target =
    event.target === "all"
      ? t("All four stocks", "전체 4개 종목")
      : lang === "ko"
        ? stock.ko
        : stock.en;
  const pair =
    headlines[event.target][effects.indexOf(event.effect)] ||
    headlines[event.target][positive ? 3 : 2];
  return {
    positive,
    heading: t(...pair),
    description: t(...descriptions[event.target][positive ? 0 : 1]),
    target,
    ticker: stock?.ticker || t("ALL", "전체"),
    icon: stock?.icon || "🎪",
    badge: t(
      positive ? "GOOD NEWS" : "BAD NEWS",
      positive ? "좋은 소식" : "나쁜 소식",
    ),
    body: `${target} ${positive ? "+" : "−"}${Math.abs(event.effect)} ${t("coins", "코인")}`,
  };
}
export function renderNewspaper(recap, stocks, lang = "en") {
  const t = (en, ko) => tr(lang, en, ko),
    story = newsStory(recap.event, stocks, lang),
    amount = Math.abs(recap.event.effect);
  const affected = stocks.filter(
    (s) => recap.event.target === "all" || s.id === recap.event.target,
  );
  const active = affected.filter(
    (s) => recap.movements.find((m) => m.stock === s.id)?.before > 0,
  );
  return `<article class="newspaper ${story.positive ? "good-edition" : "bad-edition"}" aria-label="${t("The Cluck Times newspaper", "꼬꼬일보 신문")}"><header class="newspaper-masthead"><span>${t("SPECIAL MARKET EDITION", "주식 시장 특별판")}</span><strong>${t("The Cluck Times", "꼬꼬일보")}</strong><div><span>${t("ROUND", "라운드")} ${recap.round}</span><span>${t("Chicken Town • Since round 1", "꼬꼬마을 • 1라운드 창간")}</span></div></header><div class="newspaper-ribbon"><b>${story.badge}</b><span>${t("Extra! Extra! Read all about it!", "호외요! 호외! 오늘의 소식!")}</span></div><div class="newspaper-front"><div class="newspaper-story"><div class="newspaper-kicker">${e(story.target)} · ${t("TODAY’S BIG STORY", "오늘의 주요 뉴스")}</div><h2>${e(story.heading)}</h2><p class="newspaper-description">${e(story.description)}</p><div class="newspaper-byline">${t("By our reporter, Captain Cluck", "기자: 캡틴 꼬꼬")}</div></div><figure class="newspaper-picture"><div class="newspaper-scene"><span class="scene-icon" aria-hidden="true">${story.icon}</span>${chicken(story.positive ? "happy" : "worried", "newspaper-chicken")}<span class="scene-spark" aria-hidden="true">${story.positive ? "✦" : "☂"}</span></div><figcaption>${t("Our reporter is on the scene!", "현장에 출동한 꼬꼬 기자!")}</figcaption></figure><aside class="newspaper-impact"><span>${t("NEWS EFFECT", "뉴스 효과")}</span><strong>${story.positive ? "+" : "−"}${amount}</strong><b>${t("coins per share", "코인 / 1주")}</b><p>${t(story.positive ? "News adds value to" : "News takes value from", story.positive ? "뉴스가 가치를 더하는 종목" : "뉴스가 가치를 줄이는 종목")}</p><div class="newspaper-targets">${affected.map((s) => `<span class="${active.includes(s) ? "" : "inactive-target"}" style="--stock-color:${s.color}">${s.icon} ${s.ticker}${active.includes(s) ? "" : ` · ${t("delisted", "상장폐지")}`}</span>`).join("")}</div></aside></div><footer class="newspaper-footer"><p>${t("This is the news effect. Trades and dice also change the final price.", "뉴스의 효과예요. 거래와 주사위도 최종 가격을 바꿔요.")}${active.length < affected.length ? ` ${t("Delisted stocks stay at zero.", "상장폐지된 종목은 0을 유지해요.")}` : ""}</p><button id="replay-news-sound" class="secondary">♪ ${t("Play news sound", "뉴스 효과음 듣기")}</button></footer></article>`;
}

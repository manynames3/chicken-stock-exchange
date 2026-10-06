import { e, tr } from "./presentation.js";
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
// Each card has its own event and earnings explanation, in English and Korean.
const stories = {
  "coop": [
    [
      "The snack factory uses up its last bag of ingredients. Coop Foods must pause its ovens, so it cannot fill today’s snack orders.",
      "간식 공장에 재료가 다 떨어졌어요. 꼬꼬푸드는 오븐을 멈춰야 해서 오늘 주문받은 간식을 만들 수 없어요.",
      "Fewer snacks sold means less money coming in. Traders expect lower earnings, so they value a piece of Coop Foods less.",
      "간식을 덜 팔면 들어오는 돈도 줄어요. 투자자들은 꼬꼬푸드가 돈을 덜 벌 것 같아 주식의 가치를 낮게 봐요."
    ],
    [
      "A delivery truck gets stuck in a very muddy puddle. The shops are waiting for Coop Foods snacks, but the boxes cannot arrive on time.",
      "배달 트럭이 진흙 웅덩이에 빠졌어요. 가게들이 꼬꼬푸드의 간식을 기다리지만 상자가 제때 도착하지 못해요.",
      "Late deliveries can mean missed sales and extra towing costs. Traders expect less money left over for the company, so its shares lose value.",
      "배달이 늦으면 판매 기회를 놓치고 트럭을 꺼내는 비용도 들어요. 회사에 남는 돈이 줄 것 같아서 주식 가치가 내려가요."
    ],
    [
      "A batch of nuggets stays in the oven a little too long. Coop Foods throws out the burnt snacks and makes fresh ones for its customers.",
      "너겟 한 판이 오븐에 너무 오래 있었어요. 꼬꼬푸드는 탄 간식을 버리고 손님들에게 줄 새 너겟을 만들어요.",
      "Replacing the snacks costs extra ingredients and time. That leaves less profit, so traders think Coop Foods shares are worth a little less.",
      "다시 만들려면 재료와 시간이 더 들어요. 남는 이익이 줄어서 투자자들이 꼬꼬푸드 주식의 가치를 조금 낮게 봐요."
    ],
    [
      "Coop Foods invents a delicious new dipping sauce. Curious chickens visit the shop to try it with a box of nuggets.",
      "꼬꼬푸드가 맛있는 새 소스를 만들었어요. 궁금해진 닭들이 너겟과 함께 맛보려고 가게에 찾아와요.",
      "The new sauce brings more snack orders. Traders expect the company to earn more money, so a share of Coop Foods becomes more valuable.",
      "새 소스 덕분에 간식 주문이 늘어요. 회사가 돈을 더 벌 것 같아서 꼬꼬푸드 주식 한 주의 가치가 올라가요."
    ],
    [
      "Coop Foods’ crispy nuggets become the town’s favorite lunch. Shops ask for extra boxes because their shelves keep selling out.",
      "꼬꼬푸드의 바삭한 너겟이 마을의 인기 점심이 됐어요. 가게들은 진열대가 계속 비어서 더 많은 상자를 주문해요.",
      "More customers and repeat orders can bring higher earnings. Traders are excited about those future sales, so they value the company’s shares more.",
      "손님과 반복 주문이 늘면 회사가 더 많이 벌 수 있어요. 투자자들은 앞으로의 판매를 기대하며 주식 가치를 높게 봐요."
    ],
    [
      "The giant nugget festival is packed with hungry chickens. Coop Foods sells every snack box and gets bookings for the next festival too.",
      "왕너겟 축제에 배고픈 닭들이 가득 모였어요. 꼬꼬푸드는 간식을 전부 팔고 다음 축제 주문까지 받았어요.",
      "A huge day of sales and new bookings makes future earnings look brighter. Traders think their piece of Coop Foods is worth much more.",
      "많은 판매와 새 주문 덕분에 앞으로의 수입도 좋아 보여요. 투자자들은 꼬꼬푸드의 작은 조각인 주식의 가치를 더 높게 봐요."
    ]
  ],
  "nest": [
    [
      "Nest Tech’s robot chicks freeze in the middle of their chores. The company pauses new orders and sends repair teams to reboot them.",
      "네스트테크의 로봇 병아리들이 일을 하다가 멈췄어요. 회사는 새 주문을 멈추고 수리팀을 보내 로봇을 다시 켜요.",
      "Repairing many robots costs money while sales slow down. Traders expect lower earnings, so Nest Tech shares become less valuable.",
      "많은 로봇을 고치는 데 돈이 들고 판매도 느려져요. 회사의 수입이 줄 것 같아서 네스트테크 주식 가치가 내려가요."
    ],
    [
      "The new Nest Tech gadget needs more testing before it is ready. Customers must wait, and some choose another gadget instead.",
      "네스트테크의 새 기계는 나오기 전에 시험을 더 해야 해요. 손님들은 기다려야 하고, 일부는 다른 기계를 사요.",
      "A delayed launch means fewer sales today and extra work for the team. Traders lower their earnings expectations, so the stock price falls.",
      "출시가 늦어지면 오늘 판매가 줄고 추가 작업도 필요해요. 투자자들은 예상 수입을 낮춰 보며 주식 가격도 내려가요."
    ],
    [
      "One new robot only says ‘cluck’ instead of answering questions. Nest Tech promises a free fix before more chickens buy that model.",
      "새 로봇 한 대가 질문에 답하는 대신 ‘꼬꼬댁’만 말해요. 네스트테크는 다른 닭들이 이 모델을 사기 전에 무료로 고쳐 주겠대요.",
      "The fix costs money, and some shoppers wait before buying. Traders expect a small dip in earnings, so the shares lose a little value.",
      "수리에는 돈이 들고 일부 손님은 구매를 미뤄요. 수입이 조금 줄 것 같아서 주식 가치도 조금 내려가요."
    ],
    [
      "A Nest Tech robot learns a hilarious dance. Chickens share the dance with their friends and visit the shop to see the robot.",
      "네스트테크의 로봇이 아주 웃긴 춤을 배웠어요. 닭들은 친구들에게 춤을 보여 주고 로봇을 보려고 가게에 찾아와요.",
      "The attention brings new customers and possible gadget sales. Traders expect a little more business, so Nest Tech shares gain value.",
      "관심이 늘면 새 손님이 오고 기계도 더 팔릴 수 있어요. 회사의 일이 조금 늘 것 같아서 주식 가치가 올라가요."
    ],
    [
      "Robot chicks become the toy every chicken wants. Nest Tech receives so many orders that its workshop starts making extra robots.",
      "로봇 병아리가 모든 닭이 원하는 장난감이 됐어요. 네스트테크는 주문이 많이 들어와 로봇을 더 만들기 시작해요.",
      "Lots of new orders make future sales look stronger. Traders expect higher earnings and value a share of Nest Tech more.",
      "새 주문이 많으면 앞으로의 판매가 더 좋아 보여요. 더 높은 수입을 기대하며 투자자들이 주식 가치를 높게 봐요."
    ],
    [
      "A Nest Tech robot wins the town talent show with its amazing tricks. Schools and shops all ask to order their own clever robot.",
      "네스트테크의 로봇이 멋진 재주로 마을 대회에서 우승했어요. 학교와 가게들이 똑똑한 로봇을 하나씩 주문하고 싶어 해요.",
      "The prize brings attention and big new orders. Traders see a much stronger future for Nest Tech’s earnings, so its shares rise in value.",
      "우승 덕분에 관심과 큰 새 주문이 생겼어요. 앞으로 더 많이 벌 것 같아서 네스트테크 주식 가치가 올라가요."
    ]
  ],
  "sun": [
    [
      "A big storm damages the solar farm’s equipment. Sunny Energy must shut it down for repairs instead of selling electricity today.",
      "큰 폭풍에 태양광 농장의 장비가 망가졌어요. 써니에너지는 오늘 전기를 팔지 못하고 수리를 위해 농장을 멈춰요.",
      "The company loses electricity sales and must pay for repairs. Traders expect much less profit, so Sunny Energy shares lose value.",
      "전기 판매가 줄고 수리비도 들어요. 남는 이익이 많이 줄 것 같아서 써니에너지 주식 가치가 내려가요."
    ],
    [
      "Thick clouds hide the sun all day. Sunny Energy’s panels collect less sunlight, so the farm has less electricity to sell.",
      "두꺼운 구름이 온종일 해를 가렸어요. 써니에너지의 태양광 판이 햇빛을 덜 모아 팔 수 있는 전기가 줄어요.",
      "Selling less electricity brings in less money. Traders expect lower earnings from the solar farm, so its shares become less valuable.",
      "전기를 덜 팔면 들어오는 돈도 줄어요. 농장의 수입이 줄 것 같아서 투자자들이 주식 가치를 낮게 봐요."
    ],
    [
      "Sleepy clouds drift over the solar panels for part of the day. Sunny Energy still makes electricity, but a little less than usual.",
      "졸린 구름이 잠시 태양광 판 위를 지나가요. 써니에너지는 여전히 전기를 만들지만 평소보다 조금 적게 만들어요.",
      "A small drop in electricity sales can mean a small drop in earnings. Traders value Sunny Energy’s shares a little less.",
      "전기 판매가 조금 줄면 수입도 조금 줄 수 있어요. 투자자들은 써니에너지 주식의 가치를 조금 낮게 봐요."
    ],
    [
      "A sunny afternoon gives the solar panels plenty of light. Sunny Energy makes extra electricity for homes around Chicken Town.",
      "맑은 오후에 태양광 판이 햇빛을 많이 받아요. 써니에너지는 꼬꼬마을의 집에 보낼 전기를 더 만들어요.",
      "More electricity to sell can bring more money into the company. Traders expect better earnings, so its shares gain value.",
      "팔 수 있는 전기가 늘면 회사에 들어오는 돈도 늘 수 있어요. 더 좋은 수입을 기대하며 주식 가치가 올라가요."
    ],
    [
      "Sunny Energy installs new panels that collect more sunshine. The farm can now supply electricity to more homes and shops.",
      "써니에너지가 햇빛을 더 많이 모으는 새 판을 설치했어요. 이제 더 많은 집과 가게에 전기를 보낼 수 있어요.",
      "More electricity and more customers can lead to higher future sales. Traders expect the company to earn more, so its stock price rises.",
      "전기와 손님이 늘면 앞으로 더 많이 팔 수 있어요. 회사가 더 벌 것 같아서 주식 가격이 올라가요."
    ],
    [
      "Chicken Town has its sunniest week ever. Sunny Energy’s panels produce lots of electricity, and extra customers sign up to buy it.",
      "꼬꼬마을에 역대 가장 맑은 한 주가 찾아왔어요. 써니에너지는 전기를 많이 만들고 새 손님들도 전기를 사겠다고 신청해요.",
      "A big increase in power sales and new customers makes earnings look much stronger. Traders value Sunny Energy shares more highly.",
      "전기 판매와 새 손님이 크게 늘어 수입도 좋아 보여요. 투자자들은 써니에너지 주식 가치를 더 높게 봐요."
    ]
  ],
  "wing": [
    [
      "A big storm cancels many holiday trips. Feather Travel gives customers their ticket money back and keeps its planes safely on the ground.",
      "큰 폭풍에 많은 휴가 여행이 취소됐어요. 페더여행은 손님들에게 표 값을 돌려주고 비행기를 안전하게 세워 둬요.",
      "Cancelled trips mean fewer ticket sales and money returned to customers. Traders expect lower earnings, so Feather Travel shares lose value.",
      "여행이 취소되면 표 판매가 줄고 손님들에게 돈도 돌려줘야 해요. 수입이 줄 것 같아서 페더여행 주식 가치가 내려가요."
    ],
    [
      "Strong winds keep Feather Travel’s planes waiting at the airport. Some passengers postpone their holidays until another day.",
      "강한 바람 때문에 페더여행의 비행기가 공항에서 기다려요. 일부 손님들은 휴가를 다른 날로 미뤄요.",
      "Delays can cost extra money and reduce the trips sold today. Traders expect less profit, so they value Feather Travel shares less.",
      "지연에는 추가 비용이 들고 오늘 판매할 여행도 줄어요. 남는 이익이 적을 것 같아서 주식 가치를 낮게 봐요."
    ],
    [
      "The holiday bus gets a flat tire on its way to a picnic. Feather Travel pays for a new tire and gives passengers a small refund.",
      "소풍 가던 여행 버스의 타이어에 펑크가 났어요. 페더여행은 새 타이어를 사고 손님들에게 돈을 조금 돌려줘요.",
      "Repairs and refunds leave less money from that trip. Traders expect a small loss of earnings, so the shares dip in value.",
      "수리비와 환불 때문에 이번 여행에서 남는 돈이 줄어요. 수입이 조금 줄 것 같아서 주식 가치가 조금 내려가요."
    ],
    [
      "Feather Travel opens a new picnic trip to a lovely park. Chickens begin booking seats for a fun day with their friends.",
      "페더여행이 예쁜 공원으로 가는 새 소풍 여행을 열었어요. 닭들이 친구들과 즐거운 하루를 보내려고 자리를 예약해요.",
      "The new route gives the company more tickets to sell. Traders expect extra earnings, so Feather Travel shares gain value.",
      "새 여행이 생겨 회사가 팔 표도 늘어요. 추가 수입을 기대하며 페더여행 주식 가치가 올라가요."
    ],
    [
      "Chickens rush to book their holidays with Feather Travel. The company fills more plane and bus seats than it usually does.",
      "닭들이 페더여행의 휴가 여행을 서둘러 예약해요. 평소보다 더 많은 비행기와 버스 자리가 꽉 차요.",
      "Fuller trips can bring in more ticket money. Traders expect higher earnings, so they think a share of Feather Travel is worth more.",
      "자리가 더 많이 차면 표를 팔아 들어오는 돈도 늘 수 있어요. 수입이 늘 것 같아서 투자자들은 주식 가치를 높게 봐요."
    ],
    [
      "Everyone wants to visit Chicken Island for its big beach party. Feather Travel sells out its trips and gets bookings for extra departures.",
      "모두가 큰 해변 파티에 가려고 치킨섬을 찾고 있어요. 페더여행의 여행이 매진되고 추가 출발 예약도 들어와요.",
      "Sold-out trips and extra bookings make future sales look much brighter. Traders expect strong earnings, so Feather Travel shares rise in value.",
      "매진된 여행과 추가 예약 덕분에 앞으로의 판매가 좋아 보여요. 많은 수입을 기대하며 주식 가치가 올라가요."
    ]
  ],
  "all": [
    [
      "A huge storm closes Chicken Town’s fair. Visitors stay away, shops shut their stalls, and trips into town are cancelled.",
      "큰 폭풍에 꼬꼬마을의 축제가 멈췄어요. 손님들이 오지 않고 가게들은 문을 닫으며 마을로 오는 여행도 취소돼요.",
      "Businesses across town lose customers and sales. Traders expect weaker earnings for all four companies, so this news lowers every active stock.",
      "마을 곳곳의 회사들이 손님과 판매 기회를 잃어요. 네 회사의 수입이 줄 것 같아서 이 뉴스는 모든 상장 종목의 가치를 낮춰요."
    ],
    [
      "Rain keeps shoppers at home instead of visiting Chicken Town. Businesses get fewer orders, and fewer chickens book a trip into town.",
      "비 때문에 손님들이 꼬꼬마을에 오지 않고 집에 있어요. 회사들의 주문이 줄고 마을로 오는 여행 예약도 줄어요.",
      "Fewer customers means less business around town. Traders expect lower earnings across the market, so all active stocks lose value from this news.",
      "손님이 줄면 마을의 거래도 줄어요. 시장 전체의 수입이 적을 것 같아서 이 뉴스로 모든 상장 종목의 가치가 내려가요."
    ],
    [
      "Chicken Town takes a sleepy day off. Fewer shops open, and many customers wait until tomorrow to buy things or book trips.",
      "꼬꼬마을이 졸린 하루를 쉬어 가요. 문을 여는 가게가 줄고 많은 손님들이 물건 구매와 여행 예약을 내일로 미뤄요.",
      "A quiet day brings a little less money into local businesses. Traders expect a small dip in earnings, so this news lowers all active stocks a little.",
      "조용한 날에는 마을 회사들에 들어오는 돈이 조금 줄어요. 수입이 조금 적을 것 같아서 이 뉴스는 모든 상장 종목을 조금 내려요."
    ],
    [
      "A cheerful parade brings visitors to Chicken Town. They buy snacks, browse gadgets, and book rides while the town uses extra electricity.",
      "즐거운 행진에 손님들이 꼬꼬마을로 와요. 간식과 기계를 사고 이동할 차를 예약하며 마을은 전기도 더 써요.",
      "Visitors bring new sales to all four businesses. Traders expect better earnings around town, so the news gives every active stock a small boost.",
      "손님들이 네 회사 모두에 새 판매 기회를 가져와요. 마을의 수입이 좋아질 것 같아서 모든 상장 종목의 가치가 조금 올라가요."
    ],
    [
      "The town fair is packed with chickens from nearby villages. Snack stands, gadget shops, travel services, and electricity suppliers all get busier.",
      "근처 마을의 닭들까지 축제에 와서 꼬꼬마을이 북적여요. 간식 가게, 기계 가게, 여행 회사와 전기 회사 모두 바빠져요.",
      "More business across town makes future earnings look stronger. Traders value shares in all four companies more, so every active stock gets a news boost.",
      "마을의 거래가 늘어 앞으로의 수입도 좋아 보여요. 투자자들이 네 회사의 주식을 더 높게 봐서 모든 상장 종목의 뉴스 효과가 올라가요."
    ],
    [
      "Chicken Town opens its biggest festival ever. Visitors fill the streets, shops receive huge orders, and extra travel and power are needed.",
      "꼬꼬마을에 역대 가장 큰 축제가 열렸어요. 손님들이 거리를 채우고 가게에 큰 주문이 들어오며 여행과 전기도 더 필요해요.",
      "A big wave of customers creates more sales for all four companies. Traders expect much stronger earnings, so this news raises every active stock’s value.",
      "많은 손님이 네 회사 모두의 판매를 늘려 줘요. 앞으로의 수입이 훨씬 좋아질 것 같아서 이 뉴스는 모든 상장 종목의 가치를 올려요."
    ]
  ]
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
  const index = effects.indexOf(event.effect);
  const pair = headlines[event.target][index] || headlines[event.target][positive ? 3 : 2];
  const story = stories[event.target][index] || stories[event.target][positive ? 3 : 2];
  return {
    positive,
    heading: t(...pair),
    description: t(story[0], story[1]),
    reason: t(story[2], story[3]),
    target,
    ticker: stock?.ticker || t("ALL", "전체"),
    icon: stock?.icon || "🎪",
    badge: t(
      positive ? "GOOD NEWS" : "BAD NEWS",
      positive ? "좋은 소식" : "나쁜 소식",
    ),
    body: `${target} ${positive ? "+" : "−"}$${Math.abs(event.effect)}`,
  };
}
// Render parts of the existing mascot artwork around a real, readable HTML newspaper.
function reporterPart(viewBox, className) {
  return `<svg class="reporter-part ${className}" viewBox="${viewBox}" aria-hidden="true" focusable="false"><image href="/assets/chicken-news-logo.png" width="1280" height="1280"/></svg>`;
}
function heldPaper(contents, edition, lang) {
  const t = (en, ko) => tr(lang, en, ko);
  return `<div class="newspaper-holder">${reporterPart("220 55 850 525", "reporter-head")}<article class="newspaper held-paper ${edition}" aria-label="${t("The Cluck Times newspaper held by Captain Cluck", "캡틴 꼬꼬가 들고 있는 꼬꼬일보 신문")}">${reporterPart("175 645 180 290", "reporter-grip left-grip")}${reporterPart("920 645 185 290", "reporter-grip right-grip")}${contents}${reporterPart("350 1010 575 165", "reporter-feet")}</article></div>`;
}
function masthead(round, lang) {
  const t = (en, ko) => tr(lang, en, ko);
  return `<header class="newspaper-masthead"><span>${t("GOOD NEWS BAD NEWS · MARKET EDITION", "GOOD NEWS BAD NEWS · 주식 시장판")}</span><strong>${t("The Cluck Times", "꼬꼬일보")}</strong><div><span>${round ? `${t("ROUND", "라운드")} ${round}` : t("FIRST EDITION COMING SOON", "첫 신문 발행 준비 중")}</span><span>${t("Reported by Captain Cluck", "기자: 캡틴 꼬꼬")}</span></div></header>`;
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
  const contents = `${masthead(recap.round, lang)}
    <div class="newspaper-ribbon"><b>${story.badge}</b><span>${t("BREAKING NEWS", "속보")}</span></div>
    <div class="newspaper-front">
      <div class="newspaper-story">
        <div class="newspaper-kicker">${e(story.target)} · ${t("TODAY’S BIG STORY", "오늘의 주요 뉴스")}</div>
        <h2>${e(story.heading)}</h2>
        <p class="newspaper-description">${e(story.description)}</p>
        <section class="newspaper-reason" aria-label="${t("Why this news changes share value", "이 뉴스가 주식 가치를 바꾸는 이유")}">
          <h3>${t(story.positive ? "Why this news pushes the price up" : "Why this news pushes the price down", story.positive ? "이 뉴스가 주가를 올리는 이유" : "이 뉴스가 주가를 내리는 이유")}</h3>
          <p>${e(story.reason)}</p>
        </section>
        <div class="newspaper-byline">${t("A share is a small piece of a company. Its value can change when people expect that company to earn more or less money.", "주식 한 주는 회사의 작은 조각이에요. 사람들이 회사가 돈을 더 벌거나 덜 벌 것이라 기대하면 그 가치가 바뀔 수 있어요.")}</div>
      </div>
      <aside class="newspaper-impact">
        <span>${t("IN THIS GAME", "이 게임에서는")}</span>
        <strong>${story.positive ? "+" : "−"}$${amount}</strong><b>${t("news effect per share", "뉴스 효과 / 1주")}</b>
        <p>${t(story.positive ? "This news adds value to" : "This news takes value from", story.positive ? "이 뉴스가 가치를 더하는 종목" : "이 뉴스가 가치를 줄이는 종목")}</p>
        <div class="newspaper-targets">${affected.map((s) => `<span class="${active.includes(s) ? "" : "inactive-target"}" style="--stock-color:${s.color}">${s.icon} ${s.ticker}${active.includes(s) ? "" : ` · ${t("delisted", "상장폐지")}`}</span>`).join("")}</div>
        <p class="news-effect-note">${t("The amount on the news card is a game rule.", "뉴스 카드의 숫자는 게임 규칙이에요.")}</p>
      </aside>
    </div>
    <footer class="newspaper-footer"><p>${t("This is the news effect. Trades and dice also change the final price, so good news can still end with a price drop, and bad news can still end with a rise.", "이것은 뉴스의 효과예요. 거래와 주사위도 최종 가격을 바꾸므로 좋은 뉴스 뒤에도 가격이 내려가거나 나쁜 뉴스 뒤에도 올라갈 수 있어요.")}${active.length < affected.length ? ` ${t("Delisted stocks stay at zero.", "상장폐지된 종목은 0을 유지해요.")}` : ""}</p><button id="replay-news-sound" class="secondary">♪ ${t("Play news sound", "뉴스 효과음 듣기")}</button></footer>`;
  return heldPaper(contents, story.positive ? "good-edition" : "bad-edition", lang);
}
export function renderWaitingNewspaper(lang = "en") {
  const t = (en, ko) => tr(lang, en, ko);
  return heldPaper(`${masthead(null, lang)}
    <div class="newspaper-ribbon"><b>${t("AT THE NEWS DESK", "신문 편집실")}</b><span>${t("REPORTER ON DUTY", "취재 중")}</span></div>
    <div class="newspaper-front"><div class="newspaper-story"><div class="newspaper-kicker">${t("TODAY’S BIG STORY", "오늘의 주요 뉴스")}</div><h2>${t("The news is still under wraps!", "오늘의 뉴스는 아직 비밀!")}</h2><p class="newspaper-description">${t("Captain Cluck is getting the next story ready. Choose your trade; when everyone locks their order, the headline and story appear on this paper.", "캡틴 꼬꼬가 다음 기사를 준비하고 있어요. 거래를 선택하세요. 모두 주문을 확정하면 이 신문에 제목과 기사가 나타나요.")}</p><section class="newspaper-reason"><h3>${t("Look for the reason behind the news", "뉴스 뒤에 숨은 이유를 찾아보세요")}</h3><p>${t("More customers can mean more sales. Repairs and delays can cost a company money. Each story explains what happened and why traders think the company is worth more or less.", "손님이 늘면 더 많이 팔 수 있어요. 수리와 지연에는 회사의 돈이 들어요. 각 기사는 무슨 일이 있었고 왜 투자자들이 회사의 가치를 높게 또는 낮게 보는지 알려 줘요.")}</p></section><div class="newspaper-byline">${t("A share is a small piece of a company.", "주식 한 주는 회사의 작은 조각이에요.")}</div></div><aside class="newspaper-impact"><span>${t("NEWS EFFECT", "뉴스 효과")}</span><strong>?</strong><b>${t("Still a secret", "아직 비밀")}</b><p>${t("No news has been revealed yet.", "아직 공개된 뉴스가 없어요.")}</p></aside></div><footer class="newspaper-footer"><p>${t("The newspaper stays in this spot. Every round brings a new story.", "신문은 이 자리에 있어요. 라운드마다 새 기사가 나와요.")}</p><button class="secondary" disabled>♪ ${t("Sound after the news", "뉴스 공개 후 효과음")}</button></footer>`, "waiting-edition", lang);
}

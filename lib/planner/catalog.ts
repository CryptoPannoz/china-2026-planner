import type { ChecklistGroup, ExpenseCategory, Leg, Payer, PrepItem, ScheduleItem, ScheduleKind, Stop } from "./types.ts";

// Date fisse dei voli intercontinentali: arrivo a Pechino e partenza da Shanghai.
export const ARRIVAL_KEY = "2026-11-17";
export const DEPARTURE_KEY = "2026-12-04";
export const TRIP_NIGHTS = 17;
export const FLIGHTS_COST = 1384.44;
export const PLAN_VERSION = 9;
export const DEFAULT_CNY_PER_EURO = 8;

export const BUILT_IN_CATEGORIES = [
  { value: "visita", label: "Visita" },
  { value: "cibo", label: "Cibo" },
  { value: "tempo-libero", label: "Tempo libero" },
  { value: "shopping", label: "Shopping" },
  { value: "spettacolo", label: "Spettacolo" },
];
export const KIND_LABELS: Record<ScheduleKind, string> = {
  activity: "Attività",
  transport: "Trasporto",
  hotel: "Hotel / notte",
};
export const ALLOWED_EMAILS = new Set([
  "bebroggi@gmail.com",
  "sofiakovaleva1998@gmail.com",
]);
export const PAYER_LABELS: Record<Payer, string> = { alberto: "Alberto", sofia: "Sofia" };
export const EXPENSE_CATEGORIES: Array<{ value: ExpenseCategory; label: string }> = [
  { value: "hotel", label: "Hotel" },
  { value: "trasporti", label: "Trasporti" },
  { value: "attivita", label: "Attività" },
  { value: "cibo", label: "Cibo" },
  { value: "voli", label: "Voli" },
  { value: "extra", label: "Extra" },
];
export const DEFAULT_COST_ENTRIES = [
  { id: "food", label: "Cibo e bevande", amount: 900, currency: "EUR" as const },
  { id: "local", label: "Trasporti locali", amount: 300, currency: "EUR" as const },
  { id: "extras", label: "Assicurazione, connettività ed extra", amount: 720, currency: "EUR" as const },
];

export const initialStops: Stop[] = [
  {
    id: "beijing",
    name: "Pechino",
    lat: 39.9042,
    lng: 116.4074,
    nights: 3,
    hotelNightly: 95,
    activities: [
      { id: "forbidden-city", name: "Città Proibita + Jingshan", description: "Prenotazione online obbligatoria con passaporto, 7 gg prima; chiuso lunedì", price: 12, selected: false },
      { id: "great-wall", name: "Grande Muraglia di Mutianyu", description: "40 ¥ ingresso + 15 ¥ navetta + 140 ¥ funivia A/R a testa; poca folla a novembre", price: 49, selected: false },
      { id: "temple-heaven", name: "Tempio del Cielo", description: "Cumulativo 28 ¥/pp in bassa stagione; al mattino tai chi e vita locale", price: 7, selected: false },
      { id: "summer-palace", name: "Palazzo d'Estate", description: "Biglietto completo 50 ¥/pp (nov–mar); lago Kunming, possibile ghiaccio", price: 13, selected: false },
      { id: "peking-duck", name: "Anatra alla pechinese (Siji Minfu)", description: "Anatra intera ~259 ¥ + contorni; prenotare o coda presto, file lunghe", price: 50, selected: false },
      { id: "hutong-houhai", name: "Hutong e lago Houhai", description: "Gratis; passeggiata nei vicoli storici e tramonto sul lago", price: 0, selected: false },
      { id: "lama-temple", name: "Tempio dei Lama (Yonghegong)", description: "25 ¥/pp con incenso incluso; chiude alle 16 in inverno", price: 6, selected: false },
    ],
  },
  {
    id: "xian",
    name: "Xi’an",
    lat: 34.3416,
    lng: 108.9398,
    nights: 2,
    hotelNightly: 85,
    activities: [
      { id: "terracotta", name: "Esercito di Terracotta", description: "120 ¥/pp, biglietto nominativo con passaporto, max 7 gg prima; mezza giornata", price: 30, selected: false },
      { id: "city-wall-bike", name: "Mura della città in bicicletta", description: "54 ¥ ingresso + 45 ¥ bici per 3h; partenza Porta Sud, giro completo 14 km", price: 25, selected: false },
      { id: "muslim-quarter", name: "Quartiere musulmano e street food", description: "Gratis; serata tra bancarelle: roujiamo e biangbiang noodles", price: 0, selected: false },
      { id: "big-wild-goose-pagoda", name: "Grande Pagoda dell'Oca Selvatica", description: "Tempio ~40 ¥ + salita 25 ¥; la sera fontane danzanti gratuite", price: 16, selected: false },
      { id: "tang-dynasty-show", name: "Tang Dynasty Show con banchetto di ravioli", description: "~350 ¥/pp show + cena (solo show 218 ¥); ore 19:30, prenotare", price: 88, selected: false },
    ],
  },
  {
    id: "chengdu",
    name: "Chengdu",
    lat: 30.5728,
    lng: 104.0668,
    nights: 2,
    hotelNightly: 80,
    activities: [
      { id: "pandas", name: "Chengdu Panda Base", description: "55 ¥/pp, prenotare online; arrivare alle 7:30–9, i panda sono attivi al mattino", price: 14, selected: false },
      { id: "sichuan-opera", name: "Opera del Sichuan e cambio faccia", description: "~180–320 ¥/pp con tè (Shufeng Yayun); show ore 20, posti centrali in anticipo", price: 55, selected: false },
      { id: "peoples-park", name: "Casa da tè al Parco del Popolo", description: "Parco gratuito, tè 20–30 ¥; pulizia orecchie, mahjong e atmosfera locale", price: 6, selected: false },
      { id: "jinli-street", name: "Jinli Street e Tempio di Wuhou", description: "Via gratuita, magica di sera con le lanterne; tempio adiacente ~50 ¥ opz.", price: 0, selected: false },
      { id: "leshan-buddha", name: "Buddha Gigante di Leshan (day trip)", description: "Treno AV ~1h + ingresso 50 ¥ inverno; crociera 70 ¥ opz., giornata intera", price: 46, selected: false },
      { id: "wenshu-monastery", name: "Monastero di Wenshu", description: "Gratuito; monastero attivo con casa da tè storica e ristorante vegetariano", price: 0, selected: false },
    ],
  },
  {
    id: "kunming",
    name: "Kunming · Yunnan",
    lat: 25.0389,
    lng: 102.7183,
    nights: 3,
    hotelNightly: 75,
    activities: [
      { id: "stone-forest", name: "Foresta di Pietra di Shilin", description: "Karst UNESCO a 90 min; 130 ¥/pp + navetta 25 ¥, prenotare su Trip.com", price: 33, selected: false },
      { id: "green-lake-gulls", name: "Green Lake e gabbiani siberiani", description: "Gratis; da novembre migliaia di gabbiani dal Bajkal, meglio al mattino", price: 0, selected: false },
      { id: "western-hills-dragon-gate", name: "Colline Occidentali e Porta del Drago", description: "40 ¥/pp + navetta; vista sul lago Dianchi", price: 16, selected: false },
      { id: "dianchi-haigeng", name: "Diga di Haigeng sul lago Dianchi", description: "Gratis; gabbiani nov–mar e tramonto spettacolare, si abbina alle Colline", price: 0, selected: false },
      { id: "yuantong-temple", name: "Tempio Yuantong", description: "Tempio buddista di 1200 anni in centro; ingresso simbolico, 8–18", price: 2, selected: false },
      { id: "flower-bird-market", name: "Mercato dei fiori e degli uccelli", description: "Gratis; bazar storico vicino al Green Lake, ottimo in inverno", price: 0, selected: false },
    ],
  },
  {
    id: "zhangjiajie",
    name: "Zhangjiajie",
    lat: 29.347,
    lng: 110.4792,
    nights: 2,
    hotelNightly: 90,
    activities: [
      { id: "forest-park", name: "Parco Nazionale · Yuanjiajie/Avatar e Tianzi", description: "239 ¥/pp valido 4 giorni con bus interni; prenotazione online obbligatoria", price: 60, selected: false },
      { id: "tianmen-mountain", name: "Tianmen Mountain con funivia e skywalk", description: "258 ¥/pp con funivia (225 da dic); nebbia frequente, skywalk in vetro", price: 65, selected: false },
      { id: "grand-canyon-glass-bridge", name: "Glass Bridge del Grand Canyon", description: "178 ¥/pp canyon + ponte; prenotare slot orario, può chiudere per ghiaccio", price: 45, selected: false },
      { id: "bailong-elevator", name: "Ascensore Bailong", description: "65 ¥/pp a tratta; sale 326 m nella roccia verso Yuanjiajie, extra al pass", price: 16, selected: false },
      { id: "tianzi-cable-car", name: "Funivia di Tianzi Mountain", description: "~65 ¥/pp a tratta; risparmia la salita a piedi, picchi nella nebbia", price: 16, selected: false },
    ],
  },
  {
    id: "fenghuang",
    name: "Fenghuang",
    lat: 27.9483,
    lng: 109.5987,
    nights: 1,
    hotelNightly: 65,
    activities: [
      { id: "tuojiang", name: "Barca sul fiume Tuojiang", description: "80 ¥/pp di giorno, 120 ¥ di notte (~30 min); la notturna è la più scenica", price: 30, selected: false },
      { id: "old-town-night", name: "Città antica illuminata di notte", description: "Gratis; luci su palafitte, torre Wanming e Hong Bridge fino a tarda sera", price: 0, selected: false },
      { id: "combo-ticket-attractions", name: "Biglietto combinato 8 attrazioni", description: "128 ¥/pp per 2 giorni: casa di Shen Congwen, East Gate, museo", price: 32, selected: false },
      { id: "stepping-stones-bridges", name: "Pietre del guado e ponti sul Tuojiang", description: "Gratis; attraversata sulle pietre all'alba con la foschia, prima della folla", price: 0, selected: false },
    ],
  },
  {
    id: "wuzhen",
    name: "Wuzhen",
    lat: 30.7462,
    lng: 120.4943,
    nights: 1,
    hotelNightly: 100,
    activities: [
      { id: "xizha", name: "Xizha illuminata di sera", description: "150 ¥/pp; luci dal tramonto (~17 a dicembre); dormire nel borgo è il top", price: 38, selected: false },
      { id: "canal-night-boat", name: "Barca notturna sui canali", description: "Privata ~480 ¥ fino a 8 posti; condivisa 60 ¥/pp", price: 60, selected: false },
      { id: "dongzha-morning", name: "Dongzha al mattino", description: "110 ¥/pp; conviene il combinato Xizha+Dongzha a 190 ¥; case-museo", price: 28, selected: false },
      { id: "folk-shows", name: "Spettacoli folk inclusi", description: "Ombre cinesi, opera e tintoria di indaco inclusi nel biglietto; orari invernali", price: 0, selected: false },
    ],
  },
  {
    id: "suzhou",
    name: "Suzhou",
    lat: 31.2989,
    lng: 120.5853,
    nights: 1,
    hotelNightly: 75,
    activities: [
      { id: "humble-garden", name: "Giardino dell’Umile Amministratore", description: "70 ¥/pp bassa stagione; prenotare online con passaporto, chiude alle 17", price: 18, selected: false },
      { id: "pingjiang-road", name: "Pingjiang Road", description: "Gratis; canale storico, case da tè e negozi, perfetta nel tardo pomeriggio", price: 0, selected: false },
      { id: "suzhou-museum", name: "Museo di Suzhou (I.M. Pei)", description: "Gratuito; prenotazione WeChat 7 gg prima con passaporto; chiuso lunedì", price: 0, selected: false },
      { id: "master-of-nets-night", name: "Master of the Nets serale", description: "Show ~120 ¥/pp ma spesso sospeso d'inverno: verificare, altrimenti diurna", price: 30, selected: false },
      { id: "tiger-hill", name: "Tiger Hill e pagoda pendente", description: "60 ¥/pp a dicembre; simbolo di Suzhou, 2–3 ore con il parco", price: 15, selected: false },
      { id: "shantang-street", name: "Shantang Street di sera", description: "Gratis; lanterne rosse sui canali, sale interne a pagamento", price: 0, selected: false },
    ],
  },
  {
    id: "shanghai",
    name: "Shanghai",
    lat: 31.2304,
    lng: 121.4737,
    nights: 2,
    hotelNightly: 120,
    activities: [
      { id: "bund-night", name: "Bund illuminato di sera", description: "Gratis; skyline di Pudong acceso ~18:30–22; a dicembre vento freddo", price: 0, selected: false },
      { id: "tower", name: "Shanghai Tower Observatory", description: "180 ¥/pp per il 118° piano; prenotare online, scegliere giornata limpida", price: 45, selected: false },
      { id: "yu-garden", name: "Yu Garden e bazaar", description: "~40 ¥/pp, chiuso lunedì; il bazaar attorno è gratuito e scenografico la sera", price: 10, selected: false },
      { id: "huangpu-cruise", name: "Crociera serale sull'Huangpu", description: "115 ¥/pp in bassa stagione, 50 min da Shiliupu; prenotare su Trip.com", price: 29, selected: false },
      { id: "french-concession", name: "Concessione Francese e Wukang Road", description: "Gratis; platani, ville e caffè tra Wukang Road e Tianzifang", price: 0, selected: false },
      { id: "shanghai-museum", name: "Museo di Shanghai", description: "Gratuito; prenotazione online con passaporto, chiuso lunedì; bronzi e giade", price: 0, selected: false },
    ],
  },
];

/** Tappa entrata con l’itinerario definitivo (migrazione v5): non era nel piano originale. */
export const CHONGQING_STOP: Stop = { id: "chongqing", name: "Chongqing", lat: 29.563, lng: 106.552, nights: 2, hotelNightly: 60, activities: [] };

// Nomi in cinese di città e attività: servono per chiedere indicazioni o mostrarli a un tassista.
export const STOP_ZH: Record<string, string> = {
  beijing: "北京",
  xian: "西安",
  chengdu: "成都",
  kunming: "昆明",
  zhangjiajie: "张家界",
  fenghuang: "凤凰古城",
  wuzhen: "乌镇",
  suzhou: "苏州",
  shanghai: "上海",
  chongqing: "重庆",
  guilin: "桂林·阳朔",
  lijiang: "丽江",
  dali: "大理",
  emeishan: "峨眉山",
  xiamen: "厦门",
  hangzhou: "杭州",
  huangshan: "黄山",
  pingyao: "平遥古城",
  huashan: "华山",
  luoyang: "洛阳",
  wudangshan: "武当山",
  "qingcheng-dujiangyan": "青城山·都江堰",
  putuoshan: "普陀山",
};

export const ACTIVITY_ZH: Record<string, string> = {
  "forbidden-city": "故宫博物院",
  "great-wall": "慕田峪长城",
  "temple-heaven": "天坛公园",
  "summer-palace": "颐和园",
  "peking-duck": "四季民福烤鸭店",
  "hutong-houhai": "什刹海·后海",
  "lama-temple": "雍和宫",
  terracotta: "秦始皇兵马俑博物馆",
  "city-wall-bike": "西安城墙（南门）",
  "muslim-quarter": "回民街",
  "big-wild-goose-pagoda": "大雁塔",
  "tang-dynasty-show": "唐乐宫",
  pandas: "成都大熊猫繁育研究基地",
  "sichuan-opera": "蜀风雅韵（川剧变脸）",
  "peoples-park": "人民公园·鹤鸣茶社",
  "jinli-street": "锦里·武侯祠",
  "leshan-buddha": "乐山大佛",
  "wenshu-monastery": "文殊院",
  "stone-forest": "石林风景区",
  "green-lake-gulls": "翠湖公园",
  "western-hills-dragon-gate": "西山龙门",
  "dianchi-haigeng": "海埂大坝",
  "yuantong-temple": "圆通寺",
  "flower-bird-market": "景星花鸟市场",
  "forest-park": "张家界国家森林公园",
  "tianmen-mountain": "天门山",
  "grand-canyon-glass-bridge": "张家界大峡谷玻璃桥",
  "bailong-elevator": "百龙天梯",
  "tianzi-cable-car": "天子山索道",
  tuojiang: "沱江泛舟",
  "old-town-night": "凤凰古城",
  "combo-ticket-attractions": "凤凰古城景点联票",
  "stepping-stones-bridges": "沱江跳岩",
  xizha: "西栅景区",
  "canal-night-boat": "乌镇摇橹船",
  "dongzha-morning": "东栅景区",
  "folk-shows": "乌镇民俗表演",
  "humble-garden": "拙政园",
  "pingjiang-road": "平江路",
  "suzhou-museum": "苏州博物馆",
  "master-of-nets-night": "网师园",
  "tiger-hill": "虎丘",
  "shantang-street": "山塘街",
  "bund-night": "外滩",
  tower: "上海中心大厦",
  "yu-garden": "豫园",
  "huangpu-cruise": "黄浦江游船",
  "french-concession": "武康路·法租界",
  "shanghai-museum": "上海博物馆",
  "hongya-cave": "洪崖洞",
  "dazu-rock-carvings": "大足石刻",
  "yangtze-cableway": "长江索道",
  "li-river-cruise": "漓江游船",
  "yulong-bamboo-raft": "遇龙河竹筏",
  "reed-flute-cave": "芦笛岩",
  "jade-dragon-snow-mountain": "玉龙雪山",
  "lijiang-old-town": "丽江古城·黑龙潭",
  "shuhe-old-town": "束河古镇",
  "three-pagodas": "崇圣寺三塔",
  "erhai-lake-loop": "洱海",
  "cangshan-cableway": "苍山索道",
  "cima-dorata-jinding": "峨眉山金顶",
  "buddha-gigante-leshan": "乐山大佛",
  "terme-di-emei": "峨眉山温泉",
  "gulangyu-sunlight-rock": "鼓浪屿·日光岩",
  "tempio-nanputuo": "南普陀寺",
  "zengcuoan-lungomare": "曾厝垵",
  "crociera-lago-ovest": "西湖游船",
  "lingyin-feilai-feng": "灵隐寺·飞来峰",
  "villaggio-te-longjing": "龙井村",
  "vetta-huangshan": "黄山",
  "borgo-hongcun": "宏村",
  "borgo-xidi": "西递",
  "pingyao-pass": "平遥古城通票",
  "pingyao-qiao": "乔家大院",
  "pingyao-shuanglin": "双林寺",
  "huashan-west-cable": "华山西峰索道",
  "huashan-plank-walk": "长空栈道",
  "huashan-peaks-loop": "华山五峰",
  "longmen-grottoes": "龙门石窟",
  "shaolin-monastery": "少林寺",
  "white-horse-temple": "白马寺",
  "wudang-golden-summit": "武当山金顶",
  "wudang-zixiao": "紫霄宫",
  "wudang-taichi": "武当太极",
  "qingcheng-front": "青城山前山",
  "dujiangyan-anlan": "都江堰·安澜索桥",
  "dujiangyan-panda": "都江堰熊猫谷",
  "putuo-puji": "普济禅寺",
  "putuo-guanyin": "南海观音",
  "putuo-fanyin": "梵音洞",
};

export const initialLegs: Leg[] = [
  { id: "beijing-xian", fromId: "beijing", toId: "xian", mode: "🚄 Alta velocità", duration: "4h30–5h", cost: 120, included: true, note: "Beijing West → Xi’an North" },
  { id: "xian-chengdu", fromId: "xian", toId: "chengdu", mode: "🚄 Alta velocità", duration: "3h30–4h", cost: 95, included: true, note: "Xi’an North → Chengdu East" },
  { id: "chengdu-kunming", fromId: "chengdu", toId: "kunming", mode: "✈️ Volo diretto", duration: "1h30", cost: 150, included: true, note: "Protegge mezza giornata" },
  { id: "kunming-zhangjiajie", fromId: "kunming", toId: "zhangjiajie", mode: "🚄 Treno con cambio", duration: "5–11h30", cost: 110, included: true, note: "Verificare Huaihua o Changsha" },
  { id: "zhangjiajie-fenghuang", fromId: "zhangjiajie", toId: "fenghuang", mode: "🚄 Treno + Didi", duration: "~2h", cost: 45, included: true, note: "Arrivo a Fenghuanggucheng" },
  { id: "fenghuang-wuzhen", fromId: "fenghuang", toId: "wuzhen", mode: "🚄 Treni via Changsha", duration: "7–9h", cost: 130, included: true, note: "La tratta più delicata" },
  { id: "wuzhen-suzhou", fromId: "wuzhen", toId: "suzhou", mode: "🚕 Didi / transfer", duration: "1h30–2h", cost: 55, included: true, note: "Alternativa: bus diretto" },
  { id: "suzhou-shanghai", fromId: "suzhou", toId: "shanghai", mode: "🚄 Alta velocità", duration: "25–40 min", cost: 20, included: true, note: "Preferire stazioni centrali" },
];

// Base di trasferimenti noti (costo per 2, sempre modificabile): usata quando due tappe diventano
// consecutive e non c'è ancora una tratta salvata, al posto del generico "Trasporto da definire".
export const KNOWN_LEG_PRESETS: Record<string, { mode: string; duration: string; cost: number; note: string }> = {
  "beijing-wuzhen": { mode: "🚄 AV + taxi", duration: "5h30–6h", cost: 150, note: "Pechino Sud → Tongxiang in AV, poi ~20 min di taxi per Wuzhen" },
  "beijing-suzhou": { mode: "🚄 Alta velocità", duration: "4h–4h30", cost: 140, note: "Pechino Sud → Suzhou / Suzhou Nord" },
  "beijing-shanghai": { mode: "🚄 Alta velocità", duration: "4h30", cost: 150, note: "Pechino Sud → Shanghai Hongqiao" },
  "beijing-hangzhou": { mode: "🚄 Alta velocità", duration: "4h30–5h", cost: 155, note: "Pechino Sud → Hangzhou Est" },
  "beijing-pingyao": { mode: "🚄 Alta velocità", duration: "~4h", cost: 100, note: "Pechino → Pingyao Gucheng" },
  "pingyao-xian": { mode: "🚄 Alta velocità", duration: "~3h", cost: 80, note: "Pingyao Gucheng → Xi'an Nord" },
  "xian-huashan": { mode: "🚄 Alta velocità", duration: "30–40 min", cost: 30, note: "Xi'an Nord → Huashan Nord" },
  "xian-luoyang": { mode: "🚄 Alta velocità", duration: "~1h30", cost: 50, note: "Xi'an Nord → Luoyang Longmen" },
  "xian-wudangshan": { mode: "🚄 Alta velocità", duration: "~2h", cost: 60, note: "Nuova linea AV Xi'an–Wuhan (aperta a giugno 2026)" },
  "xian-chengdu": { mode: "🚄 Alta velocità", duration: "3h30–4h", cost: 95, note: "Xi’an North → Chengdu East" },
  "xian-zhangjiajie": { mode: "✈️ Volo diretto", duration: "1h50", cost: 150, note: "Xianyang → Hehua, ~19 voli a settimana (China Eastern, Sichuan Airlines…); niente AV diretta" },
  "chengdu-chongqing": { mode: "🚄 Alta velocità", duration: "1h15–1h45", cost: 40, note: "Chengdu East → Chongqing; ~160 ¥ a testa, corse ogni pochi minuti" },
  "chengdu-zhangjiajie": { mode: "🚄 Alta velocità", duration: "~4h", cost: 105, note: "Chengdu East → Zhangjiajie West diretto, es. G2445 08:00 → 11:58 (~415 ¥ a testa)" },
  "chongqing-zhangjiajie": { mode: "🚄 Alta velocità", duration: "2h49", cost: 62, note: "Chongqing East → Zhangjiajie West, es. G4601 09:24 → 12:13 (~246 ¥ a testa); ferma a Wulong Sud" },
  "zhangjiajie-shanghai": { mode: "✈️ Volo diretto", duration: "~2h", cost: 180, note: "Hehua → Pudong, 3 voli al giorno (mattina, pomeriggio, sera); in alternativa AV diretta G221 per Hongqiao ~7h20" },
  "chengdu-qingcheng-dujiangyan": { mode: "🚄 Alta velocità", duration: "30–50 min", cost: 15, note: "Chengdu → Qingchengshan / Dujiangyan, anche A/R in giornata" },
  "wuzhen-hangzhou": { mode: "🚌 Bus diretto", duration: "~1h", cost: 20, note: "Wuzhen → Hangzhou, bus frequenti" },
  "wuzhen-shanghai": { mode: "🚌 Bus / Didi", duration: "1h30–2h", cost: 60, note: "Wuzhen → Shanghai; in alternativa taxi per Tongxiang + AV" },
  "hangzhou-suzhou": { mode: "🚄 Alta velocità", duration: "~1h30", cost: 45, note: "Hangzhou Est → Suzhou" },
  "suzhou-putuoshan": { mode: "🚄 AV + bus + traghetto", duration: "~4h", cost: 90, note: "Suzhou → Ningbo in AV, poi bus e traghetto per Putuoshan" },
};

// Agenda iniziale con le date del piano originale: al caricamento ogni blocco riceve il suo
// giorno dentro la tappa ("day"), e da lì in poi la data si ricalcola dalle notti.
export const initialSchedule: ScheduleItem[] = [
  { id: "d01-arrival", date: "2026-11-17", stopId: "beijing", startTime: "12:25", endTime: "15:30", name: "Arrivo a Pechino e transfer", category: "trasporto", location: "PEK → hotel", notes: "Ritiro bagagli e check-in. Non fissare attività impegnative.", price: 0, bookingStatus: "prenotato" },
  { id: "d01-evening", date: "2026-11-17", stopId: "beijing", startTime: "17:30", endTime: "20:00", name: "Passeggiata nei hutong e cena", category: "cibo", location: "Shichahai / Gulou", notes: "Serata leggera per assorbire il fuso orario.", price: 35, bookingStatus: "non-serve" },
  { id: "d02-forbidden", date: "2026-11-18", stopId: "beijing", startTime: "08:30", endTime: "13:00", name: "Tian’anmen e Città Proibita", category: "visita", location: "Ingresso Meridian Gate", notes: "Passaporti con sé. Prenotare appena apre la finestra ufficiale.", price: 24, bookingStatus: "da-prenotare", sourceActivityId: "forbidden-city" },
  { id: "d02-jingshan", date: "2026-11-18", stopId: "beijing", startTime: "14:00", endTime: "17:00", name: "Jingshan e Beihai", category: "visita", location: "Jingshan Park", notes: "Salita al belvedere prima del tramonto.", price: 5, bookingStatus: "non-serve" },
  { id: "d03-wall", date: "2026-11-19", stopId: "beijing", startTime: "07:30", endTime: "16:30", name: "Grande Muraglia di Mutianyu", category: "visita", location: "Mutianyu", notes: "Partenza presto; verificare transfer privato o bus turistico.", price: 110, bookingStatus: "da-prenotare", sourceActivityId: "great-wall" },
  { id: "d03-duck", date: "2026-11-19", stopId: "beijing", startTime: "19:00", endTime: "21:00", name: "Cena con anatra alla pechinese", category: "cibo", location: "Dongcheng", notes: "Prenotare un ristorante vicino all’hotel.", price: 55, bookingStatus: "da-prenotare" },
  { id: "d04-train", date: "2026-11-20", stopId: "xian", startTime: "08:00", endTime: "14:30", name: "Treno Pechino → Xi’an", category: "trasporto", location: "Beijing West → Xi’an North", notes: "Arrivare in stazione almeno 60 minuti prima.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d04-quarter", date: "2026-11-20", stopId: "xian", startTime: "17:30", endTime: "20:30", name: "Quartiere musulmano e Drum Tower", category: "cibo", location: "Huimin Jie", notes: "Street food e prima passeggiata sulle mura.", price: 30, bookingStatus: "non-serve" },
  { id: "d05-terracotta", date: "2026-11-21", stopId: "xian", startTime: "08:00", endTime: "14:00", name: "Esercito di Terracotta", category: "visita", location: "Emperor Qinshihuang’s Mausoleum", notes: "Transfer A/R; guida opzionale.", price: 60, bookingStatus: "da-prenotare", sourceActivityId: "terracotta" },
  { id: "d05-wall", date: "2026-11-21", stopId: "xian", startTime: "16:00", endTime: "19:00", name: "Mura di Xi’an al tramonto", category: "visita", location: "South Gate", notes: "Valutare noleggio bici in base al meteo.", price: 18, bookingStatus: "non-serve" },
  { id: "d06-train", date: "2026-11-22", stopId: "chengdu", startTime: "09:00", endTime: "14:30", name: "Treno Xi’an → Chengdu", category: "trasporto", location: "Xi’an North → Chengdu East", notes: "Check-in hotel e pomeriggio tranquillo.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d06-jinli", date: "2026-11-22", stopId: "chengdu", startTime: "17:00", endTime: "20:30", name: "Jinli Street e cena Sichuan", category: "cibo", location: "Jinli Ancient Street", notes: "Chiedere livello di piccantezza medio.", price: 40, bookingStatus: "non-serve" },
  { id: "d07-pandas", date: "2026-11-23", stopId: "chengdu", startTime: "07:00", endTime: "12:30", name: "Chengdu Panda Base", category: "visita", location: "Research Base of Giant Panda Breeding", notes: "Essere all’ingresso all’apertura: i panda sono più attivi al mattino.", price: 30, bookingStatus: "da-prenotare", sourceActivityId: "pandas" },
  { id: "d07-tea", date: "2026-11-23", stopId: "chengdu", startTime: "15:00", endTime: "18:00", name: "People’s Park e casa da tè", category: "tempo-libero", location: "Heming Teahouse", notes: "Pomeriggio lento; eventuale opera Sichuan la sera.", price: 20, bookingStatus: "non-serve" },
  { id: "d08-flight", date: "2026-11-24", stopId: "kunming", startTime: "09:00", endTime: "13:00", name: "Volo Chengdu → Kunming", category: "trasporto", location: "CTU/TFU → KMG", notes: "Controllare aeroporto di partenza prima di prenotare.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d08-lake", date: "2026-11-24", stopId: "kunming", startTime: "16:00", endTime: "19:00", name: "Green Lake e Yuantong Street", category: "tempo-libero", location: "Cuihu Park", notes: "Passeggiata di orientamento e cena Yunnan.", price: 25, bookingStatus: "non-serve" },
  { id: "d09-stone", date: "2026-11-25", stopId: "kunming", startTime: "08:00", endTime: "17:00", name: "Foresta di Pietra di Shilin", category: "visita", location: "Shilin Scenic Area", notes: "Escursione intera giornata; portare strato antivento.", price: 80, bookingStatus: "da-prenotare", sourceActivityId: "stone-forest" },
  { id: "d10-dianchi", date: "2026-11-26", stopId: "kunming", startTime: "09:30", endTime: "13:00", name: "Dianchi Lake e Western Hills", category: "visita", location: "Haigeng Park", notes: "Tenere il pomeriggio libero per lavanderia e preparazione treno.", price: 25, bookingStatus: "non-serve" },
  { id: "d10-buffer", date: "2026-11-26", stopId: "kunming", startTime: "15:00", endTime: "18:00", name: "Tempo cuscinetto e organizzazione", category: "tempo-libero", location: "Hotel / centro", notes: "Controllare biglietti e meteo per Zhangjiajie.", price: 0, bookingStatus: "non-serve" },
  { id: "d11-transfer", date: "2026-11-27", stopId: "zhangjiajie", startTime: "07:30", endTime: "16:30", name: "Kunming → Zhangjiajie", category: "trasporto", location: "Treno con cambio / volo", notes: "Tratta critica: bloccare l’opzione definitiva appena escono gli orari.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d11-checkin", date: "2026-11-27", stopId: "zhangjiajie", startTime: "18:00", endTime: "20:00", name: "Cena e acquisti a Wulingyuan", category: "cibo", location: "Wulingyuan", notes: "Dopo il check-in, acquistare snack e acqua per il parco.", price: 25, bookingStatus: "non-serve" },
  { id: "d12-park", date: "2026-11-28", stopId: "zhangjiajie", startTime: "07:30", endTime: "17:30", name: "Zhangjiajie National Forest Park", category: "visita", location: "Wulingyuan Entrance", notes: "Itinerario Yuanjiajie + Tianzi Mountain; adattare a meteo e code.", price: 90, bookingStatus: "da-prenotare", sourceActivityId: "forest-park" },
  { id: "d13-fenghuang", date: "2026-11-29", stopId: "fenghuang", startTime: "09:00", endTime: "12:00", name: "Trasferimento a Fenghuang", category: "trasporto", location: "Zhangjiajie → Fenghuanggucheng", notes: "Treno veloce e Didi fino all’alloggio.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d13-river", date: "2026-11-29", stopId: "fenghuang", startTime: "15:00", endTime: "20:30", name: "Città antica e Tuojiang illuminato", category: "visita", location: "Fenghuang Ancient Town", notes: "Barca prima del tramonto; passeggiata serale.", price: 15, bookingStatus: "non-serve", sourceActivityId: "tuojiang" },
  { id: "d14-wuzhen", date: "2026-11-30", stopId: "wuzhen", startTime: "07:00", endTime: "16:00", name: "Fenghuang → Wuzhen", category: "trasporto", location: "Via Changsha / Tongxiang", notes: "Seconda tratta critica; lasciare margine tra i cambi.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d14-xizha", date: "2026-11-30", stopId: "wuzhen", startTime: "17:30", endTime: "20:30", name: "Xizha di sera", category: "visita", location: "Xizha Scenic Area", notes: "Dormire dentro o vicino all’area scenica.", price: 40, bookingStatus: "da-prenotare", sourceActivityId: "xizha" },
  { id: "d15-suzhou", date: "2026-12-01", stopId: "suzhou", startTime: "09:00", endTime: "11:00", name: "Transfer Wuzhen → Suzhou", category: "trasporto", location: "Hotel → Suzhou", notes: "Didi o transfer prenotato.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d15-gardens", date: "2026-12-01", stopId: "suzhou", startTime: "12:00", endTime: "17:00", name: "Giardini classici e Pingjiang Road", category: "visita", location: "Humble Administrator’s Garden", notes: "Giardino prima, canali e cena dopo.", price: 20, bookingStatus: "da-prenotare", sourceActivityId: "humble-garden" },
  { id: "d16-shanghai", date: "2026-12-02", stopId: "shanghai", startTime: "09:00", endTime: "11:30", name: "Treno Suzhou → Shanghai", category: "trasporto", location: "Suzhou → Shanghai", notes: "Preferire Hongqiao se comodo per l’hotel.", price: 0, bookingStatus: "da-prenotare" },
  { id: "d16-bund", date: "2026-12-02", stopId: "shanghai", startTime: "14:00", endTime: "20:00", name: "Concessione Francese e Bund", category: "visita", location: "Xintiandi → Bund", notes: "Arrivare sul Bund poco prima dell’accensione delle luci.", price: 20, bookingStatus: "non-serve" },
  { id: "d17-shanghai", date: "2026-12-03", stopId: "shanghai", startTime: "09:30", endTime: "13:00", name: "Yu Garden e Old City", category: "visita", location: "Yuyuan", notes: "Ultimi acquisti senza allontanarsi troppo.", price: 20, bookingStatus: "da-prenotare" },
  { id: "d17-tower", date: "2026-12-03", stopId: "shanghai", startTime: "16:00", endTime: "19:00", name: "Shanghai Tower e ultima cena", category: "visita", location: "Lujiazui", notes: "Scegliere fascia tramonto; preparare i bagagli prima di uscire.", price: 45, bookingStatus: "da-prenotare", sourceActivityId: "tower" },
];

// ---------------------------------------------------------------------------
// Checklist di preparazione
// ---------------------------------------------------------------------------

export const CHECKLIST_GROUPS: Array<{ id: ChecklistGroup; title: string; subtitle: string }> = [
  { id: "pianificazione", title: "Prenotazioni e documenti", subtitle: "Gli hotel che mancano e le carte per entrare in Cina" },
  { id: "a-casa", title: "A casa, prima di partire", subtitle: "Dalla Cina è impossibile (siti e store bloccati) o una pessima idea" },
  { id: "ultima-settimana", title: "Ultima settimana", subtitle: "Finestre di vendita e controlli finali" },
  { id: "arrivo", title: "All’arrivo", subtitle: "Le prime ore in Cina" },
  { id: "altro", title: "Altro", subtitle: "Punti aggiunti da voi" },
];

/** 12306 vende i treni dei prossimi 15 giorni, oggi compreso: un treno del 20 si compra dal 6. */
export const TRAIN_SALE_DAYS = 15;

/** Spunte salvate per posizione in `checklist`: non riordinare, solo aggiungere in fondo (o ritirare). */
export const defaultChecklist: Array<Omit<PrepItem, "id">> = [
  { label: "Confermare ritmo e tappe insieme", group: "pianificazione", retired: true },
  { label: "Prenotare hotel cancellabili", group: "pianificazione", hint: "Solo hotel che accettano stranieri: Trip.com e Booking mostrano solo quelli, e al check-in fanno loro la registrazione in polizia. La cancellazione gratuita scade spesso a mezzogiorno (ora cinese) del giorno prima, non a mezzanotte." },
  { label: "Risolvere Kunming → Zhangjiajie", group: "pianificazione", retired: true },
  { label: "Risolvere Fenghuang → Wuzhen", group: "pianificazione", retired: true },
  { label: "Prenotare ingressi di Pechino", group: "ultima-settimana", due: "2026-11-10", hint: "Città Proibita: tour già prenotato. I musei nazionali sono gratuiti ma su prenotazione (WeChat o sito) con il numero di passaporto di ognuno; molti chiudono il lunedì." },
  { label: "Verificare visto / ingresso in Cina", group: "pianificazione", due: "2026-11-03", hint: "Passaporto italiano: niente visto fino a 30 giorni (politica unilaterale, per ingressi fino al 31/12/2026), e 17 nov → 4 dic ci sta. È una politica, non un diritto: ricontrollare lista e scadenza sul sito dell’ambasciata prima di partire." },
  { label: "Preparare eSIM, VPN e mappe offline", group: "a-casa", due: "2026-11-03", hint: "I passaggi, uno per uno, sono qui sotto; le app una per una sono nella «Guida».", guide: "guide-apps" },
  { label: "Confermare assicurazione viaggio", group: "a-casa", due: "2026-11-10", hint: "Con copertura medica: in Cina le cure si pagano subito. A viaggio iniziato non si può più comprare. Numero di polizza e dell’assistenza in una nota leggibile anche offline." },
];

/** Punti aggiunti alla checklist dalle migrazioni v7–v8; gli id non vanno cambiati, i nuovi in fondo al gruppo. */
export const PREP_CHECKLIST: PrepItem[] = [
  { id: "prep-passport", group: "pianificazione", due: "2026-11-03", label: "Passaporti validi almeno 6 mesi dopo il rientro (oltre il 4 giugno 2027)", hint: "Se uno dei due scade prima va rinnovato subito: senza, niente ingresso." },
  { id: "prep-papers", group: "pianificazione", due: "2026-11-14", label: "Volo di ritorno e primo hotel salvati offline (o stampati)", hint: "All’immigrazione possono chiederli; servono anche per la arrival card." },

  { id: "prep-esim-buy", group: "a-casa", due: "2026-11-03", label: "Comprare un’eSIM roaming per tutti e due (Nomad o BNESIM)", hint: "I dati in roaming escono all’estero e non passano dal firewall: Google, WhatsApp e Instagram funzionano senza VPN. Dalla Cina i siti e gli store delle eSIM sono bloccati. BNESIM costa molto meno di Holafly e Airalo (provata a ottobre 2026); per Nomad il codice BBIYPGMWJSLW dà 5 USD di sconto. Il profilo installato deve essere per la Cina: le ricariche restano legate alla copertura iniziale e dalla Cina non se ne installa uno nuovo.", links: [{ label: "BNESIM", url: "https://www.bnesim.com/" }, { label: "Nomad", url: "https://www.nomadesim.com/" }] , guide: "app-esim" },
  { id: "prep-esim-install", group: "a-casa", due: "2026-11-03", label: "Installare l’eSIM a casa, da accendere all’atterraggio", hint: "L’installazione richiede internet: farla in Italia su entrambi i telefoni e controllare che compaia come seconda linea dati." },
  { id: "prep-home-sim", group: "a-casa", due: "2026-11-03", label: "SIM italiana attiva in roaming per gli SMS, ma con i dati spenti", hint: "Ogni app cinese manda un codice via SMS al numero italiano. Doppia SIM: eSIM per i dati, SIM italiana per chiamate e codici, con i dati in roaming disattivati per non pagare il roaming extra-UE." },
  { id: "prep-vpn", group: "a-casa", due: "2026-11-03", label: "Una VPN a pagamento di riserva, installata e provata", hint: "LetsVPN, ExpressVPN o Astrill; quelle gratuite in Cina quasi mai funzionano. Astrill, la più consigliata, a Pechino lasciava passare poco. Claude, ChatGPT e molte banche bloccano le VPN (IP da datacenter) e a volte anche l’uscita a Hong Kong dell’eSIM. Provare ogni dispositivo, portatile compreso: un Mac che non si collega, scoperto in hotel a Pechino, è troppo tardi." , guide: "app-vpn" },
  { id: "prep-alipay", group: "a-casa", due: "2026-11-03", label: "Alipay su entrambi i telefoni: passaporto verificato e carta collegata", hint: "Registrazione con il numero di telefono, foto del passaporto e selfie, poi Visa/Mastercard; se l’app lo consente, una piccola ricarica di prova. Farlo a casa: la verifica può bloccarsi per ore o chiedere l’app della banca. Le mini-app di Alipay (metro, DiDi, biglietti) sostituiscono mezza dozzina di app. Impostare password di accesso e Face ID, e non fare logout durante il viaggio." , guide: "app-alipay" },
  { id: "prep-wechat", group: "a-casa", due: "2026-11-03", label: "WeChat Pay attivo (Io → Servizi → Portafoglio)", hint: "Stessa carta di Alipay. Molti biglietti ufficiali (Città Proibita compresa) si vendono solo nei mini-programmi WeChat, ed è il modo in cui hotel e guide vi contatteranno. Funziona anche senza VPN." , guide: "app-wechat" },
  { id: "prep-cards", group: "a-casa", due: "2026-11-03", label: "Carte fisiche in valigia, non solo Apple/Google Pay", hint: "Con carta estera Alipay e WeChat sono gratis fino a ¥200 a pagamento; oltre si paga il 3% su tutto (un hotel da ¥2.000 costa ¥60 in più). Sopra ¥200 meglio la carta fisica: hotel, ristoranti e grandi negozi la prendono anche se non lo dicono, con PIN e spesso firma. Il pagamento dal telefono è spesso rifiutato." , guide: "app-cards" },
  { id: "prep-gaode", group: "a-casa", due: "2026-11-10", label: "Mappe Gaode (高德地图) installate, con il numero italiano o l’Apple ID", hint: "Google Maps è bloccato e in Cina sfasato di centinaia di metri; anche Mappe di Apple funziona (usa i dati di Gaode). Iscriversi dall’app, non dal sito, con il +39: i luoghi salvati restano nell’account. Dall’Italia l’accesso spesso fallisce («the current mobile number does not support this login method», e via WeChat «region not supported»): allora usarla senza account, come fa chi è in Cina adesso, e tenere i posti qui nel planner. In Impostazioni si passa all’inglese, ma la parte taxi resta in cinese." , guide: "app-gaode" },
  { id: "prep-didi", group: "a-casa", due: "2026-11-10", label: "Aprire una volta DiDi dentro Alipay (mini-programma in inglese)", hint: "Meglio della app separata: paga dal portafoglio. Per il tassista c’è «🚕 Mostra in cinese» sugli hotel di questo planner." , guide: "app-didi" },
  { id: "prep-metro", group: "a-casa", due: "2026-11-10", label: "Scaricare MetroMan (metro in inglese, anche offline)", hint: "Scaricare prima le città del viaggio. Ai tornelli si passa con il QR «Transport» (乘车码) di Alipay, da attivare città per città; a Pechino e Shanghai va anche la carta contactless.", links: [{ label: "MetroMan", url: "https://www.metroman.cn/" }] , guide: "app-metro" },
  { id: "prep-translate", group: "a-casa", due: "2026-11-10", label: "Scaricare il cinese offline di Google Traduttore", hint: "Dalla Cina è impossibile: Google è bloccato e lì funziona solo il pacchetto offline, da provare con il Wi-Fi spento. Pleco per i caratteri: aprirlo una volta con il Wi-Fi perché scarichi il dizionario." , guide: "app-google-offline" },
  { id: "prep-phrases", group: "a-casa", due: "2026-11-10", label: "Imparare cinque frasi", hint: "你好 nǐ hǎo, ciao · 谢谢 xièxie, grazie · 这个 zhège, questo · 多少钱 duōshao qián, quanto costa · 不用 búyòng, non serve." },
  { id: "prep-meds", group: "a-casa", due: "2026-11-10", label: "Farmaci abituali in confezione originale, con copia della ricetta", hint: "Più paracetamolo, cerotti, sali reidratanti e qualcosa per lo stomaco: in farmacia le marche sono diverse." },
  { id: "prep-air", group: "a-casa", due: "2026-11-10", label: "Due mascherine KN95 e un’app per la qualità dell’aria", hint: "A fine novembre al nord (Pechino, Xi’an) l’aria può essere pessima." },
  { id: "prep-cash", group: "a-casa", due: "2026-11-14", label: "Un po’ di contanti: ¥500–1.000", hint: "Per i rari mercati o taxi solo contanti. I bancomat di Bank of China, ICBC e CCB prendono le carte estere; in città il cambio è migliore che in aeroporto. Oltre 5.000 USD (o ¥20.000) vanno dichiarati all’ingresso." },
  { id: "prep-powerbank", group: "a-casa", due: "2026-11-14", label: "Power bank sotto 100 Wh e con il marchio 3C", hint: "Dal 2025 sui voli interni quelli senza 3C vengono sequestrati ai controlli, e anche in stazione controllano la capacità. Sempre nel bagaglio a mano. In alternativa se ne compra uno lì (Xiaomi, Anker China, ~¥100)." },
  { id: "prep-adapter", group: "a-casa", due: "2026-11-14", label: "Un adattatore universale a testa, caricatore e cavo", hint: "220 V / 50 Hz: i caricatori di telefono e PC vanno bene. Le spine europee piatte a due poli e quelle USA entrano nei fori in alto; Schuko e tre poli no (il foro in basso è il tipo I, a tre lamelle come in Australia)." },
  { id: "prep-tissues", group: "a-casa", due: "2026-11-14", label: "Fazzoletti e gel per le mani in borsa", hint: "Bagni pubblici gratuiti e frequenti, ma spesso alla turca e senza carta." },
  { id: "prep-bank", group: "a-casa", due: "2026-11-03", label: "Avvisare le banche del viaggio e attivare i pagamenti esteri e online", hint: "Un addebito via QR cinese sembra una frode: meglio che la banca lo sappia. Controllare anche se i codici di conferma arrivano via SMS o nell’app della banca: se via SMS, la SIM italiana deve restare raggiungibile." , guide: "app-cards" },
  { id: "prep-backup-card", group: "a-casa", due: "2026-11-03", label: "Una carta di riserva di un’altra banca, tenuta separata", hint: "Una carta bloccata il primo giorno blocca anche Alipay e WeChat." , guide: "app-cards" },
  { id: "prep-work-tunnel", group: "a-casa", due: "2026-11-03", label: "Solo se serve lavorare o usare Claude/ChatGPT: un tunnel proprio", hint: "Claude, ChatGPT e molte banche bloccano chi è in Cina, chi esce da un datacenter (tutte le VPN commerciali) e spesso anche Hong Kong (l’eSIM). Serve un server proprio: VPS a Tokyo o Singapore (~10 $/mese) con VLESS + REALITY, sito esca www.apple.com (con microsoft.com non va), Shadowrocket (~3 $) su iPhone e Mac, v2rayNG su Android; per Claude l’uscita deve essere una connessione di casa. Configurazioni importate con il QR, mai a mano, e provate su ogni dispositivo prima di partire.", guide: "guide-internet" },
  { id: "prep-offline-map", group: "a-casa", due: "2026-11-10", label: "Organic Maps con le regioni del viaggio scaricate", hint: "Mappa offline senza dati, firewall né account: funziona anche in metropolitana o senza segnale. I pacchetti pesano centinaia di MB: scaricarli con il Wi-Fi e provare in modalità aereo.", links: [{ label: "Organic Maps", url: "https://organicmaps.app/" }] , guide: "app-organic" },
  { id: "prep-baidu", group: "a-casa", due: "2026-11-10", label: "Baidu Translate (百度翻译) installata e provata con la fotocamera", hint: "In Cina è il traduttore principale: Google lì funziona solo offline. Trucco per le app solo in cinese: fare uno screenshot e importarlo in Baidu dall’album." , guide: "app-baidu" },
  { id: "prep-booking-apps", group: "a-casa", due: "2026-11-14", label: "App delle prenotazioni installate e loggate, conferme in screenshot", hint: "Il codice o QR da mostrare in stazione sta dentro l’app (Trip.com, 12306…): una pagina di login che non si apre al tornello non serve. Screenshot di ogni treno e hotel in un album, con gli indirizzi in cinese." , guide: "app-trip" },
  { id: "prep-offline-kit", group: "a-casa", due: "2026-11-14", label: "Password, codici di recupero e conferme salvati offline su due dispositivi", hint: "Dalla Cina molte pagine di account e siti dei fornitori non si aprono: quello che non avete salvato prima, non l’avete." },
  { id: "prep-phone-backup", group: "a-casa", due: "2026-11-14", label: "Backup dei telefoni prima di partire (chat di WeChat comprese)", hint: "Se un telefono si perde o si rompe, si riparte da lì." },

  { id: "prep-12306", group: "ultima-settimana", due: "2026-11-04", label: "Registrarsi a Railway 12306 dall’app, non dal sito", hint: "All’iscrizione l’app mostra un banner per stranieri: scansiona il passaporto e compila il modulo. L’e-mail di conferma può non arrivare mai: entrare comunque dall’app. Dal sito si resta chiusi fuori. 12306 non ha commissioni, Trip.com ~€6–7 a biglietto." , guide: "app-12306" },
  { id: "prep-trains", group: "ultima-settimana", label: "Prenotare i treni veloci appena aprono le vendite", hint: "Il passaporto è il biglietto: si scansiona al tornello. Arrivare 45–60 minuti prima (controllo documenti e bagagli) e controllare la stazione: Beijing West ≠ Beijing South. I posti restituiti ricompaiono prima su 12306; per cambi e rimborsi con passaporto straniero Trip.com è la via più semplice. Su Trip.com si può anche ordinare prima dell’apertura: comprano loro i biglietti appena escono." },
  { id: "prep-tickets", group: "ultima-settimana", due: "2026-11-10", label: "Prenotare le altre visite a numero chiuso (Terracotta, panda, musei)", hint: "Serve il numero di passaporto di ognuno e i posti famosi finiscono pochi minuti dopo l’uscita: segnarsi giorno e ora e farsi trovare pronti. Su Trip.com a volte la voce è un tour o un combo: leggere cosa include. Panda: la base di Wolong è a ~2 h di bus da Chengdu, bellissima e quasi vuota (ottobre 2026)." },
  { id: "prep-airport", group: "ultima-settimana", due: "2026-11-14", label: "Studiare il tragitto aeroporto → primo hotel di Pechino", hint: "Terminal d’arrivo e orari di metro/Airport Express (molti chiudono verso le 22–23), poi DiDi da Alipay o la fila dei taxi ufficiali. Rifiutare chi vi avvicina in sala arrivi. L’indirizzo in cinese è in «🚕 Mostra in cinese» nella scheda hotel." },
  { id: "prep-arrival-card", group: "ultima-settimana", due: "2026-11-16", label: "Compilare online la arrival card (dal 14 nov)", hint: "Nei 3 giorni prima dell’arrivo: sito s.nia.gov.cn, app NIA 12367 o mini-programma Alipay/WeChat, una a testa. Servono passaporto, numero di volo e indirizzo del primo hotel. Non è obbligatoria, ma evita la coda.", links: [{ label: "Arrival card online (NIA)", url: "https://s.nia.gov.cn/" }] },

  { id: "prep-first-hour", group: "arrivo", due: "2026-11-17", label: "In aeroporto: eSIM accesa, WhatsApp e Google che funzionano", hint: "Prima di uscire, finché c’è il Wi-Fi e qualcuno a cui chiedere. All’immigrazione prima i chioschi delle impronte (tutte e dieci le dita), poi la fila per stranieri." },
  { id: "prep-alipay-check", group: "arrivo", due: "2026-11-17", label: "Aprire Alipay: la carta è ancora collegata?", hint: "Al primo uso in Cina a volte chiede di riverificare. Già che ci siete, attivare il QR «Transport» per la metro di Pechino." },
  { id: "prep-passport-photo", group: "arrivo", due: "2026-11-17", label: "Foto della pagina del passaporto e del timbro d’ingresso nel telefono", hint: "Il passaporto originale va sempre con sé (treni, musei, hotel e parchi lo controllano, una foto non basta); la foto serve per i moduli o in caso di smarrimento." },
  { id: "prep-local-sim", group: "arrivo", due: "2026-11-17", label: "SIM cinese, solo se serve un numero +86", hint: "Di solito basta il numero italiano, ma Dianping, RedNote e la app DiDi vogliono un +86 (e il tassista vi può chiamare). Sportello China Mobile agli arrivi (PEK: T3C, vicino al nastro 38) o in città (王府井大街200号, 工美大厦B1), con il passaporto: chiedere per nome 30天灵动卡 e prima di pagare controllare le quattro righe 有效期30天 · 到期自动注销 · 不自动续费 · 无欠费. Mai 到期停机 (solo «sospesa»: la linea resta a vostro nome e accumula debiti). Foto della schermata del piano e della ricevuta: a chi c’è stato hanno venduto due volte una SIM da 1 GB al prezzo di una «big data». La SIM italiana tolta va nel portadocumenti, con lo spillo." , guide: "app-sim-cn" },
];

/**
 * Blocchi "treno/volo tra città" dell'agenda iniziale: ora le tratte hanno orari propri e
 * compaiono da sole nel giorno giusto, quindi questi doppioni vengono assorbiti nelle tratte.
 */
export const DEFAULT_TRANSFER_ITEMS: Record<string, [string, string]> = {
  "d04-train": ["beijing", "xian"],
  "d06-train": ["xian", "chengdu"],
  "d08-flight": ["chengdu", "kunming"],
  "d11-transfer": ["kunming", "zhangjiajie"],
  "d13-fenghuang": ["zhangjiajie", "fenghuang"],
  "d14-wuzhen": ["fenghuang", "wuzhen"],
  "d15-suzhou": ["wuzhen", "suzhou"],
  "d16-shanghai": ["suzhou", "shanghai"],
};


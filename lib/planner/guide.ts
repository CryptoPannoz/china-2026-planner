import type { TaxiInfo } from "./types";

// ---------------------------------------------------------------------------
// Guida alla Cina: app, internet, consigli per città. Solo catalogo, niente nel piano salvato.
// Raccolta dalla lista «Prepare» e dalle guide di chi in Cina c’è stato nel 2026.
// ---------------------------------------------------------------------------

/** Lista originale (serve l’accesso): la guida qui sotto ne riporta tutto quello che ci serve. */
export const GUIDE_SOURCE_URL = "https://china.adormo.com/v2/prepare";

export type GuideWhen = "prima" | "consigliata" | "facoltativa" | "arrivo";

export const GUIDE_WHEN_LABELS: Record<GuideWhen, string> = {
  prima: "Prima di partire",
  consigliata: "Consigliata",
  facoltativa: "Facoltativa",
  arrivo: "All’arrivo",
};

export type GuideApp = {
  id: string;
  icon: string;
  name: string;
  zh?: string;
  when: GuideWhen;
  why: string;
  watch?: string;
  steps: string[];
  links?: Array<{ label: string; url: string }>;
  /** Punto della checklist che riguarda l’app: la scheda mostra se è già sistemato. */
  checkId?: string;
  /** Testi da mostrare a schermo intero allo sportello o al tassista. */
  showZh?: TaxiInfo[];
};

export const GUIDE_APP_GROUPS: Array<{ id: string; title: string; apps: GuideApp[] }> = [
  {
    id: "connessione",
    title: "Connessione",
    apps: [
      {
        id: "app-vpn",
        icon: "🛡️",
        name: "VPN / web aperto",
        when: "prima",
        why: "Senza una via d’uscita, appena atterrati spariscono Google, Gmail, WhatsApp, Instagram, Claude e quasi tutto il web.",
        watch: "Un’app a pagamento installata adesso è l’unica assicurazione: dalla Cina gli store e i siti delle VPN sono bloccati. Le configurazioni vanno salvate offline, non solo in una casella di posta che da lì non si apre.",
        steps: [
          "Installare e provare a casa una VPN a pagamento (LetsVPN, ExpressVPN o Astrill); le gratuite in Cina quasi mai funzionano",
          "Provarla su ogni dispositivo, portatili compresi",
          "Per lavorare o usare Claude non basta: vedi «Internet dalla Cina» qui sotto",
        ],
        checkId: "prep-vpn",
      },
      {
        id: "app-esim",
        icon: "📶",
        name: "eSIM da viaggio · due linee dati",
        when: "prima",
        why: "L’eSIM in roaming esce all’estero (di solito a Hong Kong): niente firewall, e banche, AI e app occidentali che rifiutano un indirizzo cinese continuano a funzionare. Una SIM cinese, facoltativa, apre invece i servizi locali che vogliono un +86.",
        watch: "Se la SIM cinese prende il posto di quella italiana, l’italiana va in un posto preciso (portadocumenti o porta-carte) con lo spillo accanto: una SIM sciolta in valigia è una SIM persa, e servirà proprio quando avete fretta.",
        steps: [
          "Comprare e installare l’eSIM a casa: l’installazione richiede internet e dalla Cina non si fa",
          "Nomad, Airalo e Holafly vanno bene; BNESIM, usata in Cina a ottobre 2026, funziona ed è molto più economica",
          "Atterrare sull’eSIM; la SIM cinese, se serve, si compra in aeroporto con il passaporto",
          "Imparare dove il telefono cambia linea dati: eSIM per le app di casa, SIM cinese per quelle locali",
        ],
        links: [{ label: "BNESIM", url: "https://www.bnesim.com/" }, { label: "Nomad (codice BBIYPGMWJSLW: 5 USD di sconto)", url: "https://www.nomadesim.com/" }],
        checkId: "prep-esim-buy",
      },
      {
        id: "app-sim-cn",
        icon: "🇨🇳",
        name: "SIM cinese China Mobile, 30 giorni",
        zh: "中国移动 30天灵动卡",
        when: "arrivo",
        why: "Un vero numero +86 che riceve gli SMS: lo pretendono Dianping, RedNote e la app di DiDi, e così un tassista vi può chiamare. In più, dati locali economici.",
        watch: "La parola da pretendere è 到期自动注销, «cancellata alla scadenza». NON 到期停机, che vuol dire solo «sospesa»: la linea resta aperta a vostro nome e accumula debiti. A chi c’è stato hanno venduto due volte una SIM da 1 GB al prezzo di una «big data», anche negli sportelli ufficiali.",
        steps: [
          "Sportello China Mobile o Unicom in sala arrivi (Pechino PEK: T3C, vicino al nastro 38) o un negozio in città, con il passaporto",
          "Chiedere per nome 30天灵动卡, non «una SIM turistica» né un piano del catalogo",
          "Prima di pagare controllare le quattro righe: 有效期30天 · 到期自动注销 · 不自动续费 · 无欠费",
          "Fotografare la schermata del piano e la ricevuta",
          "A Pechino, se saltate l’aeroporto: 中国移动, 王府井大街200号 (工美大厦B1)",
          "Registrare Dianping e RedNote con il nuovo numero, aggiungerlo a DiDi, aggiornare 12306",
        ],
        checkId: "prep-local-sim",
        showZh: [
          {
            kind: "place",
            kicker: "您好，我想办这张卡，谢谢！",
            kickerIt: "«Buongiorno, vorrei fare questa SIM. Grazie!»",
            title: "SIM China Mobile da 30 giorni",
            titleZh: "30天灵动卡",
            subtitle: "Validità 30 giorni · cancellata alla scadenza · niente rinnovo automatico · niente debiti",
            subtitleZh: "有效期30天 · 到期自动注销 · 不自动续费 · 无欠费",
          },
          {
            kind: "place",
            title: "China Mobile, Wangfujing",
            titleZh: "中国移动 王府井营业厅",
            subtitle: "Wangfujing Dajie 200, piano B1 (Gongmei Dasha)",
            subtitleZh: "王府井大街200号 工美大厦B1",
          },
        ],
      },
    ],
  },
  {
    id: "pagare",
    title: "Pagare",
    apps: [
      {
        id: "app-alipay",
        icon: "💳",
        name: "Alipay",
        zh: "支付宝",
        when: "prima",
        why: "L’app più importante in Cina. Paga tutto con il QR, e le sue mini-app fanno da metro, taxi DiDi, bici, cibo a domicilio e biglietti: sostituisce mezza dozzina di app cinesi a cui da stranieri non ci si iscrive.",
        watch: "L’account è verificato sul passaporto, quindi è il portafoglio più recuperabile dei due: l’assistenza vi ridà l’accesso dall’identità. Con carta estera è gratis fino a ¥200 a pagamento, oltre si paga il 3% su tutto l’importo (limiti: 5.000 USD a pagamento, 50.000 l’anno).",
        steps: [
          "Installare e registrarsi con il numero di telefono",
          "Verificare l’identità con il passaporto (foto e selfie) e collegare Visa/Mastercard",
          "Aprire la mini-app «Transport» (乘车码) per metro e bus",
          "Impostare password di accesso e Face ID; niente logout durante il viaggio",
          "Farlo su tutti e due i telefoni: un solo portafoglio per due è un problema quando un telefono si scarica",
        ],
        links: [{ label: "Alipay", url: "https://www.alipay.com/" }],
        checkId: "prep-alipay",
      },
      {
        id: "app-wechat",
        icon: "💬",
        name: "WeChat",
        zh: "微信",
        when: "prima",
        why: "Pagamenti, e soprattutto il modo in cui ogni cinese, hotel e guida vi contatterà. Molti biglietti ufficiali, Città Proibita compresa, si vendono SOLO nei mini-programmi di WeChat.",
        watch: "È legato al numero italiano, ed è giusto così. L’unico intoppo: con la SIM italiana fuori dal telefono, una verifica via SMS vuol dire rimetterla. Succede di rado, ma tenete SIM e spillo a portata di mano.",
        steps: [
          "Installare e registrarsi (un account non appena creato è più affidabile)",
          "WeChat Pay: Io → Servizi → Portafoglio, con la stessa carta di Alipay",
          "Cercare il mini-programma della Città Proibita (故宫博物院) e controllare che si apra",
          "Backup cifrato del telefono prima di partire",
        ],
        links: [{ label: "WeChat", url: "https://www.wechat.com/" }],
        checkId: "prep-wechat",
      },
      {
        id: "app-cards",
        icon: "🏦",
        name: "Carte e contanti",
        when: "prima",
        why: "Non è un’app, ma tutte le app qui sopra dipendono da lì: una carta bloccata il primo giorno vi lascia a piedi.",
        watch: "Avvisate la banca che andate in Cina (un addebito via QR cinese sembra una frode), controllate che i pagamenti esteri e online siano attivi, e portate una seconda carta di un’altra banca più qualche centinaio di ¥: piccoli negozi e templi prendono ancora contanti.",
        steps: [
          "Controllare se il codice di conferma della banca arriva via SMS o nell’app: decide se la SIM italiana deve restare raggiungibile",
          "Avvisare la banca delle date del viaggio",
          "Pagamenti esteri e online attivi su entrambe le carte",
          "Una carta di riserva di un’altra banca, tenuta separata",
          "¥500–1.000 in contanti; sopra ¥200 pagare con la carta fisica, non dal telefono",
        ],
        checkId: "prep-bank",
      },
      {
        id: "app-unionpay",
        icon: "🏧",
        name: "UnionPay QuickPass",
        zh: "云闪付",
        when: "facoltativa",
        why: "L’app di pagamento di Stato: accetta carte estere e passa alla cassa occasionale che rifiuta Alipay o WeChat con carta straniera.",
        watch: "Niente da fare prima: è un’app cinese negli store cinesi, quindi (a differenza della VPN) si installa anche da lì.",
        steps: ["Solo se entrambi i portafogli vengono rifiutati a una cassa: installarla lì e collegare una carta"],
        links: [{ label: "UnionPay", url: "https://www.95516.com/" }],
      },
    ],
  },
  {
    id: "muoversi",
    title: "Muoversi",
    apps: [
      {
        id: "app-gaode",
        icon: "🗺️",
        name: "Gaode Maps",
        zh: "高德地图",
        when: "prima",
        why: "La mappa che in Cina funziona davvero: indirizzi giusti, metro e bus in tempo reale, percorsi a piedi, taxi. Google Maps è bloccato e i suoi dati cinesi sono sfasati anche con la VPN. Mappe di Apple usa gli stessi dati di Gaode.",
        watch: "I preferiti stanno nell’account, non nel telefono: perso l’accesso, persi i posti. Accedere con il numero italiano o con l’Apple ID, mai con la SIM cinese, che muore un mese dopo il ritorno e si porta via l’account. Dall’estero l’iscrizione spesso fallisce («the current mobile number does not support this login method», e via WeChat «region not supported»): provare dall’app con il +39 o con «Accedi con Apple», mai dal sito (solo in cinese). Se non va, usarla senza account, tenere i posti nel planner ed esportare spesso quelli salvati. L’inglese copre la mappa, non la parte taxi: lì tenete pronto l’indirizzo in cinese.",
        steps: [
          "Installare (App Store: 高德地图)",
          "Accedere con il numero italiano o l’Apple ID prima di salvare un solo posto",
          "Impostazioni → inglese",
          "Cercare un hotel di Pechino per vedere che funziona",
          "Sapere dov’è la sezione taxi, di riserva quando DiDi non trova auto",
        ],
        checkId: "prep-gaode",
      },
      {
        id: "app-didi",
        icon: "🚕",
        name: "DiDi",
        zh: "滴滴出行",
        when: "consigliata",
        why: "L’Uber cinese: niente discussioni con il tassista, niente contanti, e la destinazione è scritta in cinese, quindi non si perde niente.",
        watch: "La via più facile NON è l’app separata ma il mini-programma DiDi dentro Alipay: usa la carta e l’identità già verificate, senza un’altra iscrizione.",
        steps: [
          "Aprire il mini-programma DiDi in Alipay e controllare che si carichi",
          "L’app separata solo quando avete il numero cinese, registrandola con quello",
          "Salvare l’indirizzo di ogni hotel tra i preferiti appena prenotato",
        ],
        links: [{ label: "DiDi", url: "https://www.didiglobal.com/" }],
        checkId: "prep-didi",
      },
      {
        id: "app-organic",
        icon: "🧭",
        name: "Organic Maps (offline)",
        when: "consigliata",
        why: "Zero dati, zero firewall, zero account. Con la VPN giù, l’eSIM senza segnale o sottoterra, vi dice comunque dove siete.",
        watch: "Scaricare le regioni della Cina PRIMA di partire: i pacchetti pesano centinaia di MB.",
        steps: ["Installare", "Scaricare Pechino e le regioni del viaggio con il Wi-Fi", "Provare in modalità aereo"],
        links: [{ label: "Organic Maps", url: "https://organicmaps.app/" }],
        checkId: "prep-offline-map",
      },
      {
        id: "app-metro",
        icon: "🚇",
        name: "MetroMan · metro in inglese",
        zh: "地铁通",
        when: "consigliata",
        why: "Le app ufficiali delle metropolitane sono solo in cinese. MetroMan ha le reti di tutte le grandi città in inglese, funziona offline e dà percorso, cambi e uscita giusta.",
        watch: "Pianifica il viaggio, non lo paga: al tornello serve il QR «Transport» di Alipay (乘车码), una carta contactless dove la accettano (Pechino, Shanghai, Guangzhou, Shenzhen) o un gettone comprato alla macchinetta.",
        steps: ["Installare (App Store / Play: «MetroMan»)", "Scaricare le città del viaggio prima di partire", "Attivare il QR Transport di Alipay in ogni città, all’arrivo"],
        links: [{ label: "MetroMan", url: "https://www.metroman.cn/" }],
        checkId: "prep-metro",
      },
    ],
  },
  {
    id: "treni",
    title: "Treni e prenotazioni",
    apps: [
      {
        id: "app-trip",
        icon: "🚄",
        name: "Trip.com",
        zh: "携程",
        when: "prima",
        why: "Treni, hotel e alcuni biglietti. In Cina è anche il modo più semplice di cambiare o rimborsare un treno con il passaporto straniero. La commissione non è piccola: €6–7 a biglietto, il 7–20% del prezzo.",
        watch: "App installata e con l’accesso fatto, non solo le e-mail: il PIN o il QR da mostrare in stazione sta dentro l’app. E uno screenshot delle prenotazioni importanti: una pagina di login che non si apre davanti al tornello non serve a niente.",
        steps: [
          "Installare, accedere, controllare che ogni prenotazione compaia tra i viaggi",
          "Screenshot di ogni treno e hotel in un album del telefono",
          "Indirizzi degli hotel in cinese: nel planner c’è «🚕 Mostra in cinese»",
        ],
        links: [{ label: "Trip.com", url: "https://www.trip.com/" }],
        checkId: "prep-booking-apps",
      },
      {
        id: "app-12306",
        icon: "🎫",
        name: "Railway 12306",
        zh: "铁路12306",
        when: "consigliata",
        why: "La ferrovia stessa: prezzo pieno senza commissioni, tutti i posti disponibili, e i biglietti restituiti ricompaiono qui per primi.",
        watch: "Iscriversi dall’app, mai dal sito. All’iscrizione l’app mostra un banner per stranieri (il percorso rapido con il passaporto) che scansiona il passaporto e compila il modulo. L’e-mail di conferma può non arrivare mai: entrare comunque dall’app, funziona. Dal sito si resta chiusi fuori. Se anche l’app rifiuta, una biglietteria in stazione verifica il passaporto di persona.",
        steps: [
          "Installare l’app ufficiale (铁路12306) a casa",
          "Iscriversi con il percorso per stranieri: scansione del passaporto, modulo compilato da solo",
          "Entrare dall’app anche se l’e-mail non arriva; non provare dal sito",
          "Ancora niente? Il primo giorno in Cina, alla biglietteria di una stazione",
          "Comprare qui, senza commissioni: le vendite aprono 15 giorni prima",
        ],
        links: [{ label: "12306", url: "https://www.12306.cn/" }],
        checkId: "prep-12306",
      },
    ],
  },
  {
    id: "lingua",
    title: "Lingua",
    apps: [
      {
        id: "app-baidu",
        icon: "🔤",
        name: "Baidu Translate",
        zh: "百度翻译",
        when: "prima",
        why: "Un traduttore che funziona dentro il firewall, con la fotocamera che legge in tempo reale menu, cartelli e macchinette dei biglietti.",
        watch: "Google Traduttore online in Cina non va: non contateci. Baidu traduce anche una foto dall’album, ed è così che si leggono le app solo in cinese: screenshot, poi importarlo in Baidu.",
        steps: ["Installare", "Provare la fotocamera su un testo cinese qualsiasi", "Provare a importare uno screenshot dall’album"],
        links: [{ label: "Baidu Translate", url: "https://fanyi.baidu.com/" }],
        checkId: "prep-baidu",
      },
      {
        id: "app-pleco",
        icon: "📖",
        name: "Pleco",
        when: "consigliata",
        why: "Il miglior dizionario di cinese, tutto offline. Disegnate un carattere che non sapete scrivere e vi dice cosa significa.",
        watch: "La versione gratuita basta. Aprirla una volta a casa, con il Wi-Fi, perché scarichi il dizionario.",
        steps: ["Installare", "Aprirla una volta con il Wi-Fi", "Provare la scrittura a mano"],
        links: [{ label: "Pleco", url: "https://www.pleco.com/" }],
        checkId: "prep-translate",
      },
      {
        id: "app-google-offline",
        icon: "🌐",
        name: "Google Traduttore · cinese offline",
        when: "consigliata",
        why: "Il pacchetto cinese offline continua a funzionare in Cina, anche se il servizio online no.",
        watch: "Va scaricato PRIMA di partire; poi funzionano solo le funzioni offline. Il traduttore principale resta Baidu.",
        steps: ["Installare", "Scaricare il pacchetto offline «Cinese (semplificato)»", "Verificare che traduca con il Wi-Fi spento"],
        links: [{ label: "Google Traduttore", url: "https://translate.google.com/" }],
        checkId: "prep-translate",
      },
    ],
  },
  {
    id: "cibo",
    title: "Cibo e cose da fare",
    apps: [
      {
        id: "app-dianping",
        icon: "🍜",
        name: "Dianping",
        zh: "大众点评",
        when: "consigliata",
        why: "Dove i cinesi decidono davvero dove mangiare: voti, foto, code e prezzi veri. TripAdvisor al confronto è una bolla per turisti.",
        watch: "Solo in cinese, e per iscriversi serve un numero cinese. Nessuno dei due è un motivo per saltarla: si legge con lo screenshot in Baidu Translate.",
        steps: ["Installare", "Registrarsi con il numero cinese, quando c’è la SIM", "Provare una volta il giro screenshot → Baidu Translate"],
        links: [{ label: "Dianping", url: "https://www.dianping.com/" }],
      },
      {
        id: "app-rednote",
        icon: "📕",
        name: "RedNote (Xiaohongshu)",
        zh: "小红书",
        when: "facoltativa",
        why: "La scoperta per immagini: è dove i giovani cinesi trovano posti, belvedere, caffè e la panchina esatta di una foto.",
        watch: "Serve un numero di telefono; i testi sono in cinese, ma le immagini dicono quasi tutto.",
        steps: ["Installare", "Registrarsi in Cina con il numero cinese", "Cercare un paio di città del viaggio"],
        links: [{ label: "RedNote", url: "https://www.xiaohongshu.com/" }],
      },
      {
        id: "app-eleme",
        icon: "🥡",
        name: "Meituan / Eleme",
        zh: "美团 / 饿了么",
        when: "facoltativa",
        why: "Cibo consegnato in camera, una salvezza dopo una giornata lunga.",
        watch: "Più facile come mini-programma Eleme dentro Alipay che come app con un numero straniero. Per la consegna serve l’indirizzo scritto in cinese: fatevelo scrivere dall’hotel.",
        steps: ["Aprire il mini-programma Eleme in Alipay", "Controllare che accetti la carta"],
        links: [{ label: "Meituan", url: "https://www.meituan.com/" }],
      },
      {
        id: "app-taobao",
        icon: "🛍️",
        name: "Taobao",
        zh: "淘宝",
        when: "facoltativa",
        why: "C’è tutto, consegnato in hotel in un giorno o due: un adattatore, uno spillo per la SIM, una giacca per la pioggia, la cosa dimenticata. Paga con Alipay.",
        watch: "Il passaggio all’inglese è nascosto: compare solo aprendo taobao.com in Chrome, non in Safari e non nell’app. Impostarlo lì una volta, poi comprare.",
        steps: ["Aprire taobao.com in Chrome e passare all’inglese dal banner", "Accedere con Alipay", "Spedire in hotel: copiare l’indirizzo cinese dalla scheda hotel del planner"],
        links: [{ label: "Taobao", url: "https://world.taobao.com/" }],
      },
      {
        id: "app-damai",
        icon: "🎭",
        name: "Damai",
        zh: "大麦",
        when: "facoltativa",
        why: "Biglietti per spettacoli, concerti ed eventi: acrobati, opera di Pechino, tutto quello che ha un posto a sedere.",
        watch: "Solo in cinese, e ogni biglietto è nominativo, legato a un passaporto.",
        steps: ["Saltarla, a meno che uno spettacolo si venda solo lì", "Altrimenti comprare da Trip.com o alla reception dell’hotel"],
        links: [{ label: "Damai", url: "https://www.damai.cn/" }],
      },
    ],
  },
];

/** Testo con `comandi` tra apici inversi: la guida li mostra come codice. */
export const GUIDE_INTERNET: Array<{ id: string; title: string; points: string[]; code?: string }> = [
  {
    id: "net-decide",
    title: "Prima decidete cosa vi serve",
    points: [
      "Web aperto (mappe, ricerca, social, messaggi, streaming): basta l’eSIM in roaming o una VPN commerciale. Il resto di questa guida non vi serve.",
      "Servizi che giudicano l’indirizzo IP (Claude, ChatGPT, banche, alcune app di AI): non basta nessuna delle due. Bloccano per due motivi diversi: essere in Cina e uscire da un IP di datacenter. Tutte le VPN commerciali escono da un datacenter; l’eSIM esce a Hong Kong, che molti di questi servizi bloccano a loro volta.",
      "Per il secondo caso l’unica soluzione è uscire da una connessione domestica in un paese normale: in pratica un computer a casa, a cui collegarsi con un tunnel. È un lavoro molto più grande: decidete onestamente se vi serve prima di cominciare.",
    ],
  },
  {
    id: "net-esim",
    title: "eSIM: una scelta di prezzo, non un modo per aggirare il firewall",
    points: [
      "Tutte le eSIM da viaggio per la Cina sono in roaming: il telefono usa un’antenna cinese, ma i dati tornano alla rete estera ed escono di solito a Hong Kong. Il firewall non le vede. Le SIM censurate sono quelle cinesi comprate sul posto.",
      "Il profilo eSIM non si installa dalla Cina: va fatto prima dell’imbarco.",
      "Le ricariche restano legate alla copertura iniziale: un vecchio profilo «globale» può rifiutare una ricarica per la Cina, e lì non se ne installa uno nuovo. Il profilo installato deve essere per la Cina.",
      "Le eSIM da viaggio sono solo dati: niente numero, SMS o chiamate. Tenete attiva una linea vera per i codici di verifica.",
      "Controllate il roaming di ogni telefono che resta sulla SIM di casa: un piano che esclude la Cina fattura a consumo appena atterrati. Dati in roaming spenti prima del volo.",
      "WeChat funziona benissimo anche sui dati cinesi censurati e raggiunge normalmente chi è all’estero.",
    ],
  },
  {
    id: "net-vpn",
    title: "VPN commerciali, misurate e non recensite",
    points: [
      "Astrill, la più consigliata dagli expat: da Pechino «lasciava passare poco», e un tunnel proprio andava molto meglio.",
      "NordVPN con server offuscati: portata come riserva, mai servita.",
      "Regola che vale comunque: niente lavoro sensibile all’IP su una VPN commerciale, perché quei servizi bloccano proprio gli indirizzi dei datacenter. Usate la VPN per raggiungere una vostra macchina e lavorate da lì.",
    ],
  },
  {
    id: "net-tunnel",
    title: "Il tunnel proprio: VLESS + REALITY",
    points: [
      "È la risposta attuale per la Cina e ha retto un mese di lavoro quotidiano (ore di video, sviluppo completo) senza interruzioni. Fa sembrare il tunnel una normale connessione TLS 1.3 verso un sito vero e famoso.",
      "Il sito esca (`server_name` / `handshake.server`) deve essere raggiungibile dalla Cina e avere un certificato TLS 1.3 pulito: `www.apple.com` va (anche icloud, bing, cloudflare, samsung).",
      "`www.microsoft.com` NON va: Akamai manda un certificato grande e frammentato che rompe REALITY. L’errore, «REALITY: processed invalid connection», sembra una chiave sbagliata e fa perdere ore a ricontrollare credenziali giuste.",
      "Lato server sing-box o Xray, vanno bene tutti e due.",
    ],
  },
  {
    id: "net-server",
    title: "Dove far girare il server",
    points: [
      "Caso semplice (giusto per il 95% delle persone): una VPS fuori dalla Cina con REALITY sopra, e si esce da lì. Tokyo è leggermente meglio da Pechino, Singapore dal sud. 1 vCPU e 1–2 GB bastano e avanzano (~10 $/mese, Ubuntu 24.04, chiave SSH e niente password di root). Meglio un fornitore a ore (Vultr): la si distrugge il giorno del ritorno.",
      "L’unica ridondanza che è servita davvero: due VPS in luoghi diversi (Tokyo e Singapore) con le stesse credenziali, tutte e due nel client. Se un indirizzo viene bloccato a metà viaggio basta un tocco, invece di una crisi in camera d’albergo.",
      "Caso complicato, solo se serve uscire da casa (per Claude): la VPS diventa un tubo che dalla 443 inoltra a un tunnel SSH inverso aperto dal computer di casa, così la sessione cifrata finisce a casa ed esce dalla linea domestica. La VPS vede solo dati cifrati.",
      "Prima di progettarlo, controllate se la linea di casa accetta connessioni in entrata: `traceroute -n 8.8.8.8`. Se il secondo salto è già un indirizzo privato (10.x, 192.168.x, 100.64–127.x) siete dietro il NAT dell’operatore: nessuna porta si aprirà mai, e il tunnel inverso è l’unica strada.",
      "Rendete il tunnel autoriparante (uno script ogni 2 minuti da cron, con flock e riconnessione dopo 5 secondi), o alla prima caduta restate chiusi fuori a 8.000 km.",
    ],
  },
  {
    id: "net-steps",
    title: "Costruirlo: i passi del caso semplice",
    points: [
      "Firewall e aggiornamenti: `apt update && apt -y upgrade`, poi `ufw` con solo le porte 22 e 443; disattivare l’accesso SSH con password (`PasswordAuthentication no`).",
      "Installare sing-box dal repository ufficiale SagerNet (istruzioni aggiornate su sing-box.sagernet.org) e controllare con `sing-box version`.",
      "Generare i segreti: `sing-box generate uuid`, `sing-box generate reality-keypair`, `openssl rand -hex 8`. Salvateli subito: la chiave privata resta sul server e non si recupera, la pubblica va in ogni client. Un UUID per persona, revocabile da solo.",
      "Scrivere `/etc/sing-box/config.json` come qui sotto, poi `systemctl enable --now sing-box` e controllare che tenga la 443 con `ss -tlnp | grep 443`.",
      "Link per il client: `vless://UUID@IP:443?encryption=none&flow=xtls-rprx-vision&security=reality&sni=www.apple.com&fp=chrome&pbk=CHIAVE_PUBBLICA&sid=SHORT_ID&type=tcp#Tokyo`, trasformato in QR con `qrencode`. Se usate un nome DNS su Cloudflare, il record deve essere solo DNS (nuvola grigia).",
    ],
    code: `{
  "log": { "level": "info", "timestamp": true },
  "inbounds": [{
    "type": "vless", "tag": "vless-in", "listen": "::", "listen_port": 443,
    "users": [{ "uuid": "UUID", "flow": "xtls-rprx-vision" }],
    "tls": {
      "enabled": true, "server_name": "www.apple.com",
      "reality": {
        "enabled": true,
        "handshake": { "server": "www.apple.com", "server_port": 443 },
        "private_key": "CHIAVE_PRIVATA",
        "short_id": ["SHORT_ID"]
      }
    }
  }],
  "outbounds": [{ "type": "direct", "tag": "direct" }]
}`,
  },
  {
    id: "net-clients",
    title: "Client: pagate i tre euro",
    points: [
      "iPhone, iPad e Mac Apple Silicon: Shadowrocket (~3 $), l’unico con una storia provata su questa configurazione. Si compra una volta e va su tutti i dispositivi. Quelli gratuiti no: Streisand su un Mac M1 non faceva passare un byte con una configurazione che sull’iPhone andava.",
      "Android: v2rayNG. Il difficile è installarlo: in Cina Google Play è bloccato e GitHub inaffidabile, quindi l’APK va scaricato prima e portato con sé. Importare dagli appunti (un telefono non può scansionare il proprio schermo).",
      "Installare tutto prima dell’imbarco: le app VPN non sono nell’App Store cinese e i siti dei fornitori sono bloccati.",
      "Regioni Apple: «In famiglia» non funziona tra store di paesi diversi. Funziona così: sul Mac di chi non ha comprato, accedere solo all’App Store con l’Apple ID di chi ha comprato (iCloud, Messaggi e Foto restano com’erano), installare e poi tornare al proprio. L’app continua a funzionare; solo gli aggiornamenti vorrebbero l’altro ID.",
      "Importare con il QR, mai a mano: un carattere sbagliato nell’UUID o nella chiave pubblica di 43 caratteri fallisce in silenzio. Il Mac non scansiona il proprio schermo: aprire il QR sul telefono e metterlo davanti alla fotocamera del Mac.",
    ],
  },
  {
    id: "net-test",
    title: "Provarlo: quasi ogni controllo mente",
    points: [
      "Con un client a IP finti (Shadowrocket e simili) gli strumenti di diagnosi smettono di dire la verità: `dig` restituisce un 198.18.0.x finto, `nc -z … 443` riesce sempre, `ping baidu.com` risponde in 0,3 ms dalla Cina. Sembrano tutti verdi e non provano niente.",
      "L’unica prova vera è l’IP d’uscita: `curl https://ipinfo.io` e `curl https://ifconfig.co/json` devono mostrare l’IP e la città della VPS. Incrociate due siti: alcuni «qual è il mio IP» stanno su CDN cinesi, e un client con instradamento separato li manda diretti mostrando l’uscita cinese. È normale.",
      "Da casa si prova meno di quanto sembri: se la linea di casa e l’uscita del tunnel coincidono, un IP «giusto» non dice nulla. Controllate che il processo del tunnel giri davvero.",
      "Provate ogni dispositivo che conta, non uno a persona: un Mac che non aveva mai funzionato è stato scoperto in un hotel di Pechino.",
    ],
  },
  {
    id: "net-cost",
    title: "Costi e dopo il viaggio",
    points: [
      "Due VPS ~20 $/mese in tutto, a ore, distrutte il giorno del ritorno. Shadowrocket ~3 $ una volta per account Apple. eSIM ~€30 per 50 GB in 45 giorni. La voce più cara, una VPN commerciale presa come riserva, è stata la meno utile.",
      "Perché non Shadowsocks: funziona ancora, ma il firewall lo studia da più tempo, si riconosce dalla forma del traffico e risponde in modo riconoscibile alle sonde, quindi peggiora proprio nelle settimane politicamente delicate. REALITY prende in prestito un vero handshake di apple.com: chi sonda senza chiave vede il vero sito Apple.",
      "Tenete configurazione, chiavi e QR dopo il viaggio: ricostruire tutto richiede una ventina di minuti, quindi non serve pagare server fermi tra un viaggio e l’altro.",
      "Kit offline su almeno due dispositivi: QR delle configurazioni, credenziali e codici di recupero in un password manager. Da dentro la Cina pagine di account e siti dei fornitori non si aprono.",
    ],
  },
];

export const GUIDE_INTERNET_SOURCES = [
  { label: "VLESS+REALITY e altri protocolli", url: "https://lilting.ch/en/articles/china-vpn-protocol-comparison" },
  { label: "eSIM da viaggio e Hong Kong", url: "https://esimdb.com/blog/travel-esim-china-vpn-great-firewall" },
  { label: "Claude dalla Cina e IP delle VPN", url: "https://www.comparitech.com/blog/vpn-privacy/how-to-use-claude-in-china" },
];

/** Consigli legati a una tappa, mostrati anche nella scheda della città in «Itinerario». */
export const CITY_TIPS: Record<string, string[]> = {
  beijing: [
    "Città Proibita: chiusa il lunedì. I biglietti escono 7 giorni prima alle 20:00 sul mini-programma WeChat 故宫博物院; su Trip.com a volte la voce è un tour o un combo, non il biglietto semplice.",
    "Musei nazionali: di solito gratuiti, ma su prenotazione (WeChat o sito) con il numero di passaporto di ognuno.",
    "SIM cinese in aeroporto: sportello China Mobile al T3C, vicino al nastro 38; in città 王府井大街200号 (工美大厦B1).",
    "Stazioni: Beijing West ≠ Beijing South. Controllare quella sul biglietto e la linea della metro che ci arriva.",
    "Metro: QR «Transport» di Alipay, oppure la carta contactless Visa/Mastercard direttamente al tornello.",
    "A metà novembre circa 12° di giorno e 4° di notte, e al nord l’aria può essere pessima: due KN95 in borsa.",
  ],
  xian: [
    "Esercito di Terracotta: biglietto nominativo con il passaporto, al massimo 7 giorni prima; i posti finiscono presto, segnarsi l’apertura.",
    "Anche qui a fine novembre l’aria può essere pessima.",
  ],
  chengdu: [
    "Panda: la base di Wolong è a circa 2 ore di bus, bellissima e quasi vuota; le basi vicino a Chengdu hanno migliaia di visitatori al giorno (ottobre 2026).",
    "Casa privata invece di un hotel? In Sichuan la registrazione in polizia si può fare online (prova partita a marzo 2026); altrove è una visita in commissariato entro 24 ore.",
  ],
  chongqing: [
    "Casa privata invece di un hotel? Anche a Chongqing la registrazione in polizia si può fare online (prova partita a marzo 2026).",
  ],
  shanghai: [
    "Metro: anche qui la carta contactless passa direttamente ai tornelli.",
  ],
};

/** «Da sapere»: niente da spuntare, solo da leggere. */
export const GUIDE_FACTS = [
  "Niente mance, da nessuna parte: lasciare soldi mette in imbarazzo.",
  "Pranzo 11:30–13, cena dalle 17:30; fuori dalle grandi città le cucine chiudono presto.",
  "Al ristorante si ordina e si paga dal QR sul tavolo. Non piccante: 不要辣 (bú yào là).",
  "Acqua del rubinetto non potabile: bottiglie ovunque, in hotel di solito due al giorno.",
  "Passaporto originale sempre con sé: lo chiedono treni, musei, hotel e alcuni parchi, e una foto non basta.",
  "Grandi attrazioni nel weekend: folla di un altro livello, meglio all’apertura.",
  "All’immigrazione prima i chioschi delle impronte (tutte e dieci le dita), poi la fila per stranieri; gli hotel fotografano la pagina del timbro d’ingresso al check-in.",
  "Contanti oltre 5.000 USD (o ¥20.000) vanno dichiarati all’ingresso. I bancomat di Bank of China, ICBC e CCB prendono le carte estere; in città il cambio è migliore che in aeroporto.",
  "Pagare: con carta estera Alipay e WeChat sono gratis fino a ¥200, oltre si paga il 3% su tutto. Sopra ¥200 meglio la carta fisica (con PIN e spesso firma): hotel, ristoranti e grandi negozi la prendono anche se non lo dicono. Apple Pay e il contactless dal telefono sono spesso rifiutati.",
  "Prese: tipo A e C (la piatta europea a due poli) nei fori in alto, tipo I (tre lamelle, come in Australia) in quello in basso. Schuko e spine a tre poli vogliono l’adattatore. 220 V: caricatori di telefono e PC vanno bene.",
  "Hotel: non tutti possono ospitare stranieri (Trip.com e Booking mostrano solo quelli). La cancellazione gratuita scade spesso a mezzogiorno, ora cinese, del giorno prima.",
  "Niente Airbnb in Cina (uscito nel 2022): in una casa privata la registrazione in polizia entro 24 ore tocca a voi; negli hotel la fanno loro al check-in.",
  "Due linee dati: l’eSIM esce all’estero (banche, AI, app di casa), una SIM cinese apre i servizi che vogliono un numero o un indirizzo cinese.",
  "Dove mangiare: Dianping (大众点评) è dove decidono i cinesi, con foto, code e prezzi veri; RedNote (小红书) per scoprire posti e scorci. Entrambe in cinese e con numero +86: si leggono con lo screenshot in Baidu Translate.",
  "Cibo in camera: Eleme come mini-programma di Alipay; l’indirizzo dell’hotel va scritto in cinese.",
  "Dimenticato qualcosa? Taobao consegna in hotel in un giorno o due e paga con Alipay; l’inglese compare solo aprendo taobao.com in Chrome.",
  "Se Alipay e WeChat rifiutano la carta a una cassa: UnionPay QuickPass (云闪付), che si installa anche dalla Cina.",
  "Spettacoli (acrobati, opera di Pechino): meglio Trip.com o la reception dell’hotel che Damai, solo in cinese e con biglietto nominativo.",
  "Settimana d’oro (1–7 ottobre), Capodanno cinese e Primo maggio riempiono treni, hotel e attrazioni: le vostre date ne sono fuori.",
  "Nell’internet cinese quasi niente è facile al primo colpo: fate a casa tutto quello che si può fare a casa.",
];

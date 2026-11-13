"use client";

import { scheduleKind } from "@/lib/planner/model";
import type { HotelStay, Leg, ScheduleItem } from "@/lib/planner/types";
import { formatCost, formatLongDate, formatShortDate } from "@/lib/planner/utils";
import { DOCS, EMERGENCY, EXTRA_ACTIVITIES, FLIGHTS, TRAIN_SEATS, type ExtraActivity } from "@/lib/trip/data";
import { CopyChip, DocButtons, appleMapsUrl, bookingNumber, chinesePart, gmailSearchUrl, latinPart, mapsUrl, phonesIn, useTrip } from "./shared";

function Notes({ text }: { text?: string }) {
  if (!text?.trim()) return null;
  return <details className="notes"><summary>Note</summary><p>{text}</p></details>;
}

function FlightCards() {
  return <>{FLIGHTS.map((flight) => <article key={flight.id} id={`w-flight-${flight.id}`} className="card pass">
    <header><span className="pass-kind">✈️ Volo · {formatLongDate(flight.date)}</span><h3>{flight.title}</h3></header>
    {flight.segments.map((segment) => <div key={segment.code} className="segment">
      <div><b>{segment.dep}</b><span>{segment.from}</span></div>
      <div className="code">{segment.code}<small>{segment.airline}</small></div>
      <div className="right"><b>{segment.arr}{segment.arrDate && segment.arrDate !== segment.date ? <sup>+1</sup> : null}</b><span>{segment.to}</span></div>
    </div>)}
    <ul className="tips">{flight.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
    <div className="chips"><DocButtons docs={DOCS.flights} /><a className="chip" href={gmailSearchUrl("from:trip.com volo Venezia Pechino Shanghai")} target="_blank" rel="noreferrer">✉️ Mail</a></div>
  </article>)}</>;
}

function LegCard({ leg }: { leg: Leg }) {
  const { view, showChinese } = useTrip();
  const seats = TRAIN_SEATS[leg.id];
  const flight = /✈️|volo/i.test(leg.mode);
  const number = bookingNumber(leg.bookingRef);
  const fromZh = chinesePart(leg.fromStation);
  return <article id={`w-leg-${leg.id}`} className="card pass">
    <header>
      <span className="pass-kind">{flight ? "✈️ Volo interno" : "🚄 Treno"} · {formatLongDate(view.legDateOf(leg))}</span>
      <h3>{view.legLabel(leg)}</h3>
      <span className={`status ${leg.bookingStatus === "prenotato" ? "ok" : "warn"}`}>{leg.bookingStatus === "prenotato" ? (seats?.issued || "prenotato") : "da prenotare"}</span>
    </header>
    <div className="segment">
      <div><b>{leg.departureTime || "--:--"}</b><span>{latinPart(leg.fromStation)}</span><small className="zh">{fromZh}</small></div>
      <div className="code">{leg.serviceNumber}<small>{leg.duration}</small></div>
      <div className="right"><b>{leg.arrivalTime || "--:--"}</b><span>{latinPart(leg.toStation)}</span><small className="zh">{chinesePart(leg.toStation)}</small></div>
    </div>
    {seats && <div className="seats"><div><small>Carrozza</small><b>{seats.car}</b></div><div><small>Posti</small><b>{seats.seats}</b></div>{seats.gate && <div><small>Varco</small><b>{seats.gate}</b></div>}</div>}
    {!flight && <p className="hint">Il passaporto è il biglietto: in stazione 45–60 minuti prima, varco da ricontrollare nell&apos;app.</p>}
    <div className="chips">
      <CopyChip value={number} label={number ? `Trip.com ${number}` : undefined} />
      <DocButtons docs={DOCS[`leg:${leg.id}`]} />
      {number && <a className="chip" href={gmailSearchUrl(number)} target="_blank" rel="noreferrer">✉️ Mail</a>}
      {fromZh && <button className="chip" onClick={() => showChinese({ kind: "place", kicker: "请送我们去这个火车站/机场，谢谢！", kickerIt: "«Per favore, ci porti a questa stazione / aeroporto. Grazie!»", title: latinPart(leg.fromStation), titleZh: fromZh, subtitle: "" })}>🚕 Stazione in cinese</button>}
    </div>
    <Notes text={leg.note} />
  </article>;
}

function HotelCard({ stay }: { stay: HotelStay }) {
  const { showChinese } = useTrip();
  const nights = Math.round((new Date(stay.checkOutDate).getTime() - new Date(stay.checkInDate).getTime()) / 86_400_000);
  const phones = phonesIn(stay.notes);
  const where = stay.addressZh || stay.address || stay.name;
  return <article id={`w-hotel-${stay.stopId}`} className="card pass hotel">
    <header>
      <span className="pass-kind">🛏️ Hotel · {formatShortDate(stay.checkInDate)} → {formatShortDate(stay.checkOutDate)} · {nights} notti</span>
      <h3>{latinPart(stay.name) || stay.name}</h3>
      {stay.nameZh && <p className="zh big">{stay.nameZh}</p>}
    </header>
    <p className="address">{stay.address}{stay.addressZh && <><br /><span className="zh">{stay.addressZh}</span></>}</p>
    <div className="chips">
      <button className="chip primary" onClick={() => showChinese({ kind: "hotel", title: latinPart(stay.name) || stay.name, titleZh: stay.nameZh, subtitle: stay.address, subtitleZh: stay.addressZh })}>🚕 Mostra in cinese</button>
      <a className="chip" href={appleMapsUrl(where)} target="_blank" rel="noreferrer">📍 Mappe</a>
      <a className="chip" href={stay.mapUrl || mapsUrl(where)} target="_blank" rel="noreferrer">🗺️ Google</a>
      {phones.map((phone) => <a key={phone.tel} className="chip" href={`tel:${phone.tel}`}>📞 {phone.raw}</a>)}
      <CopyChip value={stay.confirmationNumber || ""} label={stay.confirmationNumber ? `N. ${stay.confirmationNumber}` : undefined} />
      <DocButtons docs={DOCS[`hotel:${stay.stopId}`]} />
    </div>
    <Notes text={stay.notes} />
  </article>;
}

function ItemCard({ item }: { item: ScheduleItem }) {
  const { showChinese } = useTrip();
  const docs = /proibita|forbidden/i.test(item.name) ? DOCS["forbidden-city"] : undefined;
  return <article id={`w-item-${item.id}`} className="card pass">
    <header><span className="pass-kind">🎟️ Attività · {formatLongDate(item.date)} · {item.startTime}</span><h3>{item.name}</h3></header>
    {item.location && <p className="address">{item.location}{item.locationZh && <><br /><span className="zh">{item.locationZh}</span></>}</p>}
    <div className="chips">
      {item.locationZh && <button className="chip primary" onClick={() => showChinese({ kind: "place", title: item.location || item.name, titleZh: item.locationZh, subtitle: "" })}>🚕 Mostra in cinese</button>}
      {item.price > 0 && <span className="chip static">{formatCost(item.price, item.currency)}</span>}
      {item.ticketUrl && <a className="chip" href={item.ticketUrl} target="_blank" rel="noreferrer">🎫 Biglietto</a>}
      {item.mapUrl && <a className="chip" href={item.mapUrl} target="_blank" rel="noreferrer">📍 Mappa</a>}
      <DocButtons docs={docs} />
    </div>
    <Notes text={item.notes} />
  </article>;
}

function ExtraCard({ activity }: { activity: ExtraActivity }) {
  const { showChinese } = useTrip();
  return <article id={`w-extra-${activity.id}`} className="card pass">
    <header><span className="pass-kind">🎟️ Attività · {formatLongDate(activity.date)} · {activity.start}–{activity.end}</span><h3>{activity.title}</h3></header>
    <p className="address">{activity.place}{activity.placeZh && <><br /><span className="zh">{activity.placeZh}</span></>}</p>
    <div className="seats"><div><small>Pick-up</small><b>{activity.start} in hotel</b></div><div><small>Prezzo</small><b>{activity.price.split(" · ")[1] || activity.price}</b></div></div>
    <ul className="tips">{activity.includes.map((item) => <li key={item}>{item}</li>)}</ul>
    <p className="hint">{activity.price}</p>
    <ul className="tips">{activity.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
    {activity.placeZh && <div className="chips"><button className="chip primary" onClick={() => showChinese({ kind: "place", title: activity.place, titleZh: activity.placeZh, subtitle: "" })}>🚕 Mostra in cinese</button></div>}
  </article>;
}

export function WalletTab() {
  const { plan, view } = useTrip();
  const legs = view.legs.filter((leg) => leg.included);
  const trains = legs.filter((leg) => !/✈️|volo/i.test(leg.mode));
  const flights = legs.filter((leg) => /✈️|volo/i.test(leg.mode));
  const hotels = [...plan.hotelStays].filter((stay) => stay.bookingStatus === "prenotato").sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
  const items = plan.scheduleItems.filter((item) => item.bookingStatus === "prenotato" && scheduleKind(item) !== "transport");
  const axa = EMERGENCY.find((entry) => entry.label.startsWith("Assistenza AXA"));

  return <section className="tab">
    <nav className="jump">
      {[["✈️", "w-flights"], ["🚄", "w-trains"], ["🛏️", "w-hotels"], ["🎟️", "w-items"], ["🛡️", "w-insurance"], ["📁", "w-docs"]].map(([icon, id]) => <a key={id} href={`#${id}`}>{icon}</a>)}
    </nav>
    <h2 id="w-flights" className="section-title">Voli</h2>
    <FlightCards />
    {flights.map((leg) => <LegCard key={leg.id} leg={leg} />)}
    <h2 id="w-trains" className="section-title">Treni</h2>
    {trains.map((leg) => <LegCard key={leg.id} leg={leg} />)}
    <h2 id="w-hotels" className="section-title">Hotel · {hotels.length} su 6</h2>
    {hotels.map((stay) => <HotelCard key={stay.id} stay={stay} />)}
    <h2 id="w-items" className="section-title">Attività prenotate</h2>
    {[...items.map((item) => ({ date: `${item.date} ${item.startTime}`, node: <ItemCard key={item.id} item={item} /> })), ...EXTRA_ACTIVITIES.map((activity) => ({ date: `${activity.date} ${activity.start}`, node: <ExtraCard key={activity.id} activity={activity} /> }))]
      .sort((left, right) => left.date.localeCompare(right.date)).map((entry) => entry.node)}
    <h2 id="w-insurance" className="section-title">Assicurazione</h2>
    <article className="card pass">
      <header><span className="pass-kind">🛡️ AXA · comprata con i voli</span><h3>Spese mediche e rimpatrio fino a 500.000 €</h3></header>
      <p className="hint">{axa?.note} Polizze una a testa: i numeri sono nelle note condivise (Info) e nei certificati.</p>
      <div className="chips">{axa && <a className="chip primary" href={`tel:${axa.number.replace(/\s/g, "")}`}>📞 Assistenza 24/7</a>}<DocButtons docs={DOCS.insurance} /></div>
    </article>
    <h2 id="w-docs" className="section-title">Documenti</h2>
    <article className="card pass">
      <div className="chips">
        <DocButtons docs={DOCS.documents} />
        {plan.sharedLinks.filter((link) => !link.url.includes(DOCS.documents[0].id)).map((link) => <a key={link.id} className="chip" href={link.url} target="_blank" rel="noreferrer">🔗 {link.label}</a>)}
      </div>
      <p className="hint">I PDF si aprono con l&apos;account Google di Alberto o di Sofia. Rendeteli disponibili offline nell&apos;app Drive.</p>
    </article>
  </section>;
}

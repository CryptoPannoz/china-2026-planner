"use client";

import { useEffect, useMemo, useState } from "react";
import { scheduleKind } from "@/lib/planner/model";
import { addDaysKey, diffDaysKey, formatLongDate } from "@/lib/planner/utils";
import { DEPARTURE_AT, FLIGHTS, REMINDERS, TODOS, TRAIN_SEATS, TRIP_END, TRIP_START, WEATHER } from "@/lib/trip/data";
import { latinPart, todayKey, useTrip } from "./shared";

type TripEvent = {
  id: string;
  date: string;
  time: string;
  icon: string;
  title: string;
  sub?: string;
  detail?: string;
  tone: "move" | "sleep" | "do" | "note";
  anchor?: string;
};

const CHECK_IN: Record<string, string> = { shanghai: "15:00" };

export function useEvents() {
  const { plan, view } = useTrip();
  return useMemo(() => {
    const events: TripEvent[] = [];
    FLIGHTS.forEach((flight) => {
      const first = flight.segments[0];
      const last = flight.segments[flight.segments.length - 1];
      events.push({
        id: `flight-${flight.id}`,
        date: flight.date,
        time: first.dep,
        icon: "✈️",
        title: `Volo ${flight.title}`,
        sub: flight.segments.map((segment) => `${segment.code} ${segment.dep}→${segment.arr}${segment.arrDate && segment.arrDate !== segment.date ? " (+1)" : ""}`).join(" · "),
        detail: `${first.from} → ${last.to}`,
        tone: "move",
        anchor: `w-flight-${flight.id}`,
      });
    });
    view.legs.filter((leg) => leg.included).forEach((leg) => {
      const date = view.legDateOf(leg);
      const flight = /✈️|volo/i.test(leg.mode);
      const seats = TRAIN_SEATS[leg.id];
      events.push({
        id: `leg-${leg.id}`,
        date,
        time: leg.departureTime || "",
        icon: flight ? "✈️" : "🚄",
        title: `${view.legLabel(leg)}${leg.serviceNumber ? ` · ${leg.serviceNumber}` : ""}`,
        sub: `${leg.departureTime || "?"} → ${leg.arrivalTime || "?"}${seats ? ` · carrozza ${seats.car}, ${seats.seats}` : ""}`,
        detail: [latinPart(leg.fromStation), latinPart(leg.toStation)].filter(Boolean).join(" → "),
        tone: "move",
        anchor: `w-leg-${leg.id}`,
      });
    });
    plan.hotelStays.filter((stay) => stay.bookingStatus === "prenotato").forEach((stay) => {
      const name = latinPart(stay.name) || stay.name;
      events.push({ id: `in-${stay.id}`, date: stay.checkInDate, time: CHECK_IN[stay.stopId] || "14:00", icon: "🛏️", title: `Check-in · ${name}`, sub: "Passaporti alla reception", tone: "sleep", anchor: `w-hotel-${stay.stopId}` });
      events.push({ id: `out-${stay.id}`, date: stay.checkOutDate, time: stay.checkOutDate === TRIP_END ? "05:15" : "12:00", icon: "🧳", title: `Check-out · ${name}`, sub: stay.checkOutDate === TRIP_END ? "Si parte per l'aeroporto" : "Entro le 12: bagagli in deposito se serve", tone: "sleep", anchor: `w-hotel-${stay.stopId}` });
    });
    plan.scheduleItems.forEach((item) => {
      const kind = scheduleKind(item);
      events.push({
        id: `item-${item.id}`,
        date: item.date,
        time: item.startTime,
        icon: kind === "transport" ? "🚕" : "🎟️",
        title: item.name,
        sub: [item.startTime && item.endTime ? `${item.startTime}–${item.endTime}` : "", latinPart(item.location)].filter(Boolean).join(" · "),
        tone: "do",
        anchor: item.bookingStatus === "prenotato" && kind !== "transport" ? `w-item-${item.id}` : undefined,
      });
    });
    REMINDERS.forEach((reminder, index) => events.push({ id: `rem-${index}`, date: reminder.date, time: reminder.time, icon: "🔔", title: reminder.title, detail: reminder.detail, tone: "note" }));
    return events.sort((left, right) => (left.date + left.time).localeCompare(right.date + right.time));
  }, [plan.hotelStays, plan.scheduleItems, view]);
}

function cityOf(date: string, calendar: ReturnType<typeof useTrip>["view"]["calendar"]) {
  if (date === TRIP_START) return { city: "Venezia → in volo", stopId: "" };
  if (date === TRIP_END) return { city: "Shanghai → Venezia", stopId: "shanghai" };
  const day = calendar.find((entry) => entry.dateKey === date);
  return { city: day?.city || "", stopId: day?.stopId || "" };
}

function Countdown() {
  const { plan, open, who } = useTrip();
  const done = new Map(plan.extraChecklist.map((item) => [item.id, item.done || item.skipped]));
  const mine = TODOS.filter((todo) => todo.when !== "cina" && (!who || todo.who === "entrambi" || todo.who === who));
  const left = mine.filter((todo) => !done.get(todo.id));
  const [now] = useState(() => Date.now());
  const hours = Math.max(0, Math.round((new Date(DEPARTURE_AT).getTime() - now) / 3_600_000));
  const label = hours > 48 ? `${Math.ceil(hours / 24)} giorni` : `${hours} ore`;
  return <article className="card countdown">
    <p className="eyebrow">Lunedì 16 novembre · Venezia 16:55</p>
    <h2>Si parte tra {label}</h2>
    <div className="meter"><span style={{ width: `${mine.length ? ((mine.length - left.length) / mine.length) * 100 : 0}%` }} /></div>
    <p>{left.length ? `${left.length} cose ancora da fare${who ? " per te" : ""} prima di partire.` : "Tutto pronto. Buon viaggio!"}</p>
    <button className="btn" onClick={() => open("todo")}>Apri «Da fare» →</button>
  </article>;
}

export function ScheduleTab() {
  const { view, open } = useTrip();
  const events = useEvents();
  const today = todayKey();
  const days = useMemo(() => Array.from({ length: diffDaysKey(TRIP_START, TRIP_END) + 1 }, (_, index) => addDaysKey(TRIP_START, index)), []);

  useEffect(() => {
    if (today < TRIP_START || today > TRIP_END) return;
    const timer = window.setTimeout(() => document.getElementById(`day-${today}`)?.scrollIntoView({ block: "start" }), 150);
    return () => window.clearTimeout(timer);
  }, [today]);

  return <section className="tab">
    {today < TRIP_START && <Countdown />}
    {days.map((date, index) => {
      const { city, stopId } = cityOf(date, view.calendar);
      const weather = WEATHER.find((entry) => entry.stopId === stopId);
      const dayEvents = events.filter((event) => event.date === date);
      return <article key={date} id={`day-${date}`} className={`card day ${date === today ? "today" : ""} ${date < today ? "past" : ""}`}>
        <header className="day-head">
          <div>
            <p className="eyebrow">Giorno {index + 1}{date === today ? " · oggi" : ""}</p>
            <h3>{formatLongDate(date)}</h3>
            <span className="city">{city}</span>
          </div>
          {weather && <span className="temp" title="Media 2015–2025 su queste date">{weather.min}° / {weather.max}°</span>}
        </header>
        {dayEvents.length === 0 ? <p className="free">Giornata libera.</p> : <ol className="events">
          {dayEvents.map((event) => <li key={event.id} className={`event ${event.tone}`}>
            <time>{event.time}</time>
            <div>
              <b>{event.icon} {event.title}</b>
              {event.sub && <span>{event.sub}</span>}
              {event.detail && <small>{event.detail}</small>}
            </div>
            {event.anchor && <button className="go" aria-label="Apri nel wallet" onClick={() => open("wallet", event.anchor)}>›</button>}
          </li>)}
        </ol>}
      </article>;
    })}
  </section>;
}

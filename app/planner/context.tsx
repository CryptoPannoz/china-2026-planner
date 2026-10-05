"use client";

import { createContext, useContext } from "react";
import type { PlanView } from "@/lib/planner/model";
import type { Currency, PlanData, ScheduleKind, TaxiInfo } from "@/lib/planner/types";

export type Section = "itinerary" | "calendar" | "hotels" | "transport" | "budget" | "planner" | "history";

export type Planner = {
  plan: PlanData;
  view: PlanView;
  update: (updater: (plan: PlanData) => PlanData) => void;
  /** Voce nel registro condiviso «Chi ha modificato cosa». */
  log: (action: string, detail: string) => void;
  notify: (message: string) => void;
  section: Section;
  /** Cambia sezione e, se indicati, seleziona giorno/tappa e scorre fino a un elemento. */
  goTo: (section: Section, options?: { date?: string; stopId?: string; anchor?: string; newBlockKind?: ScheduleKind }) => void;
  /** Tipo proposto dal modulo «Nuovo blocco» quando si arriva in agenda (es. da «Aggiungi trasferimento»). */
  agendaNewKind: ScheduleKind;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedStopId: string;
  setSelectedStopId: (stopId: string) => void;
  showChinese: (info: TaxiInfo) => void;
  eur: (value: number, currency: Currency | undefined) => number;
};

export const PlannerContext = createContext<Planner | null>(null);

export function usePlanner() {
  const planner = useContext(PlannerContext);
  if (!planner) throw new Error("usePlanner fuori dal PlannerContext");
  return planner;
}

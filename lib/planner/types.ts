export type Currency = "EUR" | "CNY";
export type ScheduleKind = "activity" | "transport" | "hotel";
export type Payer = "alberto" | "sofia";
export type ExpenseCategory = "voli" | "hotel" | "trasporti" | "attivita" | "cibo" | "extra";
export type BookingStatus = "da-prenotare" | "prenotato" | "non-serve";

export type Activity = {
  id: string;
  name: string;
  nameZh?: string;
  description: string;
  price: number;
  currency?: Currency;
  selected: boolean;
  sourceUrl?: string;
};

export type ScheduleItem = {
  id: string;
  /** Tappa a cui appartiene il blocco. */
  stopId: string;
  /**
   * Giorno dentro la tappa (0 = giorno d'arrivo). È la fonte di verità: se le notti
   * cambiano, il blocco segue la sua città invece di restare su una data vecchia.
   */
  day?: number;
  /** Data effettiva, ricalcolata da tappa + giorno (salvata anche per compatibilità). */
  date: string;
  startTime: string;
  endTime: string;
  name: string;
  nameZh?: string;
  kind?: ScheduleKind;
  category: string;
  location: string;
  locationZh?: string;
  ticketUrl?: string;
  fromLocation?: string;
  transportMode?: string;
  mapUrl?: string;
  wechatUrl?: string;
  alipayUrl?: string;
  notes: string;
  price: number;
  currency?: Currency;
  bookingStatus: BookingStatus;
  paidBy?: Payer;
  sourceUrl?: string;
  sourceActivityId?: string;
};

export type HotelStay = {
  id: string;
  stopId: string;
  name: string;
  nameZh?: string;
  address: string;
  addressZh?: string;
  checkInDate: string;
  checkOutDate: string;
  /** Prezzo stimato a notte (hotel da prenotare). */
  nightlyPrice: number;
  /** Prezzo totale pagato (hotel prenotati). */
  totalPrice?: number;
  currency: Currency;
  bookingStatus: "da-prenotare" | "prenotato";
  /**
   * Se vero (e non ancora prenotato) check-in e check-out seguono le date della tappa quando
   * cambiano le notti. Diventa falso se modifichi le date a mano o dividi il soggiorno.
   */
  followStop?: boolean;
  confirmationNumber?: string;
  paidBy?: Payer;
  bookingUrl?: string;
  mapUrl?: string;
  wechatUrl?: string;
  alipayUrl?: string;
  notes: string;
};

export type Stop = {
  id: string;
  name: string;
  nameZh?: string;
  lat: number;
  lng: number;
  nights: number;
  hotelNightly: number;
  activities: Activity[];
};

export type SuggestedStop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  nights: number;
  hotelNightly: number;
  recap: string;
  transport: string;
  season: string;
  insertAfterId: string;
  activities: Activity[];
};

export type Leg = {
  id: string;
  fromId: string;
  toId: string;
  mode: string;
  duration: string;
  cost: number;
  currency?: Currency;
  included: boolean;
  note: string;
  departureTime?: string;
  arrivalTime?: string;
  fromStation?: string;
  toStation?: string;
  serviceNumber?: string;
  bookingStatus?: "da-prenotare" | "prenotato";
  bookingRef?: string;
  ticketUrl?: string;
  paidBy?: Payer;
};

export type CostEntry = {
  id: string;
  label: string;
  amount: number;
  currency: Currency;
};

export type Expense = {
  id: string;
  date: string;
  label: string;
  amount: number;
  currency: Currency;
  paidBy: Payer;
  category: ExpenseCategory;
};

/**
 * Movimento tra Alberto e Sofia che non è una spesa del viaggio: un debito da scalare dal bilancio
 * (es. l'affitto) oppure un rimborso già fatto per pareggiare i conti.
 */
export type Settlement = {
  id: string;
  date: string;
  label: string;
  amount: number;
  currency: Currency;
  /** debito: «from» deve la cifra all'altro; rimborso: «from» l'ha già data all'altro. */
  kind: "debito" | "rimborso";
  from: Payer;
};

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type TripLink = {
  id: string;
  stopId: string;
  label: string;
  url: string;
};

export type PlanData = {
  itineraryVersion: number;
  stops: Stop[];
  legs: Leg[];
  scheduleItems: ScheduleItem[];
  hotelStays: HotelStay[];
  checklist: boolean[];
  extraChecklist: ChecklistItem[];
  sharedLinks: TripLink[];
  notes: string;
  cnyPerEuro: number;
  costEntries: CostEntry[];
  expenses: Expense[];
  settlements: Settlement[];
  customCategories: string[];
  dismissedSuggestions: string[];
  coverPhoto: string;
};

export type TaxiInfo = {
  kind: "hotel" | "place";
  title: string;
  titleZh?: string;
  subtitle: string;
  subtitleZh?: string;
};

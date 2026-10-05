"use client";

import { insertStop, moveStop, removeStop, setStopNights, stopRemovalImpact } from "@/lib/planner/model";
import type { Stop } from "@/lib/planner/types";
import { plural } from "@/lib/planner/utils";
import { usePlanner } from "./context";

/** Azioni sulle tappe condivise da elenco e mappa: notti, ordine, eliminazione e aggiunta. */
export function useStopActions() {
  const { plan, update, notify, log, selectedStopId, setSelectedStopId } = usePlanner();

  function changeNights(stop: Stop, nights: number) {
    const preview = setStopNights(plan, stop.id, nights);
    if (preview.notice) notify(preview.notice);
    if (!preview.ok) return;
    update((current) => setStopNights(current, stop.id, nights).plan);
    log("Notti modificate", `${stop.name}: ${plural(nights, "notte", "notti")}`);
  }

  function move(stop: Stop, direction: -1 | 1) {
    update((current) => moveStop(current, stop.id, direction));
    log("Tappa spostata", `${stop.name} ${direction < 0 ? "prima" : "dopo"}`);
  }

  /** Chiede conferma con i numeri giusti; restituisce true se la tappa è stata eliminata. */
  function remove(stop: Stop) {
    const impact = stopRemovalImpact(plan, stop.id);
    const lines = [`Eliminare ${stop.name} dal piano?`, ""];
    if (impact.removedItems) lines.push(`• ${plural(impact.removedItems, "blocco in agenda verrà cancellato", "blocchi in agenda verranno cancellati")}`);
    if (impact.removedStays) lines.push("• l'hotel non prenotato verrà cancellato");
    if (impact.keptItems + impact.keptStays) lines.push(`• ${plural(impact.keptItems + impact.keptStays, "prenotazione già fatta resta", "prenotazioni già fatte restano")} da ricollocare`);
    if (impact.givenNights && impact.receiver) lines.push(`• ${plural(impact.givenNights, "notte passa", "notti passano")} a ${impact.receiver.name}`);
    if (!window.confirm(lines.join("\n"))) return false;
    const result = removeStop(plan, stop.id);
    if (!result.ok) return false;
    update((current) => removeStop(current, stop.id).plan);
    notify(result.notice);
    log("Tappa eliminata", result.notice);
    if (selectedStopId === stop.id) setSelectedStopId(impact.receiver?.id || "beijing");
    return true;
  }

  /** Inserisce una nuova tappa (notti prese dalle altre se serve); restituisce true se aggiunta. */
  function add(stop: Stop, options: { afterId: string; nights: number; donorId?: string }, source = "Tappa aggiunta") {
    const preview = insertStop(plan, stop, options);
    if (!preview.ok) {
      notify(preview.notice);
      return false;
    }
    update((current) => insertStop(current, stop, options).plan);
    const nights = preview.plan.stops.find((item) => item.id === stop.id)?.nights || 1;
    const after = plan.stops.find((item) => item.id === options.afterId);
    notify(`${stop.name} aggiunta${after ? ` dopo ${after.name}` : ""} con ${plural(nights, "notte", "notti")}. ${preview.notice}`.trim());
    setSelectedStopId(stop.id);
    log(source, `${stop.name} · ${plural(nights, "notte", "notti")}${after ? ` · dopo ${after.name}` : ""}`);
    return true;
  }

  return { changeNights, move, remove, add };
}

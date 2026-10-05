"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PLAN_VERSION } from "@/lib/planner/catalog";
import { changedKeys, loadPlan, mergePlan, migratePlan, refreshDerived, seedPlan, shapePlan } from "@/lib/planner/model";
import type { PlanData } from "@/lib/planner/types";

export type SyncStatus = "loading" | "saving" | "synced" | "offline" | "error" | "demo";

export type ChangeLogEntry = {
  id: string;
  authorEmail: string;
  authorName: string;
  action: string;
  detail: string;
  createdAt?: Timestamp | null;
};

const PLAN_PATH = ["travel-plans", "china-2026"] as const;
const STORAGE_KEY = "china-planner-v2";
const DEMO_STORAGE_KEY = "china-planner-demo";
export const BACKUP_KEY = "china-planner-backup-before-v4";

function planDocument() {
  return doc(db, ...PLAN_PATH);
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Spazio pieno o navigazione privata: il cloud resta la copia principale.
  }
}

/** Copia locale del piano + ultimo stato visto nel cloud (serve a capire cosa è cambiato offline). */
function readStored(storageKey: string): { plan: PlanData | null; base: PlanData | null } {
  const plan = loadPlan(readJson(storageKey));
  const base = shapePlan(readJson(`${storageKey}-base`));
  return { plan, base: plan ? base : null };
}

export function authorName(user: User | null) {
  const email = user?.email?.toLowerCase() || "";
  if (email === "sofiakovaleva1998@gmail.com") return "Sofia";
  if (email === "bebroggi@gmail.com") return "Alberto";
  return user?.displayName || email || "Utente";
}

export function usePlanSync(user: User | null, demo: boolean) {
  const storageKey = demo ? DEMO_STORAGE_KEY : STORAGE_KEY;
  const [stored] = useState(() => readStored(storageKey));
  const [plan, setPlan] = useState<PlanData>(() => stored.plan || seedPlan());
  const [ready, setReady] = useState(demo);
  const [status, setStatus] = useState<SyncStatus>(demo ? "demo" : "loading");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const planRef = useRef(plan);
  const baseRef = useRef<PlanData | null>(stored.base);

  useEffect(() => {
    planRef.current = plan;
    if (demo || ready) writeJson(storageKey, plan);
  }, [plan, demo, ready, storageKey]);

  const update = useCallback((updater: (current: PlanData) => PlanData) => {
    setPlan((current) => refreshDerived(updater(current)));
  }, []);

  const log = useCallback((action: string, detail: string) => {
    if (demo || !user) return;
    void addDoc(collection(db, ...PLAN_PATH, "change-log"), {
      authorEmail: user.email?.toLowerCase() || "",
      authorName: authorName(user),
      action,
      detail,
      createdAt: serverTimestamp(),
    }).catch(() => undefined);
  }, [demo, user]);

  // Ascolta il documento condiviso e unisce ciò che arriva con le modifiche locali non ancora salvate.
  useEffect(() => {
    if (demo || !user) return;
    let initialized = false;
    return onSnapshot(planDocument(), async (snapshot) => {
      // Eco delle nostre scritture ancora in volo: lo stato locale è già più aggiornato.
      if (initialized && snapshot.metadata.hasPendingWrites) return;
      if (!snapshot.exists()) {
        const seed = planRef.current;
        try {
          await setDoc(planDocument(), { ...seed, updatedAt: serverTimestamp() });
          baseRef.current = seed;
          writeJson(`${storageKey}-base`, seed);
          initialized = true;
          setReady(true);
          setStatus("synced");
          setLastSavedAt(new Date());
        } catch {
          setStatus("error");
        }
        return;
      }
      const data = snapshot.data();
      const shaped = shapePlan(data);
      if (!shaped) {
        setStatus("error");
        return;
      }
      if (shaped.itineraryVersion < PLAN_VERSION && !localStorage.getItem(BACKUP_KEY)) writeJson(BACKUP_KEY, data);
      const { plan: remote, notes } = migratePlan(shaped);
      // Il confronto avviene tra versioni già aggiornate: così l'aggiornamento automatico dei dati non
      // viene scambiato per una modifica locale che vince su quelle arrivate dal cloud.
      const mergeBase = baseRef.current ? migratePlan(baseRef.current).plan : null;
      const merged = mergePlan(mergeBase, planRef.current, remote);
      baseRef.current = shaped;
      writeJson(`${storageKey}-base`, shaped);
      planRef.current = merged;
      setPlan(merged);
      if (!initialized && notes.length) log("Piano aggiornato", notes.join(" "));
      initialized = true;
      setReady(true);
      setStatus(changedKeys(shaped, merged).length ? "saving" : snapshot.metadata.fromCache ? "offline" : "synced");
      const updatedAt = (data.updatedAt as Timestamp | undefined)?.toDate?.();
      if (updatedAt) setLastSavedAt(updatedAt);
    }, () => setStatus("error"));
  }, [demo, user, storageKey, log]);

  // Salva nel cloud solo le parti cambiate (la foto di copertina non viaggia a ogni modifica).
  useEffect(() => {
    if (!ready || demo || !user) return;
    const keys = changedKeys(baseRef.current, plan);
    if (keys.length === 0) return;
    setStatus("saving");
    const timer = window.setTimeout(async () => {
      const patch = Object.fromEntries(keys.map((key) => [key, plan[key]])) as Partial<PlanData>;
      try {
        await setDoc(planDocument(), { ...patch, itineraryVersion: PLAN_VERSION, updatedAt: serverTimestamp(), updatedBy: user.email || "" }, { merge: true });
        baseRef.current = { ...(baseRef.current || plan), ...patch, itineraryVersion: PLAN_VERSION };
        writeJson(`${storageKey}-base`, baseRef.current);
        setLastSavedAt(new Date());
        if (changedKeys(baseRef.current, planRef.current).length === 0) setStatus("synced");
      } catch {
        setStatus("error");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [plan, ready, demo, user, storageKey]);

  // Offline: le modifiche restano in coda e partono appena torna la rete.
  useEffect(() => {
    if (demo) return;
    const goOffline = () => setStatus("offline");
    const goOnline = () => setStatus(changedKeys(baseRef.current, planRef.current).length ? "saving" : "synced");
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [demo]);

  return { plan, update, ready, status, lastSavedAt, log };
}

export function useChangeLog(enabled: boolean) {
  const [entries, setEntries] = useState<ChangeLogEntry[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const logQuery = query(collection(db, ...PLAN_PATH, "change-log"), orderBy("createdAt", "desc"), limit(80));
    return onSnapshot(logQuery, (snapshot) => {
      setEntries(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as ChangeLogEntry)));
    }, () => setEntries([]));
  }, [enabled]);
  return entries;
}

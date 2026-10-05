"use client";

import { timeToMinutes } from "@/lib/planner/utils";

export type HourBlock = {
  id: string;
  kind: "activity" | "transport" | "leg";
  start: string;
  end: string;
  title: string;
  subtitle?: string;
  booked?: boolean;
  conflict?: boolean;
};

const GRID_START = 6;
const GRID_END = 24;
const HOUR_PX = 54;

export function HourGrid({ blocks, onPickTime, onOpenBlock }: { blocks: HourBlock[]; onPickTime: (time: string) => void; onOpenBlock: (block: HourBlock) => void }) {
  const sorted = [...blocks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const laneEnds: number[] = [];
  const lanes = sorted.map((block) => {
    const start = timeToMinutes(block.start);
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = Math.max(timeToMinutes(block.end), start + 30);
    return lane;
  });
  const laneCount = Math.max(1, laneEnds.length);
  const gridStart = GRID_START * 60;
  return <div className="hour-grid" style={{ height: (GRID_END - GRID_START) * HOUR_PX }}>
    {Array.from({ length: GRID_END - GRID_START }, (_, index) => GRID_START + index).map((hour) => (
      <button type="button" key={hour} className="hour-row" style={{ top: (hour - GRID_START) * HOUR_PX, height: HOUR_PX }} onClick={() => onPickTime(`${String(hour).padStart(2, "0")}:00`)} title={`Nuovo blocco alle ${hour}:00`}>
        <span>{String(hour).padStart(2, "0")}:00</span>
      </button>
    ))}
    {sorted.map((block, index) => {
      const start = Math.max(timeToMinutes(block.start), gridStart);
      const end = Math.max(timeToMinutes(block.end), start + 30);
      const top = (start - gridStart) / 60 * HOUR_PX;
      const height = Math.max(26, (end - start) / 60 * HOUR_PX - 3);
      return <button type="button" key={block.id} className={`hour-block kind-${block.kind} ${block.booked ? "booked" : ""} ${block.conflict ? "conflict" : ""}`} style={{ top, height, left: `calc(58px + ${lanes[index]} * (100% - 58px) / ${laneCount})`, width: `calc((100% - 58px) / ${laneCount} - 6px)` }} onClick={() => onOpenBlock(block)}>
        <b>{block.title}</b>
        <small>{block.start}–{block.end}{block.subtitle ? ` · ${block.subtitle}` : ""}</small>
      </button>;
    })}
  </div>;
}

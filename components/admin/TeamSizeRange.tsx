"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { teamSizeLabel } from "@/lib/team-size";
import styles from "./styles";

export function TeamSizeRange({
  minimum,
  maximum,
  ceiling,
}: {
  minimum: number;
  maximum: number;
  ceiling: number;
}) {
  const [lowPosition, setLow] = useState(minimum);
  const [highPosition, setHigh] = useState(maximum);
  const low = Math.round(lowPosition);
  const high = Math.round(highPosition);
  const [limitText, setLimitText] = useState(String(ceiling));
  const limit = Number(limitText) || 1;
  const drag = useRef<"low" | "high" | "both" | null>(null);
  const grabOffset = useRef(0);
  const percent = (n: number) =>
    limit === 1 ? 0 : (100 * (n - 1)) / (limit - 1);
  function move(event: PointerEvent<HTMLDivElement>, start: boolean) {
    if (!event.isPrimary || (start ? event.button !== 0 : !drag.current)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pointer = 1 + ((event.clientX - rect.left) / rect.width) * (limit - 1);
    if (start) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current =
        low === high
          ? "both"
          : Math.abs(pointer - low) < Math.abs(pointer - high)
            ? "low"
            : "high";
      const anchor = drag.current === "high" ? high : low;
      const distance = pointer - anchor;
      grabOffset.current = Math.abs(distance) <= (10 / rect.width) * (limit - 1) ? distance : 0;
    }
    const value = Math.max(1, Math.min(limit, pointer - grabOffset.current));
    const separating = drag.current === "both" && value !== low;
    if (separating)
      drag.current = value < low ? "low" : "high";
    if (start || separating) {
      const focusLow = drag.current === "low" || (drag.current === "both" && low === limit);
      event.currentTarget.querySelector<HTMLInputElement>(
        focusLow ? '[name="minTeamSize"]' : '[name="maxTeamSize"]',
      )?.focus({ preventScroll: true });
    }
    if (drag.current === "low") setLow(Math.min(value, high));
    if (drag.current === "high") setHigh(Math.max(value, low));
  }
  return (
    <fieldset className={styles.sizeRange}>
      <legend className="sr-only">Members per team</legend>
      <div className={styles.sizeHeader}>
        <div>
          <span className={styles.sizeCaption}>Members per team</span>
          <strong className={styles.sizeValue}>
            {low === high ? "Exactly " : ""}
            {teamSizeLabel(low, high)}
          </strong>
        </div>
        <label className={styles.field}>
          Slider maximum
          <input
            type="number"
            name="teamSizeCeiling"
            min={1}
            max={100}
            placeholder="1"
            required
            value={limitText}
            onBlur={() => {
              if (limitText === "") setLimitText("1");
            }}
            onChange={(event) => {
              const text = event.target.value;
              const next = text === "" ? 1 : Number(text);
              if (!Number.isInteger(next) || next < 1 || next > 100) return;
              setLimitText(text);
              setLow(1);
              setHigh(next);
            }}
          />
        </label>
      </div>
      <div
        className={styles.sizeRail}
        style={{ "--step-count": Math.max(1, limit - 1) } as CSSProperties}
        data-exact={lowPosition === highPosition}
        onPointerDown={(e) => move(e, true)}
        onPointerMove={(e) => move(e, false)}
        onLostPointerCapture={() => {
          drag.current = null;
          setLow(Math.round);
          setHigh(Math.round);
        }}
      >
        <span
          className={styles.sizeFill}
          style={{
            clipPath: `inset(0 ${100 - percent(highPosition)}% 0 ${percent(lowPosition)}% round 999px)`,
          }}
        />
        {Array.from({ length: limit }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={styles.sizeTick}
            data-selected={index + 1 >= lowPosition && index + 1 <= highPosition}
            style={{ left: percent(index + 1) + "%" }}
          />
        ))}
        {(["low", "high"] as const).map((end) => {
          const value = end === "low" ? low : high;
          return (
            <input
              key={end}
              type="range"
              className={styles.sizeHandle}
              name={end === "low" ? "minTeamSize" : "maxTeamSize"}
              aria-label={
                end === "low" ? "Minimum team size" : "Maximum team size"
              }
              min={1}
              max={limit}
              value={value}
              style={{ left: percent(end === "low" ? lowPosition : highPosition) + "%" }}
              onChange={(e) =>
                end === "low"
                  ? setLow(Math.min(high, +e.target.value))
                  : setHigh(Math.max(low, +e.target.value))
              }
            />
          );
        })}
      </div>
      <div className={styles.sizeEnds}>
        <span>1</span>
        {limit > 1 && <span>{limit}</span>}
      </div>
    </fieldset>
  );
}

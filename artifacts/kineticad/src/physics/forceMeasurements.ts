import { create } from 'zustand';
import type { ForceExperimentConfig } from '../state/schemas';
import type { PartDescriptor, StepResult } from './types';

export type ForceReading = {
  partId: string;
  massKg: number;
  initialPositionMm: [number, number, number];
  velocityMmPerSec: number;
  distanceMm: number;
  expectedAccelerationMmPerSec2: number;
  measuredAccelerationMmPerSec2: number | null;
};

type ForceMeasurements = {
  config: ForceExperimentConfig | null;
  rows: ForceReading[];
  timeMs: number;
  completed: boolean;
};

const empty: ForceMeasurements = { config: null, rows: [], timeMs: 0, completed: false };
/** Transient results only. Never saved into the user's CAD project. */
export const useForceMeasurements = create<ForceMeasurements>(() => empty);

export function clearForceMeasurements() {
  useForceMeasurements.setState(empty);
}

export function beginForceMeasurements(config: ForceExperimentConfig | undefined, parts: PartDescriptor[]) {
  if (!config) { clearForceMeasurements(); return; }
  const byId = new Map(parts.map((part) => [part.id, part]));
  useForceMeasurements.setState({ config, completed: false, timeMs: 0,
    rows: config.partIds.map((partId) => {
      const part = byId.get(partId);
      if (!part || part.isGround) throw new Error(`Force target ${partId} is not a moving body.`);
      return { partId, massKg: part.massKg, initialPositionMm: part.transform.positionMm,
        velocityMmPerSec: 0, distanceMm: 0,
        expectedAccelerationMmPerSec2: config.forceN * 1000 / part.massKg,
        measuredAccelerationMmPerSec2: null };
    }),
  });
}

/** Differentiate actual solver velocity; do not substitute F/m for a measurement. */
export function reduceForceMeasurements(previous: ForceMeasurements, result: StepResult): ForceMeasurements {
  if (!previous.config || !result.bodyMeasurements || result.dtMs <= 0) return previous;
  const timeMs = result.simulatedTimeMs ?? previous.timeMs + result.dtMs;
  const elapsedSec = (timeMs - previous.timeMs) / 1000;
  if (!(elapsedSec > 0)) return previous;
  const direction = previous.config.direction;
  const byId = new Map(result.bodyMeasurements.map((reading) => [reading.partId, reading]));
  const rows = previous.rows.map((row) => {
    const measured = byId.get(row.partId);
    if (!measured) throw new Error(`No physics measurement returned for ${row.partId}.`);
    const velocity = measured.linearVelocityMmPerSec.reduce((sum, v, i) => sum + v * direction[i], 0);
    const distance = measured.positionMm.reduce((sum, v, i) => sum + (v - row.initialPositionMm[i]) * direction[i], 0);
    return { ...row, velocityMmPerSec: velocity, distanceMm: distance,
      measuredAccelerationMmPerSec2: (velocity - row.velocityMmPerSec) / elapsedSec };
  });
  return { ...previous, rows, timeMs, completed: !!result.completed };
}

export function publishForceMeasurements(result: StepResult) {
  const previous = useForceMeasurements.getState();
  const next = reduceForceMeasurements(previous, result);
  if (next !== previous) useForceMeasurements.setState(next);
}

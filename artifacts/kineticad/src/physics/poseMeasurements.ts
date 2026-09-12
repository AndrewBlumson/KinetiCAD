import { create } from 'zustand';
import type { StepResult, StepTransform, StewartMeasurement, BodyMeasurement } from './types';

/** The same solver poses published to the viewport. Transient, never saved. */
export const usePoseMeasurements = create<{ poses: StepTransform[]; bodies: BodyMeasurement[]; simulatedTimeMs: number; runGeneration: number; stewart?: StewartMeasurement }>(() => ({ poses: [], bodies: [], simulatedTimeMs: 0, runGeneration: 0 }));
export const clearPoseMeasurements = () => usePoseMeasurements.setState(s => ({ poses: [], bodies: [], simulatedTimeMs: 0, runGeneration: s.runGeneration + 1, stewart: undefined }));
export const publishPoseMeasurements = (result: StepResult) => {
  if (result.dtMs > 0) usePoseMeasurements.setState({ poses: result.transforms, bodies: result.bodyMeasurements ?? [], simulatedTimeMs: result.simulatedTimeMs ?? 0, stewart: result.stewartMeasurement });
};

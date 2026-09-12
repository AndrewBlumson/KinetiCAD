import { create } from 'zustand';
import type { StepResult, StepTransform, StewartMeasurement } from './types';

/** The same solver poses published to the viewport. Transient, never saved. */
export const usePoseMeasurements = create<{ poses: StepTransform[]; stewart?: StewartMeasurement }>(() => ({ poses: [] }));
export const clearPoseMeasurements = () => usePoseMeasurements.setState({ poses: [], stewart: undefined });
export const publishPoseMeasurements = (result: StepResult) => {
  if (result.dtMs > 0) usePoseMeasurements.setState({ poses: result.transforms, stewart: result.stewartMeasurement });
};

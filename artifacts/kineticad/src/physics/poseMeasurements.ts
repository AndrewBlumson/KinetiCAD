import { create } from 'zustand';
import type { StepResult, StepTransform } from './types';

/** The same solver poses published to the viewport. Transient, never saved. */
export const usePoseMeasurements = create<{ poses: StepTransform[] }>(() => ({ poses: [] }));
export const clearPoseMeasurements = () => usePoseMeasurements.setState({ poses: [] });
export const publishPoseMeasurements = (result: StepResult) => {
  if (result.dtMs > 0) usePoseMeasurements.setState({ poses: result.transforms });
};

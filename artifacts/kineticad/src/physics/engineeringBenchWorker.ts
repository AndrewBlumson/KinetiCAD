import { expose } from 'comlink';
import { createActuatorBench, type ActuatorBenchConfig, type ActuatorBenchSnapshot } from './actuatorBench.ts';
import { createContactBench, type ContactBenchConfig, type ContactBenchSnapshot } from './contactBench.ts';

export type BenchRequest = { kind: 'actuator'; config: ActuatorBenchConfig } | { kind: 'contact'; config: ContactBenchConfig };
export type BenchSnapshot = ActuatorBenchSnapshot | ContactBenchSnapshot;
let bench: { step(ms: number): BenchSnapshot; dispose(): void } | undefined;
let operations: Promise<unknown> = Promise.resolve();
const serial = <T>(action: () => Promise<T> | T): Promise<T> => {
  const next = operations.then(action); operations = next.catch(() => {}); return next;
};
const api = {
  build(request: BenchRequest) { return serial(async () => {
    bench?.dispose(); bench = undefined;
    bench = request.kind === 'actuator' ? await createActuatorBench(request.config) : await createContactBench(request.config);
    return bench.step(0);
  }); },
  step(ms: number) { return serial(() => {
    if (!bench) throw new Error('Build the experiment before running it.');
    return bench.step(ms);
  }); },
  destroy() { return serial(() => { bench?.dispose(); bench = undefined; }); },
};
export type EngineeringBenchApi = typeof api;
expose(api);

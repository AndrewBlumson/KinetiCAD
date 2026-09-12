import * as THREE from 'three';
import type { Assembly, SimulationState } from '../state/schemas';
import { matchesFourBarConfiguration } from '../mechanisms/fourBarWorkspace';
import { FOUR_BAR_GEOMETRY, FOUR_BAR_IDS } from '../mechanisms/fourBarAssembly';

/** Screen annotation of a material point on the actual displayed coupler.
 * Projection never drives or modifies the mesh or physics state. */
export function createFourBarTraceLabel(container: HTMLElement) {
  const label = document.createElement('div');
  label.setAttribute('aria-hidden','true');
  label.textContent = 'Trace point';
  Object.assign(label.style,{position:'absolute',pointerEvents:'none',visibility:'hidden',transform:'translate(-50%,-100%)',
    borderBottom:'2px solid #fb923c',borderRadius:'4px',padding:'3px 6px',background:'#111827dd',color:'#fdba74',font:'11px ui-sans-serif,sans-serif'});
  container.appendChild(label);
  const position = new THREE.Vector3();
  let previousAssembly: Assembly | undefined, previousDesign: SimulationState['fourBar'], previousConfig = '', valid = false;
  return {
    update(assembly:Assembly,simulation:SimulationState,camera:THREE.Camera,meshFor:(id:string)=>THREE.Object3D|null) {
      if (!simulation.fourBar) { label.style.visibility='hidden';previousDesign=undefined;return; }
      const key = JSON.stringify([simulation.gravity,simulation.timeStepMs,simulation.durationMs,simulation.sketchGeometryEdited,
        simulation.forceExperiment,simulation.crankSlider,simulation.stewartMotion]);
      if (previousAssembly !== assembly || previousDesign !== simulation.fourBar || previousConfig !== key) {
        previousAssembly=assembly;previousDesign=simulation.fourBar;previousConfig=key;valid=matchesFourBarConfiguration(assembly,simulation);
      }
      const mesh = valid ? meshFor(FOUR_BAR_IDS.coupler) : null;
      if (!mesh || !simulation.fourBar) { label.style.visibility='hidden';return; }
      const [u,v] = simulation.fourBar.params.couplerPointLocalMm;
      position.set(u,v,FOUR_BAR_GEOMETRY.traceZMm-FOUR_BAR_GEOMETRY.couplerOriginZMm);
      mesh.updateWorldMatrix(true,false);
      camera.updateWorldMatrix(true,false);
      mesh.localToWorld(position).project(camera);
      label.style.visibility=position.z < -1 || position.z > 1 ? 'hidden':'visible';
      label.style.left=`${(position.x+1)*50}%`;label.style.top=`${(1-position.y)*50}%`;
    },
    dispose(){label.remove();},
  };
}

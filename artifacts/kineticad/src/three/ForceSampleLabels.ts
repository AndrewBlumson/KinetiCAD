import * as THREE from 'three';

/** Small numbered annotations follow the actual displayed bodies, never a calculated animation. */
export function createForceSampleLabels(container: HTMLElement) {
  const layer = document.createElement('div');
  Object.assign(layer.style, { position:'absolute', inset:'0', pointerEvents:'none', overflow:'hidden' });
  layer.setAttribute('aria-hidden', 'true');
  container.appendChild(layer);
  const labels = new Map<string, HTMLSpanElement>();
  const position = new THREE.Vector3();
  return {
    update(ids: string[], camera: THREE.Camera, meshFor: (id: string) => THREE.Object3D | null) {
      for (const [id, label] of labels) if (!ids.includes(id)) { label.remove(); labels.delete(id); }
      ids.forEach((id, index) => {
        let label = labels.get(id);
        if (!label) {
          label = document.createElement('span');
          label.textContent = String(index + 1);
          Object.assign(label.style, { position:'absolute', width:'19px', height:'19px', display:'grid', placeItems:'center',
            borderRadius:'50%', background:'#172033', border:'1px solid #92a3b8', color:'#f1f5f9', font:'11px ui-monospace, monospace',
            transform:'translate(-50%,-100%)' });
          layer.appendChild(label); labels.set(id, label);
        }
        const mesh = meshFor(id) as THREE.Mesh | null;
        if (!mesh) { label.style.visibility = 'hidden'; return; }
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox;
        position.set(0, 0, (box?.max.z ?? 20) + 6);
        mesh.updateWorldMatrix(true, false);
        mesh.localToWorld(position).project(camera);
        label.style.visibility = position.z < -1 || position.z > 1 ? 'hidden' : 'visible';
        label.style.left = `${(position.x + 1) * 50}%`;
        label.style.top = `${(1 - position.y) * 50}%`;
      });
    },
    dispose() { labels.clear(); layer.remove(); },
  };
}

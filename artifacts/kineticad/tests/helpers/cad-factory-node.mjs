// Same installed OCCT WASM, using its Node file loader instead of the browser CDN.
import factory from 'opencascade.js/dist/node.js';
export default function LocalCadFactory() { return factory(); }

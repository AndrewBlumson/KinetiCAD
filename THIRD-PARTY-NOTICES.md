# Third-party software, icons and fonts

KinetiCAD makes use of Open CASCADE Technology, OpenCascade.js, Rapier, Three.js
and the other projects listed here. Thank you to their authors and contributors.
KinetiCAD's own [MIT licence](LICENSE) does not replace their licences.

The original project was built by Andrew Blumson and Kevin Blumson with Replit
Agent. Later Codex development and verification retain that origin. This notice
inventory does not change the authorship or licence of any upstream work.

## Inventory and original notices

The [installed package table](licenses/README.md) covers **147 package versions**
from both browser applications. It conservatively includes source imports,
declared application dependencies and their installed dependency closure, even
where a UI component is unused or removed by tree shaking. It excludes unrelated
server, development and test tools. It is not a measurement of the final bundles.

- [Installed metadata and hashes](licenses/manifest.json): exact versions, declared
  licences, repositories, lockfile hash and **143 original installed notice files**.
- [Upstream supplements](licenses/supplemental-manifest.json): **11 original
  notice files**, their source URLs/revisions and hashes. These cover npm packages
  that omit notice text, the OCCT kernel, Font Awesome artwork and externally
  requested fonts. The original texts are retained without editing.
- [Reproduction script](licenses/collect-notices.mjs): after the frozen install,
  run `node licenses/collect-notices.mjs --check` from the repository root. It
  checks the installed inventory and every recorded supplemental file hash;
  it does not download or revalidate upstream sources.
- [Security-update notice review](licenses/security-update-review.json): the
  refreshed lockfile inventory and a separate online comparison of all 11 pinned
  supplemental notice texts. Lodash's installed notice now corresponds to 4.18.0;
  the previous version's notice is retained as historical material.

Selected components follow; the full table also includes React, Radix UI, D3
notices vendored by Victory, and the remaining UI dependencies.

| Component | Installed version | Licence and original notice |
| --- | --- | --- |
| OpenCascade.js | 2.0.0-beta.94e2944 | [LGPL 2.1](licenses/packages/opencascade.js/2.0.0-beta.94e2944/LICENSE); package declares `LGPL-2.1-only` |
| Open CASCADE Technology kernel | 7.6.2, identified by the installed OpenCascade.js README | [LGPL 2.1](licenses/upstream/OCCT/7.6.2/LICENSE_LGPL_21.txt) and [OCCT exception](licenses/upstream/OCCT/7.6.2/OCCT_LGPL_EXCEPTION.txt) |
| Rapier (`@dimforge/rapier3d-compat`) | 0.12.0 | [Apache 2.0](licenses/packages/dimforge__rapier3d-compat/0.12.0/LICENSE) |
| Comlink | 4.4.1 | [Apache 2.0](licenses/packages/comlink/4.4.1/LICENSE) |
| Three.js | 0.184.0 | [MIT](licenses/packages/three/0.184.0/LICENSE) |
| three-mesh-bvh | 0.7.8 | [MIT](licenses/packages/three-mesh-bvh/0.7.8/LICENSE) |
| Zustand | 5.0.12 | [MIT](licenses/packages/zustand/5.0.12/LICENSE) |
| React Icons wrapper | 5.6.0 | [MIT and individual icon-library notices](licenses/packages/react-icons/5.6.0/LICENSE); the wrapper licence does not cover every icon's artwork |
| Lucide React icons | 0.545.0 | [ISC](licenses/packages/lucide-react/0.545.0/LICENSE) |

## Open CASCADE and the WebAssembly component

KinetiCAD uses Open CASCADE Technology facilities for its B-rep geometry, mass
properties and CAD exchange. The kernel has LGPL 2.1 terms with the OCCT
additional exception; the wrapper package separately declares LGPL 2.1 only.
The [OCCT 7.6.2 source and licence](https://github.com/Open-Cascade-SAS/OCCT/tree/V7_6_2)
and [OpenCascade.js source revision](https://github.com/donalffons/opencascade.js/tree/94e2944)
are upstream references for the installed package.

The [CAD worker](artifacts/kineticad/src/cad/cadWorker.ts) requests the unmodified
`opencascade.js@2.0.0-beta.94e2944/dist/opencascade.full.wasm` asset from jsDelivr.
This notice inventory does not include that binary or an independently rebuilt
kernel. When distributing a production build or mirroring the WASM, retain the
library notices and verify the corresponding-source and replacement/relinking
arrangements for that exact distribution. A link to KinetiCAD's MIT licence alone
does not meet the library's separate terms. The later targeted dependency security
updates did not change the OpenCascade.js or OCCT kernel versions listed here.

## Font Awesome social icons

The landing page uses the LinkedIn and X/Twitter symbols (`FaLinkedinIn` and
`FaXTwitter`) from **Font Awesome Free 6.5.2 by Fonticons, Inc.**, through React
Icons. The artwork is used in SVG form with the site's display size and colour.
Font Awesome's SVG/JS icon artwork is under **Creative Commons Attribution 4.0**;
the React wrapper's MIT licence is a separate grant. See the
[original Font Awesome notice](licenses/upstream/Font-Awesome/6.5.2/LICENSE.txt),
[upstream source](https://github.com/FortAwesome/Font-Awesome/tree/6.5.2) and
[CC BY 4.0 licence](https://creativecommons.org/licenses/by/4.0/).
Names and social-service marks identify their respective services; no endorsement
is implied.

## Externally requested fonts

The CAD page requests **Inter**, and the landing pages request **Space Grotesk**
and **JetBrains Mono**, through Google Fonts. Their upstream source notices use
the SIL Open Font License 1.1:
[Inter](licenses/upstream/google-fonts/inter/OFL.txt),
[Space Grotesk](licenses/upstream/google-fonts/spacegrotesk/OFL.txt), and
[JetBrains Mono](licenses/upstream/google-fonts/jetbrainsmono/OFL.txt).
The supplemental manifest pins the source-notice snapshot. It is not a version
pin of the browser-specific font files returned by Google's service. This source
repository does not contain those font binaries. Retain their notices if adding
a self-hosted distribution later.

## Scope and remaining distribution checks

Eighteen installed package versions omit a notice file from their npm archive.
Seventeen are supplemented from the source revision recorded by that npm
release. For **react-remove-scroll-bar 2.3.8**, the npm-declared source revision
was unavailable from its declared GitHub repository during this audit and the
security-update recheck. Neither the `2.3.8` nor `v2.3.8` tag resolved. Its
package metadata declares MIT; a pinned current project licence is included as
a reference, explicitly **not** as proof of the exact 2.3.8 source tree. The
[supplemental manifest](licenses/supplemental-manifest.json) records this gap.

Keep this document, the applicable original copyright/licence/NOTICE texts and
the project licence in source handoffs. Ensure the final deployed or downloadable
distribution makes its required notices available; check bundled output as well
as remotely loaded assets. Resolve the source-version gap and exact OCCT binary
distribution arrangements before claiming those checks are complete. If the
dependency graph or imported artwork changes, regenerate and review the inventory.

This is a source-based attribution record, not legal certification or a
vulnerability audit. Publication and deployment remain separate gates in the
[public-release checklist](docs/PUBLIC-RELEASE-CHECKLIST.md).

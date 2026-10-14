# Asset and license inventory — preliminary

TASK-034 documentation candidate, not a license grant or distribution clearance.
No third-party assets were acquired and no licenses were changed. A repository
`LICENSE`/`NOTICE` was not found in the inspected tracked source inventory; private
package metadata is not itself permission to publish the game's code or content.
Rights-holder and dependency review remains mandatory before distribution.

| Material                                      | Inspected source/provenance                                                                         | Remaining obligation                                                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fictional scenarios, records and ending prose | User-approved product specs, task decisions and `src/scenario/data/`                                | Rights-holder approval for publication, contributor/content provenance review                                                                           |
| Interface/CSS                                 | Repository code, no external image acquisition in TASK-033/034                                      | Existing/contributor rights and distribution terms; do not imply CC0/MIT for the whole project                                                          |
| App icon source                               | `src-tauri/icons/app-icon.svg`, geometric SVG in bootstrap commit `c9c8757`                         | Confirm authorship/rights and generated raster/icon lineage before installer inclusion                                                                  |
| Generated icon variants                       | ICO/ICNS/PNG plus Android/iOS variants under `src-tauri/icons/`, bootstrap commit                   | Presence of platform icons is not approval or certification for those platforms; verify tooling/output lineage                                          |
| Audio                                         | `src/audio/cues.ts`, repository-authored sine/triangle synthesis added in `8d07d78`                 | No third-party recording license needed by this implementation; retain project/contributor rights and native listening verification                     |
| Fonts                                         | CSS system-font preference list (IBM Plex Mono, Cascadia Mono, SFMono-Regular, Consolas, monospace) | No font binaries were added by these tasks; do not redistribute font files without their own rights review                                              |
| npm packages                                  | `package.json`, `package-lock.json`                                                                 | Complete locked runtime and bundled/transitive dependency notices, license texts and obligations; development tools distinguished from shipped material |
| Rust/Tauri and build dependencies             | `src-tauri/Cargo.toml`, `Cargo.lock`                                                                | Review locked crates, bundled artifacts and notices; lockfile/version pinning is not a legal license audit                                              |
| WebView2 / installer tooling                  | Existing host dependency; no runtime installer included yet                                         | Packaging approval, prerequisite handling and applicable vendor/tool distribution terms                                                                 |

The current inventory does not certify that every historical/transitive asset is
cleared. Do not label all dependencies MIT from package names, treat generated
images as automatically unrestricted, or invent publisher/contact/copyright
metadata. Signing credentials, store artwork and marketing assets are separate
choices. The proposed local review installer, if approved, must remain non-public
until notices/rights are complete and a distinct release decision is obtained.

Future evidence should record source paths, exact lockfile hashes, shipped files,
license texts/notice locations, unresolved obligations and the responsible human
approval. Any incompatible or unknown distribution obligation blocks release;
do not delete the dependency or substitute a license silently to obtain PASS.

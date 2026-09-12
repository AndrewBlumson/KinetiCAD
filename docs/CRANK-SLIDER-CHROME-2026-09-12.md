# Adjustable crank-slider: Chrome acceptance

Checked through the actual Chrome interface on `http://localhost:5185/app/` and `/app/simulator`, using the built production preview. The development server remains available on port 5184. This is local acceptance; user testing and Replit/public deployment acceptance remain pending.

The final stage build and source hashes are recorded in [crank-slider-validation.json](crank-slider-validation.json). These checks extend the earlier release's Chrome matrix; its historical records remain unchanged.

| Flow | Observed result |
|---|---|
| Open **Crank-slider** | Four native CAD parts and four joints appear in a separate demo session; 25 mm radius, 100 mm rod, 15 RPM defaults. The base, spindle support, crank pin, rod and guided slider are visibly connected. |
| Default motion | Runs for 8 simulated seconds, holds the final pose and offers **Run again**. Actual and calculated position curves overlap closely; final position rounds to 125.000 mm on both sides, error 0.0001 mm. |
| Run again | Restarts the clock and graph. At 0.35 s the new graph contained only the restarted segment; it did not retain the old eight-second curve. |
| Pause/resume | Pause held the clock and visible measurements while other checks were performed; Resume advanced from the held time. Dimension controls stay locked until Reset. |
| Invalid paired dimensions | Radius 40 mm with rod 100 mm was rejected with the minimum rod-length explanation. The previous assembly and 50 mm stroke remained intact. |
| Reverse motion | Applied 40 mm radius, 150 mm rod and −30 RPM, then ran and paused/resumed. Modeller showed the matching dimensions and only the crank motor enabled. |
| Limiting reverse dimensions | 40 mm radius, 180 mm rod, −30 RPM completed at 8 s. Final measured/calculated position: 220.000/220.000 mm; error 0.0003 mm; RPM −30.000/−30.000. |
| Single-field Apply | Typing 0 into RPM and clicking **Apply dimensions & speed** worked directly, without pressing Enter. An earlier disabled-button issue was repaired and this route repeated in the final bundle. |
| Zero RPM | The freshly rebuilt, unforced assembly remained at 125.000 mm for 8 s. Measured and calculated speed, mean acceleration and RPM all displayed 0.000; position error 0.0000 mm. |
| Reset demo | Restored 25/100/15 defaults, zero clock, empty measurements and original geometry. |
| Save and return | Save downloaded the native 40/150/−30 project. Return restored the five-part pre-existing QA model, including its named parts and Boolean. |
| Load and refresh | Loaded that actual download through Chrome's native file chooser. Four parts/four joints, 40/150/−30 controls and 80 mm stroke returned; browser refresh preserved them at a stopped zero clock. |
| Manual CAD edits | Changed the slider's native extrusion depth from 36 to 35 mm in Modeller. Simulator disabled parameter replacement/reference comparisons and showed the manual-edit explanation. The final bundle also hides the obsolete generated stroke summary. |
| Console inspection | Chrome's captured warning/error logs were empty during the final motion checks. |

The actual browser download is retained at [saved-reverse.kineticad.json](crank-slider-evidence/saved-reverse.kineticad.json). It contains four native parts, four mates and the edited mechanism parameters; this check does not substitute a generated fixture for a real Save/Load interaction.

The final mean-acceleration readout uses two measured velocities at least 1/30 s apart, including at the final pose. The reference uses precisely the same interval. Missing history remains unavailable. It does not claim an instantaneous acceleration measurement. The [numerical report](CRANK-SLIDER-VERIFICATION.md) records the separate raw single-step derivative comparisons that exceeded their provisional target.

The mechanism remains rigid and uses ideal joints. Contact, bearing friction, torque limits and elastic deformation are outside this example's accepted physical model.

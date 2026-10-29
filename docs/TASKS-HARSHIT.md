# Scanning and 3D model tasks: Harshit

Owner: **Harshit** (scanning and 3D model files). Ashmit owns the web app
([his list](TASKS-ASHMIT.md)); Yashraj owns the abstract, video and submission.

**Round 1 is due Oct 31.** Section A is needed **tonight (Oct 29)**, because Ashmit can't load the scan
and nobody can record the video until your files arrive.

Why this matters: judges score *visual quality and model fidelity* in Round 1, and in the finale
(Dec 16) **capture is 20% of the score**. You'll be the one scanning a new building at IIT Bombay against
the clock, so these practice scans count.

---

## A. Round 1 scan: tonight (Oct 29)

### A1. Get ready (10 min)
- [ ] Install **Scaniverse** (free, Android and iPhone). If anyone has an **iPhone Pro**, use **Polycam** (it has LiDAR).
- [ ] Phone charged above 70%, at least 5 GB free.
- [ ] Pick a room. **Tidy it**: clothes off the bed and floor, chairs pushed in.
- [ ] **All lights on**, curtains open, no direct sunlight patches.
- [ ] Doors open. Nobody walking around.
- [ ] Stick 2–3 pieces of tape on any large plain wall, so the app can track it.

### A2. Scan (3–5 min)
In Scaniverse choose **Splat** mode, not Mesh.

- [ ] Start at the **door, facing into the room**. This becomes where visitors start.
- [ ] Hold the phone upright at **chest height**.
- [ ] Walk **slowly** (half normal speed) along the walls, staying 1–2 m away.
- [ ] Do one loop facing the walls, then one loop from the middle facing outward.
- [ ] **At every corner, tilt slowly up to the ceiling and down to the floor.** The last scan skipped this and
      came out with no upper walls or ceiling.
- [ ] Never turn faster than a slow head turn; keep plenty of overlap.
- [ ] Don't point straight at mirrors or windows for long.
- [ ] Also record a **slow walk-through video** of the same route on the normal camera (backup).

Full procedure: [`docs/SOP.md`](SOP.md).

### A3. Check before you leave the room
- [ ] Open the processed scan in the app and spin it around.
- [ ] Are the **upper walls and ceiling** there? Any big holes or blurry patches?
- [ ] If yes, **scan again now**. Re-scanning later costs far more time.

### A4. Export and send
- [ ] Export the **splat** as `.ply` (also `.spz` if the app offers it).
- [ ] Export the **mesh** as `.glb` from the **same scan**. The splat and mesh must come from one scan, or they won't line up.
      If the app can't export a mesh from a Splat scan, do a second scan in **Mesh** mode, starting from the
      same spot, and tell Ashmit which is which.
- [ ] Upload all files to **Google Drive** in a folder named `scan-<room>-oct29`.
- [ ] Send the Drive link to **Ashmit and Yashraj**.

### A5. Measure one real length
- [ ] With a tape measure, note **the room's width** (wall to wall) or **a door's height**.
- [ ] Send the number with the files. Ashmit uses it to set the model's scale.

### A6. Notes for the abstract
Send these to Yashraj:
- [ ] App name and version, scan mode
- [ ] Phone model
- [ ] How long the scan took, and how long processing took
- [ ] Room size, and anything that went wrong

---

## B. Round 1 support: by Oct 30 noon

- [ ] **Screen-record the scanning app** while you scan (A2), if you can.
- [ ] Ask someone to **film you scanning** for about 1 minute from another phone. Shows judges our capture method.
- [ ] **Fill the timing log** at the bottom of [`docs/SOP.md`](SOP.md) with your times.
- [ ] Take 4–6 **photos** of the room and of you scanning, for the abstract.
- [ ] Suggest changes to the SOP based on what was hard. Send them to Yashraj.

---

## C. After Oct 31: Round 2 and the finale

| # | Task | When |
| --- | --- | --- |
| C1 | **Second practice scan** of a bigger space (corridor, lab, common room) to test multi-room capture | Early Nov |
| C2 | **POI list**: name and type of every place in the scanned space (rooms, desk, door, washroom) | When Ashmit's POI tool is ready |
| C3 | **Tag POIs** in the app's admin mode | After C2 |
| C4 | **10 test routes** (from → to) to check navigation | Nov 10–16 |
| C5 | **Print QR codes** for AR start points and test them on Android | From Nov 17 |
| C6 | **Two timed dry runs**: scan a new college building and get it live, targeting under 3 hours total | Dec 1–15 |
| C7 | **Finale kit**: phones, power bank, tripod/gimbal, tape, printed QR codes, extension board | Before Dec 16 |

---

## Quick checklist for tonight

1. Tidy, all lights on
2. Scaniverse → **Splat** mode
3. Slow loop, chest height, **tilt up and down at every corner**
4. Check for ceiling and holes; rescan if bad
5. Export `.ply` + `.glb` → Drive → send to Ashmit and Yashraj
6. Send one tape-measured length

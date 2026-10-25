# Capture SOP (v1 draft)

Standard Operating Procedure for scanning an indoor space with a phone so the pipeline can rebuild it
as a walkable 3D model. Owner: Harshit. Update it after every practice run.

## Before you start (5 min)

- [ ] Phone charged above 70%, power bank ready, at least 5 GB free
- [ ] Scanner app open (Scaniverse; Polycam on an iPhone Pro with LiDAR)
- [ ] All lights on, curtains open, no direct sun patches on the floor
- [ ] Doors between rooms fully open; chairs pushed in; nothing on the floor that will move
- [ ] People out of the space, or asked to stay still outside the frame
- [ ] Tape markers on large plain walls (2–3 per wall) so the scanner can track them
- [ ] Decide QR start points (entrance first) and note them on a sketch of the floor

## Capture route

1. Start at the entrance, facing in. This becomes the spawn point.
2. Hold the phone upright at **chest height (about 1.3 m)**, screen facing you.
3. Walk **slowly (half normal speed)** along the walls, room by room, keeping the wall **1–2 m** away.
4. In each room do one loop facing the walls, then one loop in the middle facing outwards.
5. At every **corner**, pause and sweep slowly from floor to ceiling.
6. At every **doorway**, film through it both ways so rooms connect.
7. Low and high pass: tilt down for the floor and furniture legs, up for the ceiling edge.
8. Keep **60–70% overlap**: never turn faster than about 30° per second.
9. Avoid pointing straight at mirrors, windows and glass doors for long.
10. Also record a **slow walk-through video** of the whole route (backup for Postshot training).

## After capture

- [ ] Process on the phone; export the splat (`.ply`) and the mesh (`.glb`)
- [ ] Copy exports to `captures/<venue>/` on the laptop
- [ ] Follow [`pipeline/README.md`](../pipeline/README.md)
- [ ] Measure one real distance (door height or room width) and compare with the model

## Timing log

Fill one row per run. The finale target is 3 hours from arrival to deployed link.

| Date | Venue | Area (m²) | Capture | Processing | Clean + align | Deploy | Total | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | |

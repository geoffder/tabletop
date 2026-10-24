# Tilted view

From ZÈRTZ, retrofitted onto a finished straight-down board: the board seen from the near side of the table, with pieces standing up from it. The user made it the default after seeing it, and plans to revisit the other GIPF project titles (GIPF, YINSH, DVONN, LYNGK) with it. DVONN already draws its stacks as discs seen at 0.72 on a board drawn straight down; tilting its board means foreshortening the board to the same ratio.

## Projection

- **One view object owns the projection.** A `BoardView` with a `tilt` ratio (1 = straight down) gives every space's centre (`y × tilt`), every height on screen (`height × √(1 − tilt²)`), the frame and the shape paths. Every centre lookup (rendering, labels, the animator's flight paths, hit areas) goes through it, so the straight-down view is `tilt = 1` of the same code and the switch is a title preference with a toggle.
- **Choosing the angle.** Show a labelled grid of the board at several tilts with pieces on it, then a finer grid between the two the user prefers. ZÈRTZ went 0.5 / 0.65 / 0.8, then 0.65 / 0.7 / 0.75 / 0.8; the user chose 0.75.
- **Circles on the board become ellipses.** A stroked circle inside `scale(1 tilt)` gives an exact flattened ring, strokes included. Outlines are better as `<ellipse>` elements so their line width stays even.
- **Spheres stay circles**, raised by their resting height on screen. A marble resting in a hole of radius r sits `√(R² − r²)` above the rim.
- **Frame and labels by silhouette.** A fixed fraction of the spacing put the bottom coordinate labels under the near pieces. Place each label a fixed gap beyond the silhouette of the piece it names: above, the higher of the face and the raised piece's top; below, the face plus the side showing under it. At tilt 1 this gives the same positions as before.

## Drawing order and interaction

- **Far first.** Sort spaces by screen y and draw the far rows first, so nearer pieces stand in front.
- **Passes.** Draw all bases, then the outline layer, then all raised pieces. With outlines in their own layer above the bases, a single pass drew a far space's outline across the raised piece in front of it. Passes are right only while a raised piece never overlaps a neighbouring base; work out from the geometry that it cannot at the chosen tilt before relying on it.
- **Clicks on raised pieces.** A raised piece reaches past its own space's face, onto the space behind. Give the piece the same click and hover handlers as its space (`role="presentation"`; the space keeps keyboard focus), and put the space's hit area on its base.
- **Static offsets on a wrapper.** A raised piece's lift is a static `transform`; put it on a wrapper around the node the animator tweens. GSAP reads a transform attribute on its target as its own x/y, so a `y` tween replaced the lift.

## Real pieces

- **Model the piece from photos of the published game,** and expect corrections in rounds. ZÈRTZ's rings, by round:
  1. Flat-topped cylinders, then cones with a flat top: the flat annulus with a rim line read as a seat for the marble.
  2. Plain cones sloping straight from the base to the hole's rim: the user pointed out the rim stands clear of the table.
  3. Thin hollow cones (height 0.155 × spacing, shell 0.045 × spacing, a darker gradient than the flat view's rings): through the hole, only the rim's cut edge shows on the far side, and below it the table in the cone's shadow.
- **Making a lower shape thinner made it flatter.** When the user asks for a thinner piece, change the part they mean (ZÈRTZ: the shell) and keep the overall height.
- **Outline of a raised shape.** Before foreshortening, a shape's top and base are circles. Its outline is the hull of the two: their shared outer tangents, computed on the circles, then each point's y scaled by the tilt. When the top lies within the base, the base ellipse alone is the outline.
- **See-through holes.** Cut the hole out of the shape's path with `fill-rule: evenodd`, using the overlap of the hole's top and bottom openings, which is a lens between their crossing points. Draw the part of the top opening outside that lens as the far inner wall (a crescent), and tint the lens a little for the shadow under a hollow piece.

## Motion seen from the side

Separate every raised piece into a body and a shadow node, so the shadow stays on the board while the body moves.

- **Jumps** arc: the flier moves the ground track, and the body rises about 30 units over the piece it takes, with a slight swell (1.06) in place of the straight-down view's 1.28 swell toward the eye. The shadow slides along the ground track.
- **Landings** rebound along the jump's direction: past the space, back, forward, settled (2.4, −1.2, 0.45, 0 units; 0.07 s each, `sine.inOut`; about 3px past on a desktop screen). The user rejected a vertical bounce here; the rebound reads as the jump's momentum. The user tuned the overshoot down from 5px to 4px to 3px.
- **Pieces leaving the board** float straight up (about 34 units) as they fade, with almost no swell; the shadow shrinks and fades in place.
- **Placements** drop in, as in `animation-lessons.md`, followed by a small wobble (4 units, then 1.5).
- **Undo and history** keep the 0.18 s budget: a quick lift-and-fade for an undone placement, and no landing rebound.

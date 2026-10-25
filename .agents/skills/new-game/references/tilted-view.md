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
- **Landing on a stack** (LYNGK) bounces mostly up and down, lower than a drop, with only a little carry along the hop: the body rises 2.5 units then 0.8, about 0.24 s in all, while the node carries 1 unit along the hop and back. The user found ZÈRTZ's sideways rebound too lateral for a stack landing on a stack.
- **Landing behind a nearer stack.** The flier is drawn above the board so it never passes under the stacks it hops over, which also put it in front of the nearer stack it lands behind. Over the flier, draw a `<use>` copy of every stack, each shown only while that stack's point is nearer the viewer than the flier's ground position, checked in an `onUpdate` every frame until it lands. Leave out the points the flier leaves, hovers over and lands on. Hide the copies with `display: none`, not `visibility`: a `<use>` copy hidden by `visibility` still paints any part of the piece that sets `visibility="visible"` itself, such as a turning marker's (YINSH: a marker flipping behind the ring showed over it).
- **A completed stack leaving** (LYNGK's scored stack) starts its float only after the landing bounce settles; otherwise the stack beneath rises while the top piece is still coming down, and reads as pieces passing through each other. Swap the stack landed on and the flier for one drawing of the whole stack as the float starts: two half-transparent stacks fading together show through each other. Undoing it drops the whole stack back in from above before the moved part hops home.

## Lathe-drawn discs (GIPF)

- **Draw a round piece as a lathe.** A profile gives the radius at each height up the disc (a straight side with rounded fillets top and bottom). Paint about 12 ellipse slices bottom first, each of the profile's radius at its height, so each leaves only its front edge showing. Fill each with a horizontal gradient chosen by which way that slice faces, from 9 shade levels; put the gradients in one `<defs>` per SVG under a prefix (`gipf-board`, `gipf-icon-{id}`), not per piece.
- **Model from a photo and expect corrections.** The user's GIPF corrections, in order: the centre is level with the edge, not sunken; a circular trough runs inset from the edge, and the underside ring nests in the trough below, so a GIPF-piece sits flush; the trough wider and further in, leaving a wider rim; edges less round; the crease between stacked discs comes mostly from a slight rise (the upper disc resting on its ring); pieces a little thicker. A trough seen at the tilt: its opening as an ellipse, the far outer wall as the crescent between the opening and the floor's edge (the opening lowered by the depth), the centre's near wall as a band.
- **Marks on top faces** sit at the top face's height in each piece's own group, after the piece and outside its animated node. **Arrows** lie on the board plane: lay them out in flat coordinates, then scale y by the tilt, and draw them above the pieces so tall stacks in front do not hide them. **Click areas** for a target under a piece: a transparent outline of the tallest piece that could stand there, above the pieces; give pieces with nothing to choose `pointer-events: none`, so clicks reach the dot or target behind.

## Stacked discs (LYNGK)

- **Discs rest on rings.** Each disc stands on its underside ring a gap above the disc below, and the bottom disc stands the same gap above the board, so the crease between discs and the line under every stack read as on the table. LYNGK and GIPF settled on a gap of 0.32 of a disc's thickness, with discs 0.2826 of the radius thick. Under each stack, add a contact shadow: a dark radial gradient filling the stack's footprint, which shows through the gap.
- **Keep the stack height when changing the gap.** When the user asks for a wider crease, thin the discs so a full stack keeps its height, and show both versions side by side: a taller stack covers more of the point behind it.
- **Marks on stacks** go in the stack's outer wrapper, after the stack, outside its animated body: the stack's own wrapper hides them with the stack when it lifts off. Symptom: the ring of a stack in flight hung in the air at its old point for a moment.

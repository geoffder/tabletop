// Cut stone laid in courses, as the temples and the palace are built: blocks of uneven length,
// each face at a slight tilt of its own, pitted and mottled, warmer or cooler, and worn unevenly
// into the joints round it.
import { add, dot, fractal, noise2, scale, type Vec, clamp } from './light.js'
import { seededRandom } from './random.js'
import type { Block } from './templeShape.js'

// Blocks `shortest` to `longest` along a course, courses `row` deep on a top and a block's own
// height on a side; joints `joint` wide; edges worn round over about `round`.
export type Coursing = {
    shortest: number
    longest: number
    row: number
    joint: number
    round: number
}

export type Cut = { tip: Vec; joint: number; tone: number; hue: number }

const mottle = fractal(noise2(97), 4)
const pits = fractal(noise2(113), 3)
const wander = noise2(127)
const chips = noise2(131)

// Where the blocks of one course start, from the left: lengths drawn from its own seed, out to
// `REACH` either side of the middle. Those right of -40 are drawn first and numbered from 0 at
// `first`, so a piece within 40 of its middle keeps its blocks however far the courses reach.
const REACH = 80

type Course = { starts: number[]; first: number }

function blockStarts(seed: number, coursing: Coursing): Course {
    const length = (next: () => number) =>
        coursing.shortest + next() * (coursing.longest - coursing.shortest)
    const next = seededRandom(seed)
    const starts = [-40 - next() * coursing.longest]
    while (starts[starts.length - 1] < REACH) starts.push(starts[starts.length - 1] + length(next))
    const before = seededRandom(seed * 3 + 1)
    let first = 0
    while (starts[0] > -REACH) {
        starts.unshift(starts[0] - length(before))
        first++
    }
    return { starts, first }
}

const COURSES = new Map<string, Course>()

function courseStarts(seed: number, coursing: Coursing): Course {
    const key = `${seed} ${coursing.shortest} ${coursing.longest}`
    let starts = COURSES.get(key)
    if (starts === undefined) {
        starts = blockStarts(seed, coursing)
        COURSES.set(key, starts)
    }
    return starts
}

// Smooth stone, for the faces no course runs across: `tone` its shade between light and dark.
export function smoothStone(p: Vec, tone: number): Cut {
    return {
        tip: [0, 0, 0],
        joint: 0,
        tone: tone + (mottle(p[0] * 0.3, p[2] * 0.3) - 0.5) * 0.25,
        hue: 0
    }
}

// The stone at `p` on `block`, a top or a side or front face; `course` seeds its blocks apart
// from every other block's. Undefined on faces that lie none of those ways.
export function cutStone(
    p: Vec,
    normal: Vec,
    block: Block,
    course0: number,
    coursing: Coursing
): Cut | undefined {
    const onTop = normal[2] > 0.7
    const sideways = Math.abs(normal[0]) > 0.7
    if (!onTop && !sideways && Math.abs(normal[1]) <= 0.7) return undefined
    const uAxis: Vec = sideways ? [0, 1, 0] : [1, 0, 0]
    const vAxis: Vec = onTop ? [0, 1, 0] : [0, 0, 1]
    const u = dot(p, uAxis)
    const v = onTop ? p[1] - block.y0 : p[2] - block.z0
    const courseHeight = onTop ? coursing.row : block.z1 - block.z0
    const course = Math.floor(v / courseHeight)
    const seed = (course0 + 3) * 7919 + course * 131 + (onTop ? 17 : sideways ? 29 : 0)
    const { starts, first } = courseStarts(seed, coursing)
    let index = 0
    while (starts[index + 1] <= u) index++
    const fu = u - starts[index]
    const length = starts[index + 1] - starts[index]
    const fv = v - course * courseHeight
    const draw = seededRandom(seed * 31 + (index - first) * 7 + 1)
    const [r1, r2, r3, r4, r5] = [draw(), draw(), draw(), draw(), draw()]
    const jitter = (wander(u * 0.35 + seed, v * 0.35) - 0.5) * 0.6
    const edges = [fu, length - fu, fv, courseHeight - fv].map((edge) => edge + jitter)
    const toEdge = Math.min(...edges)
    const out = [scale(uAxis, -1), uAxis, scale(vAxis, -1), vAxis][edges.indexOf(toEdge)]
    const chipped = chips(u * 0.3, v * 0.3 + seed) > 0.72 ? 1.8 : 1
    const wear = coursing.round * (0.6 + r3 * 0.9) * chipped
    const roll = toEdge < wear ? (1 - toEdge / wear) ** 2 * 0.85 : 0
    const joint = clamp(1 - (toEdge - coursing.joint / 2) / 0.15)
    const pit = (du: number, dv: number) => pits(u * 0.9 + du, v * 0.9 + seed + dv)
    const pitU = (pit(0.4, 0) - pit(-0.4, 0)) * 1.4
    const pitV = (pit(0, 0.4) - pit(0, -0.4)) * 1.4
    const tilt = add(scale(uAxis, (r1 - 0.5) * 0.16 + pitU), scale(vAxis, (r2 - 0.5) * 0.16 + pitV))
    const tone = 0.08 + r4 * 0.5 + (mottle(u * 0.25, v * 0.25 + seed) - 0.5) * 0.5
    return { tip: add(tilt, scale(out, roll)), joint: joint * 0.9, tone, hue: (r5 - 0.5) * 0.7 }
}

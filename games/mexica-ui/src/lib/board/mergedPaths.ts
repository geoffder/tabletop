import type { Box } from './view.js'

// Many shapes as one path's data, so the board carries one element where it drew one per square:
// every element costs the page its share of each style and layout pass while it opens. Each
// shape is wound the same way, so under the nonzero rule overlaps fill as one shape, and a clip
// path built from them is the same union its separate children made.

export function rectsPath(boxes: readonly Box[]): string {
    return boxes
        .map(({ x, y, width, height }) => `M${x} ${y}h${width}v${height}h${-width}z`)
        .join('')
}

// Shapes given as polygon points ("x,y x,y ...").
export function polygonsPath(shapes: readonly string[]): string {
    return shapes.map((points) => ringPath(clockwise(parsePoints(points)))).join('')
}

type Vertex = [number, number]

function parsePoints(points: string): Vertex[] {
    const numbers = points
        .trim()
        .split(/[\s,]+/)
        .map(Number)
    const vertices: Vertex[] = []
    for (let index = 0; index + 1 < numbers.length; index += 2) {
        vertices.push([numbers[index], numbers[index + 1]])
    }
    return vertices
}

// Clockwise on screen, where y runs down: a positive shoelace sum.
function clockwise(vertices: Vertex[]): Vertex[] {
    let twiceArea = 0
    vertices.forEach(([x, y], index) => {
        const [nextX, nextY] = vertices[(index + 1) % vertices.length]
        twiceArea += x * nextY - nextX * y
    })
    return twiceArea < 0 ? [...vertices].reverse() : vertices
}

function ringPath(vertices: Vertex[]): string {
    return `M${vertices.map(([x, y]) => `${x} ${y}`).join('L')}z`
}

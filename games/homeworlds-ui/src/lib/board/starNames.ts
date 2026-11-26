import { PIECE_COUNT } from '@tabletop/homeworlds'

// Every pyramid has a star's name, used while it stands as a basic star: red giants for the red
// pieces, yellow suns for the yellow, blue-white stars for the blue, and for green, which no star
// is, the stars of the sky's old green tales.
const NAMES = [
    'Antares',
    'Betelgeuse',
    'Aldebaran',
    'Mira',
    'Gacrux',
    'Scheat',
    'Mirach',
    'Menkar',
    'Enif',
    'Capella',
    'Mirfak',
    'Dubhe',
    'Wezen',
    'Sadr',
    'Muphrid',
    'Kochab',
    'Hamal',
    'Alhena',
    'Zuben',
    'Alcor',
    'Mizar',
    'Algol',
    'Thuban',
    'Alkaid',
    'Merak',
    'Phecda',
    'Megrez',
    'Rigel',
    'Spica',
    'Vega',
    'Sirius',
    'Regulus',
    'Bellatrix',
    'Achernar',
    'Alnilam',
    'Deneb'
]

if (NAMES.length !== PIECE_COUNT) throw Error('Every piece needs a star name')

export function starName(piece: number): string {
    return NAMES[piece] ?? 'A star'
}

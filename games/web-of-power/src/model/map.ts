import * as Type from 'typebox'

export enum Country {
    England = 'england',
    Lothringen = 'lothringen',
    Franken = 'franken',
    Bayern = 'bayern',
    Schwaben = 'schwaben',
    Burgund = 'burgund',
    Frankreich = 'frankreich',
    Aragon = 'aragon',
    Italien = 'italien'
}

export const CountrySchema = Type.Enum(Country)

export const COUNTRY_NAMES: Record<Country, string> = {
    [Country.England]: 'England',
    [Country.Lothringen]: 'Lothringen',
    [Country.Franken]: 'Franken',
    [Country.Bayern]: 'Bayern',
    [Country.Schwaben]: 'Schwaben',
    [Country.Burgund]: 'Burgund',
    [Country.Frankreich]: 'Frankreich',
    [Country.Aragon]: 'Aragon',
    [Country.Italien]: 'Italien'
}

// The rulebook scores the countries round the board's edge clockwise from England, then the four
// inside, so none is missed or scored twice.
export const SCORING_ORDER: readonly Country[] = [
    Country.England,
    Country.Franken,
    Country.Bayern,
    Country.Italien,
    Country.Aragon,
    Country.Frankreich,
    Country.Lothringen,
    Country.Schwaben,
    Country.Burgund
]

export enum CardColor {
    FrankenAragon = 'franken-aragon',
    BayernBurgund = 'bayern-burgund',
    LothringenItalien = 'lothringen-italien',
    EnglandSchwaben = 'england-schwaben',
    Frankreich = 'frankreich'
}

export const CardColorSchema = Type.Enum(CardColor)

export const CARD_COUNTRIES: Record<CardColor, readonly Country[]> = {
    [CardColor.FrankenAragon]: [Country.Franken, Country.Aragon],
    [CardColor.BayernBurgund]: [Country.Bayern, Country.Burgund],
    [CardColor.LothringenItalien]: [Country.Lothringen, Country.Italien],
    [CardColor.EnglandSchwaben]: [Country.England, Country.Schwaben],
    [CardColor.Frankreich]: [Country.Frankreich]
}

export const CARD_COUNTS: Record<CardColor, number> = {
    [CardColor.FrankenAragon]: 13,
    [CardColor.BayernBurgund]: 12,
    [CardColor.LothringenItalien]: 11,
    [CardColor.EnglandSchwaben]: 10,
    [CardColor.Frankreich]: 9
}

export function cardColorName(color: CardColor): string {
    return CARD_COUNTRIES[color].map((country) => COUNTRY_NAMES[country]).join('/')
}

export function cardColorOf(country: Country): CardColor {
    const color = Object.values(CardColor).find((candidate) =>
        CARD_COUNTRIES[candidate].includes(country)
    )
    if (color === undefined) throw Error(`No card names ${country}`)
    return color
}

export enum Abbey {
    Whitland = 'whitland',
    Glastonbury = 'glastonbury',
    Ford = 'ford',
    Waverley = 'waverley',
    Kirkstead = 'kirkstead',
    Klaarkamp = 'klaarkamp',
    Nivelles = 'nivelles',
    Loccum = 'loccum',
    Altenberg = 'altenberg',
    Heisterbach = 'heisterbach',
    Reinfeld = 'reinfeld',
    Lehnin = 'lehnin',
    Pforta = 'pforta',
    Ebrach = 'ebrach',
    Chorin = 'chorin',
    Oliva = 'oliva',
    Lekno = 'lekno',
    Leubus = 'leubus',
    Lond = 'lond',
    Waldsassen = 'waldsassen',
    Heiligenkreuz = 'heiligenkreuz',
    Viktring = 'viktring',
    Zirc = 'zirc',
    Eberbach = 'eberbach',
    Maulbronn = 'maulbronn',
    Salem = 'salem',
    Stams = 'stams',
    Morimond = 'morimond',
    Wettingen = 'wettingen',
    Bonmont = 'bonmont',
    Aiguebelle = 'aiguebelle',
    LeThoronet = 'le-thoronet',
    Longpont = 'longpont',
    Savigny = 'savigny',
    LAumone = 'l-aumone',
    Clairvaux = 'clairvaux',
    Molesmes = 'molesmes',
    Bontieu = 'bontieu',
    Sauvelade = 'sauvelade',
    Fontfroide = 'fontfroide',
    LaOliva = 'la-oliva',
    Poblet = 'poblet',
    Veruela = 'veruela',
    Escarp = 'escarp',
    Vallbona = 'vallbona',
    Locedio = 'locedio',
    Fontevivo = 'fontevivo',
    MonteAcuto = 'monte-acuto',
    Arabona = 'arabona',
    SanMartino = 'san-martino',
    Fossanova = 'fossanova'
}

export const AbbeySchema = Type.Enum(Abbey)

export interface CloisterSpace {
    readonly abbey: Abbey
    readonly name: string
    readonly country: Country
}

function spaces(country: Country, entries: [Abbey, string][]): CloisterSpace[] {
    return entries.map(([abbey, name]) => ({ abbey, name, country }))
}

export const SPACES: readonly CloisterSpace[] = [
    ...spaces(Country.England, [
        [Abbey.Whitland, 'Whitland'],
        [Abbey.Glastonbury, 'Glastonbury'],
        [Abbey.Ford, 'Ford'],
        [Abbey.Waverley, 'Waverley'],
        [Abbey.Kirkstead, 'Kirkstead']
    ]),
    ...spaces(Country.Lothringen, [
        [Abbey.Klaarkamp, 'Klaarkamp'],
        [Abbey.Nivelles, 'Nivelles'],
        [Abbey.Loccum, 'Loccum'],
        [Abbey.Altenberg, 'Altenberg'],
        [Abbey.Heisterbach, 'Heisterbach']
    ]),
    ...spaces(Country.Franken, [
        [Abbey.Reinfeld, 'Reinfeld'],
        [Abbey.Lehnin, 'Lehnin'],
        [Abbey.Pforta, 'Pforta'],
        [Abbey.Ebrach, 'Ebrach'],
        [Abbey.Chorin, 'Chorin'],
        [Abbey.Oliva, 'Oliva'],
        [Abbey.Lekno, 'Lekno']
    ]),
    ...spaces(Country.Bayern, [
        [Abbey.Leubus, 'Leubus'],
        [Abbey.Lond, 'Lond'],
        [Abbey.Waldsassen, 'Waldsassen'],
        [Abbey.Heiligenkreuz, 'Heiligenkreuz'],
        [Abbey.Viktring, 'Viktring'],
        [Abbey.Zirc, 'Zirc']
    ]),
    ...spaces(Country.Schwaben, [
        [Abbey.Eberbach, 'Eberbach'],
        [Abbey.Maulbronn, 'Maulbronn'],
        [Abbey.Salem, 'Salem'],
        [Abbey.Stams, 'Stams']
    ]),
    ...spaces(Country.Burgund, [
        [Abbey.Morimond, 'Morimond'],
        [Abbey.Wettingen, 'Wettingen'],
        [Abbey.Bonmont, 'Bonmont'],
        [Abbey.Aiguebelle, 'Aiguebelle'],
        [Abbey.LeThoronet, 'Le Thoronet']
    ]),
    ...spaces(Country.Frankreich, [
        [Abbey.Longpont, 'Longpont'],
        [Abbey.Savigny, 'Savigny'],
        [Abbey.LAumone, "L'Aumône"],
        [Abbey.Clairvaux, 'Clairvaux'],
        [Abbey.Molesmes, 'Molesmes'],
        [Abbey.Bontieu, 'Bontieu'],
        [Abbey.Sauvelade, 'Sauvelade'],
        [Abbey.Fontfroide, 'Fontfroide']
    ]),
    ...spaces(Country.Aragon, [
        [Abbey.LaOliva, 'La Oliva'],
        [Abbey.Poblet, 'Poblet'],
        [Abbey.Veruela, 'Veruela'],
        [Abbey.Escarp, 'Escarp'],
        [Abbey.Vallbona, 'Vallbona']
    ]),
    ...spaces(Country.Italien, [
        [Abbey.Locedio, 'Locedio'],
        [Abbey.Fontevivo, 'Fontevivo'],
        [Abbey.MonteAcuto, 'Monte Acuto'],
        [Abbey.Arabona, 'Arabona'],
        [Abbey.SanMartino, 'San Martino'],
        [Abbey.Fossanova, 'Fossanova']
    ])
]

const SPACE_BY_ABBEY = new Map(SPACES.map((space) => [space.abbey, space]))

export function spaceOf(abbey: Abbey): CloisterSpace {
    const space = SPACE_BY_ABBEY.get(abbey)
    if (space === undefined) throw Error(`Unknown abbey ${String(abbey)}`)
    return space
}

export function spacesIn(country: Country): CloisterSpace[] {
    return SPACES.filter((space) => space.country === country)
}

// Sea routes are not roads.
export const ROADS: readonly (readonly [Abbey, Abbey])[] = [
    [Abbey.Glastonbury, Abbey.Ford],
    [Abbey.Ford, Abbey.Waverley],
    [Abbey.Whitland, Abbey.Waverley],
    [Abbey.Waverley, Abbey.Kirkstead],

    [Abbey.Klaarkamp, Abbey.Nivelles],
    [Abbey.Nivelles, Abbey.Loccum],
    [Abbey.Nivelles, Abbey.Altenberg],
    [Abbey.Altenberg, Abbey.Heisterbach],

    [Abbey.Reinfeld, Abbey.Lehnin],
    [Abbey.Lehnin, Abbey.Pforta],
    [Abbey.Pforta, Abbey.Ebrach],
    [Abbey.Pforta, Abbey.Chorin],
    [Abbey.Chorin, Abbey.Oliva],
    [Abbey.Oliva, Abbey.Lekno],

    [Abbey.Leubus, Abbey.Lond],
    [Abbey.Leubus, Abbey.Waldsassen],
    [Abbey.Waldsassen, Abbey.Heiligenkreuz],
    [Abbey.Heiligenkreuz, Abbey.Viktring],
    [Abbey.Heiligenkreuz, Abbey.Zirc],

    [Abbey.Eberbach, Abbey.Maulbronn],
    [Abbey.Maulbronn, Abbey.Salem],
    [Abbey.Salem, Abbey.Stams],

    [Abbey.Morimond, Abbey.Wettingen],
    [Abbey.Morimond, Abbey.Bonmont],
    [Abbey.Bonmont, Abbey.Aiguebelle],
    [Abbey.Aiguebelle, Abbey.LeThoronet],

    [Abbey.Savigny, Abbey.LAumone],
    [Abbey.LAumone, Abbey.Clairvaux],
    [Abbey.Clairvaux, Abbey.Longpont],
    [Abbey.Clairvaux, Abbey.Molesmes],
    [Abbey.Clairvaux, Abbey.Bontieu],
    [Abbey.Bontieu, Abbey.Sauvelade],

    [Abbey.LaOliva, Abbey.Veruela],
    [Abbey.Poblet, Abbey.Veruela],
    [Abbey.Veruela, Abbey.Escarp],
    [Abbey.Escarp, Abbey.Vallbona],

    [Abbey.Locedio, Abbey.Fontevivo],
    [Abbey.Fontevivo, Abbey.MonteAcuto],
    [Abbey.MonteAcuto, Abbey.Arabona],
    [Abbey.Fontevivo, Abbey.SanMartino],
    [Abbey.SanMartino, Abbey.Arabona],
    [Abbey.SanMartino, Abbey.Fossanova],

    [Abbey.Longpont, Abbey.Nivelles],
    [Abbey.Loccum, Abbey.Lehnin],
    [Abbey.Heisterbach, Abbey.Eberbach],
    [Abbey.Oliva, Abbey.Leubus],
    [Abbey.Molesmes, Abbey.Morimond],
    [Abbey.Wettingen, Abbey.Salem],
    [Abbey.Bonmont, Abbey.Fontfroide],
    [Abbey.Fontfroide, Abbey.Vallbona],
    [Abbey.Sauvelade, Abbey.Vallbona],
    [Abbey.Stams, Abbey.Locedio],
    [Abbey.LeThoronet, Abbey.Locedio],
    [Abbey.Zirc, Abbey.Locedio]
]

const NEIGHBOURS = new Map<Abbey, Abbey[]>(SPACES.map((space) => [space.abbey, []]))
for (const [a, b] of ROADS) {
    NEIGHBOURS.get(a)?.push(b)
    NEIGHBOURS.get(b)?.push(a)
}

export function roadNeighbours(abbey: Abbey): readonly Abbey[] {
    return NEIGHBOURS.get(abbey) ?? []
}

// Scored in this order; alliance n is index n - 1.
export const ALLIANCES: readonly (readonly [Country, Country])[] = [
    [Country.England, Country.Lothringen],
    [Country.England, Country.Frankreich],
    [Country.England, Country.Aragon],
    [Country.Frankreich, Country.Aragon],
    [Country.Aragon, Country.Italien],
    [Country.Frankreich, Country.Italien],
    [Country.Frankreich, Country.Burgund],
    [Country.Frankreich, Country.Lothringen],
    [Country.Lothringen, Country.Franken],
    [Country.Schwaben, Country.Franken],
    [Country.Franken, Country.Bayern],
    [Country.Schwaben, Country.Bayern],
    [Country.Burgund, Country.Schwaben],
    [Country.Italien, Country.Burgund],
    [Country.Italien, Country.Bayern]
]

// Fewer players put cards of every colour back in the box: one each for four, two each for three.
export function deckFor(playerCount: number): CardColor[] {
    const removed = 5 - playerCount
    return Object.values(CardColor).flatMap((color) =>
        Array.from({ length: CARD_COUNTS[color] - removed }, () => color)
    )
}

import { Country } from '@tabletop/web-of-power'

// What advisors keep off on each coat of arms, read from the traced emblems (armsData.ts, a
// 100-unit box): circles round each emblem's key features, a heavier weight for the ones that
// matter most (a face, a head) than for those that matter less (feet, a tail).
export type ArmsFeature = { x: number; y: number; r: number; weight: number }

const feature = (x: number, y: number, r: number, weight = 1): ArmsFeature => ({ x, y, r, weight })

// The cross's arms, as a row of circles along each.
const crossArms = [-40, -30, -20, -10, 10, 20, 30, 40].flatMap((at) => [
    feature(at, 0, 6, 0.4),
    feature(0, at, 6, 0.4)
])

export const ARMS_FEATURES: Record<Country, ArmsFeature[]> = {
    // the rose's heart
    [Country.England]: [feature(0, 8, 15)],
    // the raven's head, then its feet
    [Country.Lothringen]: [feature(-19, -34, 13), feature(5, 30, 11, 0.4)],
    // the griffin's head and raised claws, then its wing
    [Country.Franken]: [feature(-8, -30, 12), feature(-28, -18, 8, 0.5), feature(28, -30, 10, 0.3)],
    // the dragon's head, then its tail's curl
    [Country.Bayern]: [feature(32, -4, 13), feature(-40, -22, 9, 0.4)],
    // the eagle's head, then its body
    [Country.Schwaben]: [feature(0, -32, 11), feature(0, 5, 11, 0.5)],
    // the cross's middle, then its arms
    [Country.Burgund]: [feature(0, 0, 11), ...crossArms],
    // the fleur-de-lis's top petal and band, then its side petals
    [Country.Frankreich]: [
        feature(0, -28, 13),
        feature(0, 12, 10),
        feature(-30, 0, 10, 0.4),
        feature(30, 0, 10, 0.4)
    ],
    // the trident's three tips and its middle
    [Country.Aragon]: [
        feature(0, -36, 8),
        feature(-32, -34, 8, 0.7),
        feature(32, -34, 8, 0.7),
        feature(0, 15, 12, 0.6)
    ],
    // Caesar's face, the whole profile from brow to chin and out to the nose
    [Country.Italien]: [
        feature(-22, -8, 13, 1.5),
        feature(-30, 8, 13, 1.5),
        feature(-24, 26, 12, 1.5),
        feature(-12, 10, 10, 1.5)
    ]
}

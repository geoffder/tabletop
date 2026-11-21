import { Country } from '@tabletop/web-of-power'

// In armsData's 100-unit box; a face or a head weighs more than feet or a tail.
export type ArmsFeature = { x: number; y: number; r: number; weight: number }

const feature = (x: number, y: number, r: number, weight = 1): ArmsFeature => ({ x, y, r, weight })

const crossArms = [-40, -30, -20, -10, 10, 20, 30, 40].flatMap((at) => [
    feature(at, 0, 6, 0.4),
    feature(0, at, 6, 0.4)
])

export const ARMS_FEATURES: Record<Country, ArmsFeature[]> = {
    [Country.England]: [feature(0, 8, 15)],
    [Country.Lothringen]: [feature(-19, -34, 13), feature(5, 30, 11, 0.4)],
    [Country.Franken]: [feature(-8, -30, 12), feature(-28, -18, 8, 0.5), feature(28, -30, 10, 0.3)],
    [Country.Bayern]: [feature(32, -4, 13), feature(-40, -22, 9, 0.4)],
    [Country.Schwaben]: [feature(0, -32, 11), feature(0, 5, 11, 0.5)],
    [Country.Burgund]: [feature(0, 0, 11), ...crossArms],
    [Country.Frankreich]: [
        feature(0, -28, 13),
        feature(0, 12, 10),
        feature(-30, 0, 10, 0.4),
        feature(30, 0, 10, 0.4)
    ],
    [Country.Aragon]: [
        feature(0, -36, 8),
        feature(-32, -34, 8, 0.7),
        feature(32, -34, 8, 0.7),
        feature(0, 15, 12, 0.6)
    ],
    [Country.Italien]: [
        feature(-22, -8, 13, 1.5),
        feature(-30, 8, 13, 1.5),
        feature(-24, 26, 12, 1.5),
        feature(-12, 10, 10, 1.5)
    ]
}

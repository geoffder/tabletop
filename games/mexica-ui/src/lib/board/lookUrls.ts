// Written by scripts/render-looks.mjs: the file of every look, by name.
import canal from '../images/looks/canal.webp'
import lake from '../images/looks/lake.webp'
import paving from '../images/looks/paving.webp'
import pilli from '../images/looks/pilli.webp'
import pilliFlat from '../images/looks/pilli-flat.webp'
import pilliShine from '../images/looks/pilli-shine.webp'
import pilliShineFlat from '../images/looks/pilli-shine-flat.webp'
import shore from '../images/looks/shore.webp'
import slopeCornerNe from '../images/looks/slope-corner-ne.webp'
import slopeCornerNw from '../images/looks/slope-corner-nw.webp'
import slopeCornerSe from '../images/looks/slope-corner-se.webp'
import slopeCornerSw from '../images/looks/slope-corner-sw.webp'
import slopeE from '../images/looks/slope-e.webp'
import slopeN from '../images/looks/slope-n.webp'
import slopeS from '../images/looks/slope-s.webp'
import slopeW from '../images/looks/slope-w.webp'
import spillENAcross0 from '../images/looks/spill-e-n-across-0.webp'
import spillENAcross1 from '../images/looks/spill-e-n-across-1.webp'
import spillENAlong0 from '../images/looks/spill-e-n-along-0.webp'
import spillENAlong1 from '../images/looks/spill-e-n-along-1.webp'
import spillESAcross0 from '../images/looks/spill-e-s-across-0.webp'
import spillESAcross1 from '../images/looks/spill-e-s-across-1.webp'
import spillESAlong0 from '../images/looks/spill-e-s-along-0.webp'
import spillESAlong1 from '../images/looks/spill-e-s-along-1.webp'
import spillNEAcross0 from '../images/looks/spill-n-e-across-0.webp'
import spillNEAcross1 from '../images/looks/spill-n-e-across-1.webp'
import spillNEAlong0 from '../images/looks/spill-n-e-along-0.webp'
import spillNEAlong1 from '../images/looks/spill-n-e-along-1.webp'
import spillNWAcross0 from '../images/looks/spill-n-w-across-0.webp'
import spillNWAcross1 from '../images/looks/spill-n-w-across-1.webp'
import spillNWAlong0 from '../images/looks/spill-n-w-along-0.webp'
import spillNWAlong1 from '../images/looks/spill-n-w-along-1.webp'
import spillSEAcross0 from '../images/looks/spill-s-e-across-0.webp'
import spillSEAcross1 from '../images/looks/spill-s-e-across-1.webp'
import spillSEAlong0 from '../images/looks/spill-s-e-along-0.webp'
import spillSEAlong1 from '../images/looks/spill-s-e-along-1.webp'
import spillSWAcross0 from '../images/looks/spill-s-w-across-0.webp'
import spillSWAcross1 from '../images/looks/spill-s-w-across-1.webp'
import spillSWAlong0 from '../images/looks/spill-s-w-along-0.webp'
import spillSWAlong1 from '../images/looks/spill-s-w-along-1.webp'
import spillWNAcross0 from '../images/looks/spill-w-n-across-0.webp'
import spillWNAcross1 from '../images/looks/spill-w-n-across-1.webp'
import spillWNAlong0 from '../images/looks/spill-w-n-along-0.webp'
import spillWNAlong1 from '../images/looks/spill-w-n-along-1.webp'
import spillWSAcross0 from '../images/looks/spill-w-s-across-0.webp'
import spillWSAcross1 from '../images/looks/spill-w-s-across-1.webp'
import spillWSAlong0 from '../images/looks/spill-w-s-along-0.webp'
import spillWSAlong1 from '../images/looks/spill-w-s-along-1.webp'
import temple1 from '../images/looks/temple-1.webp'
import temple1Flat from '../images/looks/temple-1-flat.webp'
import temple2 from '../images/looks/temple-2.webp'
import temple2Flat from '../images/looks/temple-2-flat.webp'
import temple3 from '../images/looks/temple-3.webp'
import temple3Flat from '../images/looks/temple-3-flat.webp'
import temple4 from '../images/looks/temple-4.webp'
import temple4Flat from '../images/looks/temple-4-flat.webp'

export const LOOK_URLS: Record<string, string> = {
    canal: canal,
    lake: lake,
    paving: paving,
    pilli: pilli,
    'pilli-flat': pilliFlat,
    'pilli-shine': pilliShine,
    'pilli-shine-flat': pilliShineFlat,
    shore: shore,
    'slope-corner-ne': slopeCornerNe,
    'slope-corner-nw': slopeCornerNw,
    'slope-corner-se': slopeCornerSe,
    'slope-corner-sw': slopeCornerSw,
    'slope-e': slopeE,
    'slope-n': slopeN,
    'slope-s': slopeS,
    'slope-w': slopeW,
    'spill-e-n-across-0': spillENAcross0,
    'spill-e-n-across-1': spillENAcross1,
    'spill-e-n-along-0': spillENAlong0,
    'spill-e-n-along-1': spillENAlong1,
    'spill-e-s-across-0': spillESAcross0,
    'spill-e-s-across-1': spillESAcross1,
    'spill-e-s-along-0': spillESAlong0,
    'spill-e-s-along-1': spillESAlong1,
    'spill-n-e-across-0': spillNEAcross0,
    'spill-n-e-across-1': spillNEAcross1,
    'spill-n-e-along-0': spillNEAlong0,
    'spill-n-e-along-1': spillNEAlong1,
    'spill-n-w-across-0': spillNWAcross0,
    'spill-n-w-across-1': spillNWAcross1,
    'spill-n-w-along-0': spillNWAlong0,
    'spill-n-w-along-1': spillNWAlong1,
    'spill-s-e-across-0': spillSEAcross0,
    'spill-s-e-across-1': spillSEAcross1,
    'spill-s-e-along-0': spillSEAlong0,
    'spill-s-e-along-1': spillSEAlong1,
    'spill-s-w-across-0': spillSWAcross0,
    'spill-s-w-across-1': spillSWAcross1,
    'spill-s-w-along-0': spillSWAlong0,
    'spill-s-w-along-1': spillSWAlong1,
    'spill-w-n-across-0': spillWNAcross0,
    'spill-w-n-across-1': spillWNAcross1,
    'spill-w-n-along-0': spillWNAlong0,
    'spill-w-n-along-1': spillWNAlong1,
    'spill-w-s-across-0': spillWSAcross0,
    'spill-w-s-across-1': spillWSAcross1,
    'spill-w-s-along-0': spillWSAlong0,
    'spill-w-s-along-1': spillWSAlong1,
    'temple-1': temple1,
    'temple-1-flat': temple1Flat,
    'temple-2': temple2,
    'temple-2-flat': temple2Flat,
    'temple-3': temple3,
    'temple-3-flat': temple3Flat,
    'temple-4': temple4,
    'temple-4-flat': temple4Flat
}

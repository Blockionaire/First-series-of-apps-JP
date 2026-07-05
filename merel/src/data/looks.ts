import { bundlePrice } from '../lib/format';
import { productById } from './products';

export interface Look {
  id: string;
  name: string;
  name_nl: string;
  items: string[]; // product ids
  blurb: string;
  blurb_nl: string;
}

export const looks: Look[] = [
  {
    id: 'look-alba',
    name: 'The Alba Look',
    name_nl: 'De Alba-look',
    items: ['orchid-arrangement', 'vase-travertine'],
    blurb: 'Our signature orchid arrangement anchored in solid travertine.',
    blurb_nl: 'Ons signatuur-orchideeënarrangement, verankerd in massief travertijn.',
  },
  {
    id: 'look-sera',
    name: 'The Sera Look',
    name_nl: 'De Sera-look',
    items: ['calla-arrangement', 'vase-tall'],
    blurb: 'Falling callas gathered by the tall Linea cylinder.',
    blurb_nl: 'Vallende calla’s, gebundeld door de hoge Linea-cilinder.',
  },
  {
    id: 'look-luce',
    name: 'The Luce Look',
    name_nl: 'De Luce-look',
    items: ['calla-stem', 'vase-glass'],
    blurb: 'One calla in smoked glass. The quietest corner of the house.',
    blurb_nl: 'Eén calla in rookglas. De rustigste hoek van het huis.',
  },
];

export const lookById = (id: string): Look | undefined =>
  looks.find((l) => l.id === id);

export function lookSeparateTotal(look: Look): number {
  return look.items.reduce((sum, id) => sum + (productById(id)?.price ?? 0), 0);
}

export function lookPrice(look: Look): number {
  return bundlePrice(lookSeparateTotal(look));
}

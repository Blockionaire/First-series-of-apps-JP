/**
 * Catalogue. Naming system: vessels carry Italian forms, blooms Italian light.
 * All copy ships in EN + NL. `images` stays empty until real photography
 * lands; the placeholder art system fills every slot until then.
 */
export type Category = 'bouquets' | 'stems' | 'vases';

export interface ColorOption {
  id: string;
  name: string;
  name_nl: string;
  hex: string;
}

export interface Product {
  id: string;
  name: string;
  name_nl: string;
  kind: string;
  kind_nl: string;
  category: Category;
  price: number;
  /** undefined = comfortably in stock; a number = real remaining pieces */
  stock?: number;
  signature?: boolean;
  pairsWith?: string;
  colors?: ColorOption[];
  blurb: string;
  blurb_nl: string;
  description: string;
  description_nl: string;
  dims: string;
  dims_nl: string;
  care: string;
  care_nl: string;
  ship: string;
  ship_nl: string;
  /** Real photography overrides placeholder art when present. */
  images: string[];
  /** 3D model path under /assets/models; absent = fall back to 2D gallery. */
  model?: string;
}

export const ORCHID_COLORS: ColorOption[] = [
  { id: 'ivory', name: 'Ivory', name_nl: 'Ivoor', hex: '#F3EDDF' },
  { id: 'blush', name: 'Blush', name_nl: 'Blush', hex: '#E5C3BC' },
  { id: 'lilac', name: 'Lilac', name_nl: 'Lila', hex: '#C9B6D3' },
];

export const CALLA_COLORS: ColorOption[] = [
  { id: 'ivory', name: 'Ivory', name_nl: 'Ivoor', hex: '#F3EDDF' },
  { id: 'blush', name: 'Blush', name_nl: 'Blush', hex: '#E5C3BC' },
  { id: 'plum', name: 'Plum', name_nl: 'Pruim', hex: '#7E5265' },
];

export const products: Product[] = [
  {
    id: 'orchid-arrangement',
    name: 'Alba',
    name_nl: 'Alba',
    kind: 'Orchid Arrangement',
    kind_nl: 'Orchideeënarrangement',
    category: 'bouquets',
    price: 165,
    stock: 7,
    signature: true,
    pairsWith: 'vase-travertine',
    colors: ORCHID_COLORS,
    blurb: 'A double-stem phalaenopsis composition, arched as if reaching for morning light.',
    blurb_nl: 'Een compositie van twee phalaenopsis-takken, gebogen alsof ze naar het ochtendlicht reiken.',
    description:
      'Alba is our signature orchid arrangement: two hand-shaped phalaenopsis stems with nine blooms each, set in preserved moss. Every petal is cast from a real flower and finished by hand, down to the faint veining and the soft translucence at the edge. It reads as freshly delivered — and stays that way.',
    description_nl:
      'Alba is ons signatuur-orchideeënarrangement: twee met de hand gevormde phalaenopsis-takken met elk negen bloemen, gezet in geconserveerd mos. Elk bloemblad is afgegoten van een echte bloem en met de hand afgewerkt, tot de fijne nerven en de zachte doorschijnendheid aan de rand. Het oogt als vers bezorgd — en blijft zo.',
    dims: 'H 68 cm × W 34 cm · fits vases with an opening of 10–14 cm',
    dims_nl: 'H 68 cm × B 34 cm · past in vazen met een opening van 10–14 cm',
    care: 'Dust monthly with a soft, dry brush or a cool hair-dryer on the lowest setting. Keep out of prolonged direct sunlight to preserve the tint. Never use water or cleaning agents.',
    care_nl: 'Stof maandelijks af met een zachte, droge kwast of een föhn op de koudste stand. Vermijd langdurig direct zonlicht om de tint te behouden. Gebruik nooit water of schoonmaakmiddelen.',
    ship: 'Delivered within 1–3 working days in the Netherlands and Belgium, in protective botanical packaging. Free shipping over €75. Returns within 30 days.',
    ship_nl: 'Binnen 1–3 werkdagen geleverd in Nederland en België, in beschermende botanische verpakking. Gratis verzending vanaf €75. Retourneren binnen 30 dagen.',
    images: [],
    model: 'vase.glb',
  },
  {
    id: 'calla-arrangement',
    name: 'Sera',
    name_nl: 'Sera',
    kind: 'Calla Arrangement',
    kind_nl: 'Calla-arrangement',
    category: 'bouquets',
    price: 155,
    stock: 4,
    signature: true,
    pairsWith: 'vase-tall',
    colors: CALLA_COLORS,
    blurb: 'Seven sculptural calla lilies in a loose, falling curve — evening light, held still.',
    blurb_nl: 'Zeven sculpturale calla’s in een losse, vallende curve — avondlicht, stilgezet.',
    description:
      'Sera gathers seven calla lilies in a composition that looks casually placed and is anything but. Each spadix is hand-tinted, each stem individually wired so the curve holds exactly as our studio set it. The velvet matte of the spathe is the detail people touch to believe.',
    description_nl:
      'Sera bundelt zeven calla’s in een compositie die achteloos geplaatst lijkt en dat allerminst is. Elke bloeikolf is met de hand getint, elke steel afzonderlijk bedraad zodat de curve precies zo blijft als ons atelier hem zette. Het fluweelmatte van het schutblad is het detail dat mensen aanraken om het te geloven.',
    dims: 'H 58 cm × W 30 cm · fits vases with an opening of 8–12 cm',
    dims_nl: 'H 58 cm × B 30 cm · past in vazen met een opening van 8–12 cm',
    care: 'Dust monthly with a soft, dry cloth along the stem. Reshape gently by hand if needed — the wiring is made for it. Keep out of prolonged direct sunlight.',
    care_nl: 'Stof maandelijks af met een zachte, droge doek langs de steel. Vorm zonodig voorzichtig bij met de hand — de bedrading is ervoor gemaakt. Vermijd langdurig direct zonlicht.',
    ship: 'Delivered within 1–3 working days in the Netherlands and Belgium, in protective botanical packaging. Free shipping over €75. Returns within 30 days.',
    ship_nl: 'Binnen 1–3 werkdagen geleverd in Nederland en België, in beschermende botanische verpakking. Gratis verzending vanaf €75. Retourneren binnen 30 dagen.',
    images: [],
  },
  {
    id: 'orchid-stem',
    name: 'Aria',
    name_nl: 'Aria',
    kind: 'Single Orchid Stem',
    kind_nl: 'Losse orchideeëntak',
    category: 'stems',
    price: 38,
    pairsWith: 'vase-glass',
    colors: ORCHID_COLORS,
    blurb: 'One perfect phalaenopsis stem. Quiet on a windowsill, complete on a desk.',
    blurb_nl: 'Eén volmaakte phalaenopsis-tak. Rustig op een vensterbank, compleet op een bureau.',
    description:
      'Aria is a single phalaenopsis stem with seven blooms and two buds, cast from life. It stands on its own in a narrow vase or joins others as your arrangement grows. The stem bends and holds its pose, so the line is always yours to decide.',
    description_nl:
      'Aria is een losse phalaenopsis-tak met zeven bloemen en twee knoppen, afgegoten naar het leven. Hij staat op zichzelf in een smalle vaas of voegt zich bij andere naarmate je arrangement groeit. De tak buigt en houdt zijn houding, dus de lijn bepaal je zelf.',
    dims: 'H 74 cm · single stem',
    dims_nl: 'H 74 cm · losse tak',
    care: 'Dust monthly with a soft, dry brush. Reshape the stem gently by hand. Keep out of prolonged direct sunlight.',
    care_nl: 'Stof maandelijks af met een zachte, droge kwast. Vorm de tak voorzichtig bij met de hand. Vermijd langdurig direct zonlicht.',
    ship: 'Delivered within 1–3 working days in the Netherlands and Belgium. Free shipping over €75. Returns within 30 days.',
    ship_nl: 'Binnen 1–3 werkdagen geleverd in Nederland en België. Gratis verzending vanaf €75. Retourneren binnen 30 dagen.',
    images: [],
  },
  {
    id: 'calla-stem',
    name: 'Luce',
    name_nl: 'Luce',
    kind: 'Single Calla Stem',
    kind_nl: 'Losse calla',
    category: 'stems',
    price: 32,
    stock: 5,
    pairsWith: 'vase-glass',
    colors: CALLA_COLORS,
    blurb: 'A single calla, all line and light. The simplest thing we make.',
    blurb_nl: 'Eén enkele calla, louter lijn en licht. Het eenvoudigste dat we maken.',
    description:
      'Luce is one calla lily, hand-tinted and individually wired. Three of them in a low vase make a still life; one alone is enough. The matte finish takes the light softly, the way the real flower does at dusk.',
    description_nl:
      'Luce is één calla, met de hand getint en afzonderlijk bedraad. Drie stuks in een lage vaas vormen een stilleven; één alleen is genoeg. De matte afwerking vangt het licht zacht, zoals de echte bloem dat doet in de schemer.',
    dims: 'H 64 cm · single stem',
    dims_nl: 'H 64 cm · losse steel',
    care: 'Dust monthly with a soft, dry cloth. Reshape gently by hand. Keep out of prolonged direct sunlight.',
    care_nl: 'Stof maandelijks af met een zachte, droge doek. Vorm voorzichtig bij met de hand. Vermijd langdurig direct zonlicht.',
    ship: 'Delivered within 1–3 working days in the Netherlands and Belgium. Free shipping over €75. Returns within 30 days.',
    ship_nl: 'Binnen 1–3 werkdagen geleverd in Nederland en België. Gratis verzending vanaf €75. Retourneren binnen 30 dagen.',
    images: [],
  },
  {
    id: 'vase-tall',
    name: 'Linea',
    name_nl: 'Linea',
    kind: 'Tall Vase',
    kind_nl: 'Hoge vaas',
    category: 'vases',
    price: 68,
    blurb: 'A tall, narrow ceramic cylinder in warm bone. Made for long stems.',
    blurb_nl: 'Een hoge, smalle keramische cilinder in warm gebroken wit. Gemaakt voor lange stelen.',
    description:
      'Linea is thrown in Portuguese stoneware and glazed in a warm bone tone with a faint eggshell texture. Its narrow mouth gathers long stems into a single confident line. Weighted at the base, so tall arrangements stand safely.',
    description_nl:
      'Linea wordt gedraaid in Portugees steengoed en geglazuurd in een warme bottint met een fijne eierschaalstructuur. De smalle hals bundelt lange stelen in één zelfverzekerde lijn. Verzwaard aan de voet, zodat hoge arrangementen veilig staan.',
    dims: 'H 40 cm × Ø 12 cm · opening Ø 9 cm · stoneware',
    dims_nl: 'H 40 cm × Ø 12 cm · opening Ø 9 cm · steengoed',
    care: 'Wipe with a damp cloth. Watertight, though our botanicals never ask for water.',
    care_nl: 'Afnemen met een vochtige doek. Waterdicht, al vragen onze botanicals nooit om water.',
    ship: 'Delivered within 1–3 working days, double-boxed. Free shipping over €75. Returns within 30 days.',
    ship_nl: 'Binnen 1–3 werkdagen geleverd, dubbel verpakt. Gratis verzending vanaf €75. Retourneren binnen 30 dagen.',
    images: [],
  },
  {
    id: 'vase-round',
    name: 'Onda',
    name_nl: 'Onda',
    kind: 'Rounded Vase',
    kind_nl: 'Ronde vaas',
    category: 'vases',
    price: 72,
    blurb: 'A generous rounded body with a short neck — the calm centre of a table.',
    blurb_nl: 'Een royale ronde buik met een korte hals — het rustpunt van een tafel.',
    description:
      'Onda holds fuller arrangements the way two hands would. The rounded stoneware body is glazed in porcelain white with a soft satin finish; the short neck keeps stems loosely upright without arranging them for you.',
    description_nl:
      'Onda draagt vollere arrangementen zoals twee handen dat zouden doen. De ronde buik van steengoed is geglazuurd in porseleinwit met een zachte satijnglans; de korte hals houdt stelen losjes rechtop zonder ze voor je te schikken.',
    dims: 'H 24 cm × Ø 22 cm · opening Ø 11 cm · stoneware',
    dims_nl: 'H 24 cm × Ø 22 cm · opening Ø 11 cm · steengoed',
    care: 'Wipe with a damp cloth. Watertight, though our botanicals never ask for water.',
    care_nl: 'Afnemen met een vochtige doek. Waterdicht, al vragen onze botanicals nooit om water.',
    ship: 'Delivered within 1–3 working days, double-boxed. Free shipping over €75. Returns within 30 days.',
    ship_nl: 'Binnen 1–3 werkdagen geleverd, dubbel verpakt. Gratis verzending vanaf €75. Retourneren binnen 30 dagen.',
    images: [],
  },
  {
    id: 'vase-travertine',
    name: 'Pietra',
    name_nl: 'Pietra',
    kind: 'Travertine Vase',
    kind_nl: 'Travertijnen vaas',
    category: 'vases',
    price: 95,
    stock: 5,
    blurb: 'Solid travertine, honed matte. Every piece carries its own veining.',
    blurb_nl: 'Massief travertijn, mat gehoond. Elk exemplaar draagt zijn eigen adering.',
    description:
      'Pietra is cut from a single block of Italian travertine and honed to a soft matte. The stone’s open pores and warm veining make each vase one of one. Substantial in the hand and unmoved by tall stems — the natural anchor for Alba.',
    description_nl:
      'Pietra wordt gesneden uit één blok Italiaans travertijn en mat gehoond. De open poriën en warme adering van de steen maken elke vaas uniek. Gewichtig in de hand en onverstoorbaar onder lange takken — het natuurlijke anker voor Alba.',
    dims: 'H 26 cm × Ø 14 cm · opening Ø 10 cm · travertine, ±4.2 kg',
    dims_nl: 'H 26 cm × Ø 14 cm · opening Ø 10 cm · travertijn, ±4,2 kg',
    care: 'Dust with a dry cloth. Natural stone: blot spills promptly and avoid oils and acids.',
    care_nl: 'Afstoffen met een droge doek. Natuursteen: dep gemorst vocht direct en vermijd oliën en zuren.',
    ship: 'Delivered within 1–3 working days, double-boxed with corner protection. Free shipping over €75. Returns within 30 days.',
    ship_nl: 'Binnen 1–3 werkdagen geleverd, dubbel verpakt met hoekbescherming. Gratis verzending vanaf €75. Retourneren binnen 30 dagen.',
    images: [],
  },
  {
    id: 'vase-glass',
    name: 'Velo',
    name_nl: 'Velo',
    kind: 'Glass Vase',
    kind_nl: 'Glazen vaas',
    category: 'vases',
    price: 58,
    blurb: 'Hand-blown smoked glass, thin as a held breath. Lets the stem do the talking.',
    blurb_nl: 'Mondgeblazen rookglas, dun als een ingehouden adem. Laat de steel het woord doen.',
    description:
      'Velo is blown by hand in lightly smoked glass, so the water line you expect is simply not there — and no one notices. The slender profile suits single stems best; the subtle grey warmth keeps it from disappearing entirely.',
    description_nl:
      'Velo wordt met de hand geblazen in licht gerookt glas, zodat de waterlijn die je verwacht er simpelweg niet is — en niemand het merkt. Het slanke profiel past het best bij losse stelen; de subtiele grijze warmte voorkomt dat hij helemaal verdwijnt.',
    dims: 'H 30 cm × Ø 9 cm · opening Ø 6 cm · hand-blown glass',
    dims_nl: 'H 30 cm × Ø 9 cm · opening Ø 6 cm · mondgeblazen glas',
    care: 'Clean with glass cleaner and a lint-free cloth. Hand-blown: small air marks are part of the piece.',
    care_nl: 'Reinigen met glasreiniger en een pluisvrije doek. Mondgeblazen: kleine luchtbelletjes horen bij het stuk.',
    ship: 'Delivered within 1–3 working days, double-boxed. Free shipping over €75. Returns within 30 days.',
    ship_nl: 'Binnen 1–3 werkdagen geleverd, dubbel verpakt. Gratis verzending vanaf €75. Retourneren binnen 30 dagen.',
    images: [],
  },
];

export const productById = (id: string): Product | undefined =>
  products.find((p) => p.id === id);

export function defaultColor(p: Product): ColorOption | undefined {
  return p.colors?.[0];
}

export function colorOf(p: Product, colorId?: string): ColorOption | undefined {
  if (!p.colors) return undefined;
  return p.colors.find((c) => c.id === colorId) ?? p.colors[0];
}

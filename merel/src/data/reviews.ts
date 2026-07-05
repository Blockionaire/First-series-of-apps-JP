/**
 * Seed review data. Every rating shown anywhere in the store is computed
 * from this array — nothing is invented at display time.
 */
export interface Review {
  productId: string;
  name: string;
  location: string;
  rating: 1 | 2 | 3 | 4 | 5;
  date: string; // ISO
  verified: boolean;
  quote: string;
  quote_nl: string;
  photo?: boolean; // renders a customer-photo placeholder tile
}

export const reviews: Review[] = [
  // — Alba (orchid-arrangement)
  { productId: 'orchid-arrangement', name: 'Marloes V.', location: 'Amsterdam', rating: 5, date: '2026-05-28', verified: true, photo: true,
    quote: 'My mother watered it for three weeks before I told her. That is the whole review.',
    quote_nl: 'Mijn moeder heeft hem drie weken water gegeven voordat ik het vertelde. Dat is de hele review.' },
  { productId: 'orchid-arrangement', name: 'Sophie B.', location: 'Utrecht', rating: 5, date: '2026-05-12', verified: true,
    quote: 'The veining in the petals is what convinced me. Guests touch it, without exception.',
    quote_nl: 'De nerven in de bloembladen overtuigden mij. Gasten raken hem aan, zonder uitzondering.' },
  { productId: 'orchid-arrangement', name: 'Jan-Willem K.', location: 'Haarlem', rating: 5, date: '2026-04-30', verified: true,
    quote: 'Bought it for our office reception. Six months in, it still looks like delivery day.',
    quote_nl: 'Gekocht voor onze receptie. Zes maanden later ziet hij er nog uit als op de bezorgdag.' },
  { productId: 'orchid-arrangement', name: 'Claire D.', location: 'Antwerpen', rating: 4, date: '2026-04-18', verified: true,
    quote: 'Beautiful and convincingly real. I would have liked the moss a touch fuller.',
    quote_nl: 'Prachtig en overtuigend echt. Ik had het mos graag iets voller gezien.' },
  { productId: 'orchid-arrangement', name: 'Ingrid M.', location: 'Den Haag', rating: 5, date: '2026-03-29', verified: true, photo: true,
    quote: 'It sits in a north-facing room where every real orchid gave up. Problem quietly solved.',
    quote_nl: 'Hij staat in een kamer op het noorden waar elke echte orchidee het opgaf. Probleem geruisloos opgelost.' },
  { productId: 'orchid-arrangement', name: 'Pieter R.', location: 'Rotterdam', rating: 5, date: '2026-03-10', verified: true,
    quote: 'Gift for my wife. She checked the soil. Twice.',
    quote_nl: 'Cadeau voor mijn vrouw. Ze controleerde de aarde. Twee keer.' },
  { productId: 'orchid-arrangement', name: 'Anouk S.', location: 'Eindhoven', rating: 5, date: '2026-02-21', verified: true,
    quote: 'Exactly the calm the hallway needed. The blush tint is softer in person, in a good way.',
    quote_nl: 'Precies de rust die de hal nodig had. De blush-tint is in het echt zachter, op een goede manier.' },

  // — Sera (calla-arrangement)
  { productId: 'calla-arrangement', name: 'Ellen T.', location: 'Amsterdam', rating: 5, date: '2026-05-20', verified: true, photo: true,
    quote: 'The curve of the stems is genuinely sculptural. It reads as a still life, not a bouquet.',
    quote_nl: 'De curve van de stelen is werkelijk sculpturaal. Het oogt als een stilleven, niet als een boeket.' },
  { productId: 'calla-arrangement', name: 'Bas H.', location: 'Groningen', rating: 5, date: '2026-05-02', verified: true,
    quote: 'I reshaped it once, in about a minute, and it holds. Clever wiring.',
    quote_nl: 'Eén keer bijgevormd, in ongeveer een minuut, en hij blijft staan. Slimme bedrading.' },
  { productId: 'calla-arrangement', name: 'Floor W.', location: 'Leiden', rating: 5, date: '2026-04-11', verified: true,
    quote: 'Plum is the colour. Deep without being dark. The matte finish fools everyone.',
    quote_nl: 'Pruim is dé kleur. Diep zonder donker te zijn. De matte afwerking misleidt iedereen.' },
  { productId: 'calla-arrangement', name: 'Hugo V.', location: 'Breda', rating: 4, date: '2026-03-27', verified: true,
    quote: 'Very fine piece. One stem arrived with a slight bend, easily corrected by hand.',
    quote_nl: 'Zeer fraai stuk. Eén steel kwam met een lichte knik, eenvoudig met de hand gecorrigeerd.' },
  { productId: 'calla-arrangement', name: 'Yasmin A.', location: 'Rotterdam', rating: 5, date: '2026-03-05', verified: true,
    quote: 'Bought after seeing it at a friend’s home. I had held it and still wasn’t sure.',
    quote_nl: 'Gekocht na een bezoek bij een vriendin. Ik had hem vastgehouden en wist het nog steeds niet zeker.' },
  { productId: 'calla-arrangement', name: 'Karin L.', location: 'Zwolle', rating: 5, date: '2026-02-14', verified: true,
    quote: 'The ivory set against our oak table is exactly the photo. Rare, that.',
    quote_nl: 'Het ivoor tegen onze eiken tafel is exact de foto. Zeldzaam, dat.' },

  // — Aria (orchid-stem)
  { productId: 'orchid-stem', name: 'Milan D.', location: 'Utrecht', rating: 5, date: '2026-05-25', verified: true,
    quote: 'One stem, one glass vase, done. My desk finally looks finished.',
    quote_nl: 'Eén tak, één glazen vaas, klaar. Mijn bureau oogt eindelijk af.' },
  { productId: 'orchid-stem', name: 'Renée P.', location: 'Amersfoort', rating: 5, date: '2026-05-01', verified: true, photo: true,
    quote: 'I bought one to test and came back for two more. The buds are the convincing part.',
    quote_nl: 'Eén gekocht om te testen en teruggekomen voor nog twee. De knoppen zijn het overtuigende deel.' },
  { productId: 'orchid-stem', name: 'Tom E.', location: 'Nijmegen', rating: 5, date: '2026-04-08', verified: true,
    quote: 'Sits in the bathroom, zero humidity complaints. Try that with a real one.',
    quote_nl: 'Staat in de badkamer, geen enkele klacht over vocht. Probeer dat met een echte.' },
  { productId: 'orchid-stem', name: 'Lotte J.', location: 'Delft', rating: 4, date: '2026-03-19', verified: true,
    quote: 'Lovely and light-catching. The lilac is slightly cooler in tone than the photo.',
    quote_nl: 'Mooi en licht-vangend. Het lila is iets koeler van toon dan op de foto.' },
  { productId: 'orchid-stem', name: 'Sanne V.', location: 'Arnhem', rating: 5, date: '2026-02-27', verified: true,
    quote: 'Gifted with the Velo vase. The recipient sent me a photo of it every week for a month.',
    quote_nl: 'Cadeau gedaan met de Velo-vaas. De ontvanger stuurde me een maand lang elke week een foto.' },

  // — Luce (calla-stem)
  { productId: 'calla-stem', name: 'Femke R.', location: 'Haarlem', rating: 5, date: '2026-05-15', verified: true,
    quote: 'Three of these in a row on the mantel. Visitors assume a florist comes weekly.',
    quote_nl: 'Drie op een rij op de schouw. Bezoekers denken dat er wekelijks een bloemist komt.' },
  { productId: 'calla-stem', name: 'Daan M.', location: 'Amsterdam', rating: 5, date: '2026-04-22', verified: true, photo: true,
    quote: 'The simplest object in our house and somehow the most looked-at.',
    quote_nl: 'Het eenvoudigste object in ons huis en toch het meest bekeken.' },
  { productId: 'calla-stem', name: 'Nadia K.', location: 'Tilburg', rating: 5, date: '2026-03-30', verified: true,
    quote: 'Bought plum on a whim. It carries the whole windowsill.',
    quote_nl: 'In een opwelling pruim gekocht. Hij draagt de hele vensterbank.' },
  { productId: 'calla-stem', name: 'Rik B.', location: 'Maastricht', rating: 4, date: '2026-03-02', verified: true,
    quote: 'Elegant and true to colour. I would buy a slightly taller version too.',
    quote_nl: 'Elegant en kleurecht. Een iets hogere versie zou ik ook kopen.' },

  // — Linea (vase-tall)
  { productId: 'vase-tall', name: 'Esther G.', location: 'Utrecht', rating: 5, date: '2026-05-09', verified: true,
    quote: 'The glaze has real depth up close. Holds the Sera arrangement rock-steady.',
    quote_nl: 'Het glazuur heeft van dichtbij echte diepte. Houdt het Sera-arrangement muurvast.' },
  { productId: 'vase-tall', name: 'Joris N.', location: 'Den Bosch', rating: 5, date: '2026-04-14', verified: true,
    quote: 'Heavier than expected, in the reassuring way. Nothing wobbles.',
    quote_nl: 'Zwaarder dan verwacht, op de geruststellende manier. Niets wiebelt.' },
  { productId: 'vase-tall', name: 'Vera S.', location: 'Alkmaar', rating: 5, date: '2026-03-21', verified: true,
    quote: 'Beautiful neutral. The bone tone is warmer than my white walls, which took a day to love.',
    quote_nl: 'Prachtig neutraal. De bottint is warmer dan mijn witte muren, waar ik een dag aan moest wennen.' },

  // — Onda (vase-round)
  { productId: 'vase-round', name: 'Hannah W.', location: 'Amsterdam', rating: 5, date: '2026-05-18', verified: true,
    quote: 'The shape does the arranging for you. Even supermarket eucalyptus looks intentional.',
    quote_nl: 'De vorm doet het schikken voor je. Zelfs supermarkt-eucalyptus oogt doordacht.' },
  { productId: 'vase-round', name: 'Olivier F.', location: 'Gent', rating: 5, date: '2026-04-03', verified: true,
    quote: 'Satin finish photographs beautifully. Centre of our dining table since day one.',
    quote_nl: 'De satijnglans fotografeert prachtig. Sinds dag één het middelpunt van onze eettafel.' },
  { productId: 'vase-round', name: 'Mieke H.', location: 'Apeldoorn', rating: 5, date: '2026-03-08', verified: true,
    quote: 'Generous and calm. A second, smaller size would complete the family.',
    quote_nl: 'Royaal en rustig. Een tweede, kleiner formaat zou de familie compleet maken.' },

  // — Pietra (vase-travertine)
  { productId: 'vase-travertine', name: 'Willem O.', location: 'Rotterdam', rating: 5, date: '2026-05-22', verified: true, photo: true,
    quote: 'The veining on mine is exceptional. Feels like it was always in the room.',
    quote_nl: 'De adering op de mijne is uitzonderlijk. Alsof hij altijd al in de kamer stond.' },
  { productId: 'vase-travertine', name: 'Charlotte E.', location: 'Amsterdam', rating: 5, date: '2026-04-26', verified: true,
    quote: 'Bought as the anchor for Alba, as suggested. The pairing is exactly right.',
    quote_nl: 'Gekocht als anker voor Alba, zoals gesuggereerd. De combinatie klopt precies.' },
  { productId: 'vase-travertine', name: 'Stef K.', location: 'Utrecht', rating: 5, date: '2026-03-15', verified: true,
    quote: 'Four kilos of quiet. The single best object on our sideboard.',
    quote_nl: 'Vier kilo rust. Het beste object op ons dressoir.' },

  // — Velo (vase-glass)
  { productId: 'vase-glass', name: 'Isa V.', location: 'Leiden', rating: 5, date: '2026-05-06', verified: true,
    quote: 'The smoked tint is the trick — no waterline, and nobody ever asks.',
    quote_nl: 'De rooktint is de truc — geen waterlijn, en niemand vraagt er ooit naar.' },
  { productId: 'vase-glass', name: 'Ruben Z.', location: 'Haarlem', rating: 5, date: '2026-04-19', verified: true,
    quote: 'So thin it disappears. The stem floats. Lovely object.',
    quote_nl: 'Zo dun dat hij verdwijnt. De steel zweeft. Prachtig object.' },
  { productId: 'vase-glass', name: 'Amber D.', location: 'Groningen', rating: 5, date: '2026-03-24', verified: true,
    quote: 'Came as my free gift and became the reason for my second order.',
    quote_nl: 'Kwam als mijn gratis geschenk en werd de reden voor mijn tweede bestelling.' },
];

export interface RatingSummary {
  count: number;
  average: number; // 0 when no reviews
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export function ratingFor(productId?: string): RatingSummary {
  const set = productId ? reviews.filter((r) => r.productId === productId) : reviews;
  const distribution: RatingSummary['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const r of set) {
    distribution[r.rating]++;
    total += r.rating;
  }
  return {
    count: set.length,
    average: set.length ? Math.round((total / set.length) * 10) / 10 : 0,
    distribution,
  };
}

export function reviewsFor(productId: string): Review[] {
  return reviews
    .filter((r) => r.productId === productId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** The single highest-rated, most recent quote — used for the home pull-quote band. */
export function bestReview(): Review {
  return [...reviews]
    .sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date))[0];
}

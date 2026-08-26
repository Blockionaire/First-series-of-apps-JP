/* =====================================================================
   WIJNKELDER — spijs & wijn
   =====================================================================
   Elk gerecht krijgt een smaakprofiel: hoeveel body het aankan, of het
   tegen tannine kan, of het zuur nodig heeft, en welke druiven of
   regio's er klassiek bij horen. Elke fles in je kelder krijgt datzelfde
   soort profiel, afgeleid van kleur, druiven en regio.

   De match is dus geen opzoeklijstje maar een score. Daardoor krijg je
   ook een zinnig antwoord bij een wijn die nergens in dit bestand staat.
   ===================================================================== */

import { druifInfo } from "./catalog.js";

/* ---------------------------------------------------------------
   Gerechten
   ---------------------------------------------------------------
   kleuren   — welke wijnkleuren passen, met gewicht 0–1
   body      — [ideaal, tolerantie]  (schaal 1–5)
   tannine   — [ideaal, tolerantie]
   zuur      — [ideaal, tolerantie]
   zoet      — [ideaal, tolerantie]
   druiven   — druiven die extra punten opleveren
   regios    — regio's die extra punten opleveren
   --------------------------------------------------------------- */
export const GERECHTEN = [

  /* ------------------------------- Rood vlees ------------------------------ */
  { id: "biefstuk", naam: "Biefstuk / entrecote", groep: "Rood vlees", emoji: "🥩",
    kleuren: { rood: 1, rose: .2 }, body: [4.5, 1.2], tannine: [4.5, 1.3], zuur: [3.5, 1.5], zoet: [0, .8],
    druiven: ["Cabernet Sauvignon", "Malbec", "Syrah", "Merlot", "Tempranillo", "Shiraz (Syrah)"],
    regios: ["Bordeaux", "Ribera del Duero", "Argentinië", "Californië", "Toscane"],
    tip: "Vet en eiwit vragen om tannine: die maakt het vlees zachter in je mond en de wijn ronder." },

  { id: "stoofvlees", naam: "Stoofvlees / draadjesvlees", groep: "Rood vlees", emoji: "🍲",
    kleuren: { rood: 1 }, body: [4, 1.3], tannine: [3.5, 1.5], zuur: [3.5, 1.3], zoet: [0, .8],
    druiven: ["Grenache", "Syrah", "Merlot", "Tempranillo", "Montepulciano", "Negroamaro"],
    regios: ["Zuidelijke Rhône", "Rioja", "Languedoc-Roussillon", "Abruzzo & Marken"],
    tip: "Lang gegaard vlees is zacht — de wijn hoeft niet stoer te zijn, wel warm en rijp." },

  { id: "lam", naam: "Lamsvlees", groep: "Rood vlees", emoji: "🐑",
    kleuren: { rood: 1 }, body: [4, 1.2], tannine: [4, 1.3], zuur: [3.5, 1.3], zoet: [0, .8],
    druiven: ["Cabernet Sauvignon", "Syrah", "Grenache", "Tempranillo", "Merlot", "Sangiovese"],
    regios: ["Bordeaux", "Noordelijke Rhône", "Rioja", "Priorat & Montsant", "Toscane"],
    tip: "Lam met rozemarijn en knoflook is een klassieker bij Rhône en Bordeaux." },

  { id: "wild", naam: "Wild (hert, ree, haas)", groep: "Rood vlees", emoji: "🦌",
    kleuren: { rood: 1 }, body: [4.5, 1.2], tannine: [4, 1.4], zuur: [4, 1.3], zoet: [0, .9],
    druiven: ["Pinot Noir", "Syrah", "Nebbiolo", "Mourvèdre", "Cabernet Franc", "Blaufränkisch"],
    regios: ["Bourgogne", "Noordelijke Rhône", "Piemonte", "Oostenrijk"],
    tip: "Wild vraagt om wijn met wat rijping erin — de aardse, gerijpte tonen zoeken elkaar op." },

  { id: "barbecue", naam: "Barbecue / gegrild vlees", groep: "Rood vlees", emoji: "🔥",
    kleuren: { rood: 1, rose: .4 }, body: [4.5, 1.3], tannine: [3.5, 1.5], zuur: [3, 1.5], zoet: [.5, 1],
    druiven: ["Shiraz (Syrah)", "Zinfandel", "Primitivo", "Malbec", "Monastrell", "Pinotage"],
    regios: ["Australië", "Puglia", "Argentinië", "Zuid-Afrika"],
    tip: "Rook en zoete marinade vragen om een gulle, fruitige wijn met wat alcohol." },

  { id: "hamburger", naam: "Hamburger", groep: "Rood vlees", emoji: "🍔",
    kleuren: { rood: 1, rose: .3 }, body: [4, 1.4], tannine: [3, 1.6], zuur: [3.5, 1.5], zoet: [.5, 1],
    druiven: ["Zinfandel", "Malbec", "Merlot", "Primitivo", "Grenache"],
    regios: ["Californië", "Argentinië", "Puglia"],
    tip: "Sappig en hartig: een fruitige rode zonder al te veel tannine werkt het prettigst." },

  { id: "worst", naam: "Worst / charcuterie", groep: "Rood vlees", emoji: "🥓",
    kleuren: { rood: .9, rose: .7, wit: .4, mousserend: .5 }, body: [3, 1.5], tannine: [2.5, 1.6], zuur: [4, 1.3], zoet: [0, 1],
    druiven: ["Gamay", "Barbera", "Grenache", "Mencía", "Zweigelt", "Cinsault"],
    regios: ["Beaujolais", "Loire", "Piemonte", "Rías Baixas & Galicië"],
    tip: "Zout en vet vragen zuur. Een lichte rode met frisse zuren snijdt er dwars doorheen." },

  /* ------------------------------- Gevogelte ------------------------------- */
  { id: "kip", naam: "Gebraden kip", groep: "Gevogelte", emoji: "🍗",
    kleuren: { wit: 1, rood: .8, rose: .6, mousserend: .5 }, body: [3.5, 1.4], tannine: [2, 1.8], zuur: [3.5, 1.4], zoet: [0, 1],
    druiven: ["Chardonnay", "Pinot Noir", "Viognier", "Grenache Blanc", "Gamay"],
    regios: ["Bourgogne", "Zuidelijke Rhône", "Californië"],
    tip: "Het meest meegaande gerecht dat er is: witte Bourgogne of een lichte rode, allebei goed." },

  { id: "eend", naam: "Eend", groep: "Gevogelte", emoji: "🦆",
    kleuren: { rood: 1, wit: .4 }, body: [4, 1.3], tannine: [3.5, 1.5], zuur: [4, 1.2], zoet: [.5, 1.2],
    druiven: ["Pinot Noir", "Syrah", "Malbec", "Sangiovese", "Nebbiolo"],
    regios: ["Bourgogne", "Zuidwest-Frankrijk", "Noordelijke Rhône", "Piemonte"],
    tip: "Eend met fruitsaus? Dan mag de wijn zelf ook wat rijp fruit hebben." },

  { id: "kalkoen", naam: "Kalkoen / feestgevogelte", groep: "Gevogelte", emoji: "🦃",
    kleuren: { rood: .9, wit: .9, mousserend: .5 }, body: [3.5, 1.4], tannine: [2.5, 1.6], zuur: [3.5, 1.4], zoet: [0, 1],
    druiven: ["Pinot Noir", "Chardonnay", "Grenache", "Riesling"],
    regios: ["Bourgogne", "Elzas", "Oregon & Washington"],
    tip: "Met veel bijgerechten op tafel wint een middelzware wijn die niemand overstemt." },

  /* --------------------------------- Varken -------------------------------- */
  { id: "varken", naam: "Varkenshaas / procureur", groep: "Varken", emoji: "🐖",
    kleuren: { rood: .9, wit: .8, rose: .6 }, body: [3.5, 1.4], tannine: [2.5, 1.6], zuur: [3.5, 1.4], zoet: [.5, 1.2],
    druiven: ["Pinot Noir", "Chenin Blanc", "Riesling", "Grenache", "Barbera"],
    regios: ["Loire", "Elzas", "Bourgogne", "Piemonte"],
    tip: "Varken zit tussen wit en rood in — een witte met body of een lichte rode werken allebei." },

  { id: "spek", naam: "Buikspek / rillette", groep: "Varken", emoji: "🥓",
    kleuren: { wit: .9, rood: .8, mousserend: .7 }, body: [3, 1.5], tannine: [2, 1.7], zuur: [4.5, 1.1], zoet: [.5, 1.2],
    druiven: ["Chenin Blanc", "Riesling", "Gamay", "Sauvignon Blanc"],
    regios: ["Loire", "Mosel", "Beaujolais"],
    tip: "Vet schreeuwt om zuur. Een Vouvray of droge Riesling maakt het gerecht lichter." },

  /* ----------------------------------- Vis --------------------------------- */
  { id: "witvis", naam: "Witte vis (kabeljauw, tong)", groep: "Vis", emoji: "🐟",
    kleuren: { wit: 1, mousserend: .7, rose: .4 }, body: [2.5, 1.3], tannine: [0, .6], zuur: [4, 1.2], zoet: [0, .8],
    druiven: ["Sauvignon Blanc", "Albariño", "Chablis", "Melon de Bourgogne", "Picpoul", "Vermentino", "Assyrtiko"],
    regios: ["Loire", "Bourgogne", "Rías Baixas & Galicië", "Griekenland"],
    tip: "Hoe delicater de vis, hoe rustiger de wijn. Geen hout, wel spanning." },

  { id: "vettevis", naam: "Vette vis (zalm, tonijn)", groep: "Vis", emoji: "🍣",
    kleuren: { wit: 1, rose: .8, rood: .5, mousserend: .5 }, body: [3.5, 1.3], tannine: [1, 1.4], zuur: [4, 1.2], zoet: [0, 1],
    druiven: ["Chardonnay", "Pinot Noir", "Pinot Gris", "Viognier", "Grüner Veltliner"],
    regios: ["Bourgogne", "Oregon & Washington", "Elzas"],
    tip: "Zalm kan tegen een lichte rode — de enige vis waar Pinot Noir echt bij kan." },

  { id: "schaaldieren", naam: "Schaal- en schelpdieren", groep: "Vis", emoji: "🦐",
    kleuren: { wit: 1, mousserend: .9, rose: .4 }, body: [2.5, 1.2], tannine: [0, .5], zuur: [4.5, 1.1], zoet: [0, .8],
    druiven: ["Muscadet", "Melon de Bourgogne", "Albariño", "Chablis", "Picpoul", "Xarel·lo", "Assyrtiko"],
    regios: ["Loire", "Bourgogne", "Rías Baixas & Galicië", "Penedès & Cava", "Champagne"],
    tip: "Oesters en Muscadet, of oesters en Champagne. Zout tegen zuur, altijd goed." },

  { id: "gerookt", naam: "Gerookte vis", groep: "Vis", emoji: "🐠",
    kleuren: { wit: 1, mousserend: .8 }, body: [3, 1.3], tannine: [0, .6], zuur: [4.5, 1.1], zoet: [1, 1.3],
    druiven: ["Riesling", "Grüner Veltliner", "Chenin Blanc", "Gewürztraminer"],
    regios: ["Mosel", "Oostenrijk", "Elzas", "Champagne"],
    tip: "Rook en een vleugje restzoet in de wijn is een verrassend sterke combinatie." },

  { id: "vissoep", naam: "Vissoep / bouillabaisse", groep: "Vis", emoji: "🥣",
    kleuren: { wit: 1, rose: .9 }, body: [3, 1.3], tannine: [0, .7], zuur: [4, 1.2], zoet: [0, .9],
    druiven: ["Rolle (Vermentino)", "Grenache Blanc", "Clairette", "Marsanne", "Roussanne"],
    regios: ["Provence", "Zuidelijke Rhône", "Languedoc-Roussillon"],
    tip: "Zuid-Franse soep, Zuid-Franse wijn. Een stevige rosé uit Provence is ideaal." },

  /* --------------------------------- Pasta --------------------------------- */
  { id: "pasta-tomaat", naam: "Pasta met tomatensaus", groep: "Pasta & rijst", emoji: "🍝",
    kleuren: { rood: 1, rose: .5 }, body: [3, 1.4], tannine: [2.5, 1.5], zuur: [4.5, 1], zoet: [0, .9],
    druiven: ["Sangiovese", "Barbera", "Montepulciano", "Nero d'Avola", "Primitivo"],
    regios: ["Toscane", "Piemonte", "Abruzzo & Marken", "Sicilië"],
    tip: "Tomaat is zuur. Een wijn met minder zuur smaakt daarnaast meteen slap — dus Italiaans." },

  { id: "pasta-room", naam: "Pasta met roomsaus", groep: "Pasta & rijst", emoji: "🧀",
    kleuren: { wit: 1, mousserend: .5 }, body: [3.5, 1.3], tannine: [0, .7], zuur: [4, 1.2], zoet: [0, .9],
    druiven: ["Chardonnay", "Verdicchio", "Pinot Bianco", "Soave", "Garganega"],
    regios: ["Bourgogne", "Veneto", "Abruzzo & Marken", "Trentino-Alto Adige"],
    tip: "Room vraagt zuur als tegenwicht, anders wordt het geheel te vullend." },

  { id: "ragu", naam: "Pasta met ragù / lasagne", groep: "Pasta & rijst", emoji: "🍲",
    kleuren: { rood: 1 }, body: [3.5, 1.3], tannine: [3, 1.5], zuur: [4.5, 1.1], zoet: [0, .9],
    druiven: ["Sangiovese", "Barbera", "Nebbiolo", "Montepulciano", "Aglianico"],
    regios: ["Toscane", "Piemonte", "Umbrië & Lazio", "Campanië"],
    tip: "Een Chianti Classico bij lasagne is een cliché omdat het gewoon klopt." },

  { id: "risotto", naam: "Risotto", groep: "Pasta & rijst", emoji: "🍚",
    kleuren: { wit: 1, rood: .5, mousserend: .5 }, body: [3.5, 1.3], tannine: [1, 1.3], zuur: [4, 1.2], zoet: [0, .9],
    druiven: ["Chardonnay", "Arneis", "Cortese", "Garganega", "Pinot Bianco"],
    regios: ["Piemonte", "Veneto", "Bourgogne", "Trentino-Alto Adige"],
    tip: "Paddenstoelenrisotto kan ook prima tegen een lichte Nebbiolo." },

  { id: "pizza", naam: "Pizza", groep: "Pasta & rijst", emoji: "🍕",
    kleuren: { rood: 1, rose: .6, mousserend: .4 }, body: [3, 1.5], tannine: [2.5, 1.6], zuur: [4.5, 1.1], zoet: [0, 1],
    druiven: ["Sangiovese", "Montepulciano", "Barbera", "Primitivo", "Frappato"],
    regios: ["Toscane", "Abruzzo & Marken", "Campanië", "Sicilië"],
    tip: "Geen fles om lang over na te denken — fris, rood en Italiaans is genoeg." },

  /* ------------------------------ Vegetarisch ------------------------------ */
  { id: "salade", naam: "Frisse salade", groep: "Vegetarisch", emoji: "🥗",
    kleuren: { wit: 1, rose: .8, mousserend: .6 }, body: [2, 1.2], tannine: [0, .6], zuur: [4.5, 1.1], zoet: [0, .8],
    druiven: ["Sauvignon Blanc", "Grüner Veltliner", "Vermentino", "Pinot Grigio", "Verdejo"],
    regios: ["Loire", "Oostenrijk", "Nieuw-Zeeland", "Provence"],
    tip: "Let op de dressing: hoe zuurder die is, hoe frisser de wijn moet zijn." },

  { id: "groente-geroosterd", naam: "Geroosterde groenten", groep: "Vegetarisch", emoji: "🍆",
    kleuren: { rood: .8, wit: .9, rose: .8, oranje: .8 }, body: [3, 1.4], tannine: [2, 1.6], zuur: [3.5, 1.4], zoet: [0, 1],
    druiven: ["Grenache", "Syrah", "Vermentino", "Chenin Blanc", "Sangiovese"],
    regios: ["Zuidelijke Rhône", "Provence", "Languedoc-Roussillon", "Sicilië"],
    tip: "Roosteren maakt groente zoet en rokerig — daar mag een wijn met wat kruidigheid bij." },

  { id: "paddenstoelen", naam: "Paddenstoelen / truffel", groep: "Vegetarisch", emoji: "🍄",
    kleuren: { rood: 1, wit: .7, oranje: .6 }, body: [3.5, 1.3], tannine: [3, 1.5], zuur: [4, 1.2], zoet: [0, .9],
    druiven: ["Nebbiolo", "Pinot Noir", "Sangiovese", "Chardonnay", "Savagnin"],
    regios: ["Piemonte", "Bourgogne", "Jura & Savoie"],
    tip: "Aards zoekt aards. Een gerijpte Barolo bij truffel is niet te verbeteren." },

  { id: "quiche", naam: "Quiche / hartige taart", groep: "Vegetarisch", emoji: "🥧",
    kleuren: { wit: 1, rose: .7, mousserend: .6, rood: .5 }, body: [3, 1.4], tannine: [1, 1.4], zuur: [4, 1.2], zoet: [0, 1],
    druiven: ["Pinot Blanc", "Chenin Blanc", "Chardonnay", "Riesling", "Sylvaner"],
    regios: ["Elzas", "Loire", "Bourgogne"],
    tip: "Een Elzasser Pinot Blanc is hier bijna het standaardantwoord." },

  { id: "peulvruchten", naam: "Linzen / bonen / kikkererwten", groep: "Vegetarisch", emoji: "🫘",
    kleuren: { rood: .9, wit: .8, rose: .6, oranje: .6 }, body: [3, 1.4], tannine: [2.5, 1.6], zuur: [4, 1.3], zoet: [0, .9],
    druiven: ["Sangiovese", "Grenache", "Mencía", "Godello", "Xinomavro"],
    regios: ["Toscane", "Rías Baixas & Galicië", "Griekenland", "Languedoc-Roussillon"],
    tip: "Aardse peulvruchten houden van wijn met een kruidige, wat rustieke inslag." },

  /* --------------------------------- Aziatisch ----------------------------- */
  { id: "sushi", naam: "Sushi / sashimi", groep: "Aziatisch", emoji: "🍱",
    kleuren: { wit: 1, mousserend: .9, rose: .5 }, body: [2, 1.2], tannine: [0, .5], zuur: [4.5, 1.1], zoet: [.5, 1.1],
    druiven: ["Riesling", "Grüner Veltliner", "Albariño", "Chablis", "Assyrtiko"],
    regios: ["Mosel", "Oostenrijk", "Champagne", "Rías Baixas & Galicië"],
    tip: "Wasabi en gember vragen om een wijn met een klein beetje restzoet als buffer." },

  { id: "thais", naam: "Thais / Vietnamees", groep: "Aziatisch", emoji: "🍜",
    kleuren: { wit: 1, rose: .8, mousserend: .6 }, body: [2.5, 1.3], tannine: [0, .7], zuur: [4, 1.3], zoet: [2, 1.2],
    druiven: ["Riesling", "Gewürztraminer", "Pinot Gris", "Torrontés", "Moschofilero"],
    regios: ["Mosel", "Elzas", "Argentinië", "Rheingau & Pfalz"],
    tip: "Pittig plus zoet: een halfdroge Riesling koelt de hitte en houdt de wijn overeind." },

  { id: "curry", naam: "Indiase curry", groep: "Aziatisch", emoji: "🍛",
    kleuren: { wit: .9, rose: .8, rood: .6 }, body: [3, 1.4], tannine: [1, 1.3], zuur: [3.5, 1.4], zoet: [2, 1.3],
    druiven: ["Gewürztraminer", "Riesling", "Viognier", "Grenache", "Pinot Gris"],
    regios: ["Elzas", "Mosel", "Zuidelijke Rhône"],
    tip: "Vermijd stevige tannine: die maakt pittig eten alleen maar scherper." },

  { id: "chinees", naam: "Chinees / wok", groep: "Aziatisch", emoji: "🥡",
    kleuren: { wit: .9, rose: .8, rood: .7, mousserend: .6 }, body: [3, 1.4], tannine: [1.5, 1.4], zuur: [4, 1.3], zoet: [1.5, 1.3],
    druiven: ["Riesling", "Pinot Gris", "Gamay", "Pinot Noir", "Chenin Blanc"],
    regios: ["Elzas", "Beaujolais", "Loire"],
    tip: "Zoetzuur in het gerecht wil zuur én een beetje zoet in het glas." },

  /* ---------------------------------- Kaas --------------------------------- */
  { id: "kaas-hard", naam: "Oude/harde kaas", groep: "Kaas", emoji: "🧀",
    kleuren: { rood: 1, wit: .6, versterkt: .8 }, body: [4, 1.3], tannine: [3.5, 1.5], zuur: [3.5, 1.4], zoet: [.5, 1.3],
    druiven: ["Cabernet Sauvignon", "Tempranillo", "Nebbiolo", "Touriga Nacional", "Syrah"],
    regios: ["Bordeaux", "Rioja", "Piemonte", "Douro & Porto"],
    tip: "Oude Gouda en een tawny port is een van de beste combinaties die er bestaan." },

  { id: "kaas-zacht", naam: "Brie / camembert", groep: "Kaas", emoji: "🧈",
    kleuren: { wit: 1, mousserend: .9, rood: .4 }, body: [3, 1.3], tannine: [.5, 1], zuur: [4.5, 1.1], zoet: [.5, 1.2],
    druiven: ["Chardonnay", "Chenin Blanc", "Sauvignon Blanc", "Pinot Meunier"],
    regios: ["Champagne", "Bourgogne", "Loire"],
    tip: "Brie en Champagne: de bubbels vegen het vet weg en zetten de kaas weer aan." },

  { id: "kaas-blauw", naam: "Blauwe kaas", groep: "Kaas", emoji: "🫕",
    kleuren: { zoet: 1, versterkt: 1, rood: .4, wit: .4 }, body: [4, 1.4], tannine: [1, 1.3], zuur: [3.5, 1.5], zoet: [4, 1.2],
    druiven: ["Sémillon", "Pedro Ximénez", "Touriga Nacional", "Riesling", "Furmint"],
    regios: ["Bordeaux", "Douro & Porto", "Hongarije", "Zuidwest-Frankrijk"],
    tip: "Zout tegen zoet. Roquefort met Sauternes, Stilton met port — beide onverslaanbaar." },

  { id: "kaas-geit", naam: "Geitenkaas", groep: "Kaas", emoji: "🐐",
    kleuren: { wit: 1, rose: .6, mousserend: .5 }, body: [2.5, 1.2], tannine: [0, .6], zuur: [5, 1], zoet: [0, .9],
    druiven: ["Sauvignon Blanc", "Chenin Blanc", "Melon de Bourgogne"],
    regios: ["Loire", "Nieuw-Zeeland"],
    tip: "Sancerre bij crottin de Chavignol — dezelfde streek, en dat proef je." },

  /* -------------------------------- Dessert -------------------------------- */
  { id: "chocolade", naam: "Chocoladedessert", groep: "Dessert", emoji: "🍫",
    kleuren: { versterkt: 1, zoet: .9, rood: .5 }, body: [4.5, 1.2], tannine: [2, 1.5], zuur: [2.5, 1.5], zoet: [4, 1.2],
    druiven: ["Touriga Nacional", "Pedro Ximénez", "Grenache", "Zinfandel"],
    regios: ["Douro & Porto", "Jerez", "Languedoc-Roussillon"],
    tip: "De wijn moet altijd zoeter zijn dan het dessert, anders smaakt hij zuur." },

  { id: "fruittaart", naam: "Fruittaart / appeltaart", groep: "Dessert", emoji: "🥮",
    kleuren: { zoet: 1, mousserend: .7, wit: .5 }, body: [3, 1.3], tannine: [0, .7], zuur: [4, 1.3], zoet: [4, 1.2],
    druiven: ["Riesling", "Chenin Blanc", "Moscato", "Furmint", "Sémillon"],
    regios: ["Mosel", "Loire", "Hongarije", "Elzas"],
    tip: "Een Coteaux du Layon of een Auslese: zoet, maar met genoeg zuur om fris te blijven." },

  { id: "creme", naam: "Crème brûlée / custard", groep: "Dessert", emoji: "🍮",
    kleuren: { zoet: 1, versterkt: .8 }, body: [4, 1.3], tannine: [0, .8], zuur: [3.5, 1.4], zoet: [4.5, 1.1],
    druiven: ["Sémillon", "Pedro Ximénez", "Muscat", "Petit Manseng"],
    regios: ["Bordeaux", "Jerez", "Zuidwest-Frankrijk"],
    tip: "Karamel zoekt karamel: Sauternes of een oude PX doet het werk." },

  { id: "ijs", naam: "IJs / sorbet", groep: "Dessert", emoji: "🍨",
    kleuren: { mousserend: 1, zoet: .9 }, body: [2.5, 1.3], tannine: [0, .6], zuur: [4, 1.3], zoet: [4, 1.2],
    druiven: ["Moscato", "Glera", "Muscat", "Zibibbo"],
    regios: ["Piemonte", "Veneto", "Sicilië"],
    tip: "Moscato d'Asti bij ijs — laag in alcohol, hoog in plezier." },

  /* --------------------------------- Borrel -------------------------------- */
  { id: "aperitief", naam: "Aperitief / borrelhapjes", groep: "Borrel", emoji: "🫒",
    kleuren: { mousserend: 1, wit: .9, rose: .8, versterkt: .6 }, body: [2.5, 1.3], tannine: [0, .7], zuur: [4.5, 1.1], zoet: [0, 1],
    druiven: ["Chardonnay", "Pinot Noir", "Xarel·lo", "Albariño", "Palomino"],
    regios: ["Champagne", "Penedès & Cava", "Jerez", "Provence"],
    tip: "Een droge fino sherry bij olijven en amandelen is Spaanser dan Spanje zelf." },

  { id: "noten", naam: "Noten / oude kaas bij de borrel", groep: "Borrel", emoji: "🥜",
    kleuren: { versterkt: 1, wit: .7, mousserend: .5 }, body: [3.5, 1.4], tannine: [1, 1.4], zuur: [3.5, 1.5], zoet: [1.5, 1.5],
    druiven: ["Palomino", "Savagnin", "Chardonnay", "Verdelho"],
    regios: ["Jerez", "Jura & Savoie", "Overig Portugal"],
    tip: "Amontillado en walnoten: allebei nootachtig, en ze versterken elkaar." },

  { id: "friet", naam: "Friet / gefrituurd", groep: "Borrel", emoji: "🍟",
    kleuren: { mousserend: 1, wit: .8, rose: .7 }, body: [2.5, 1.3], tannine: [0, .8], zuur: [5, 1], zoet: [0, 1],
    druiven: ["Glera", "Chardonnay", "Xarel·lo", "Verdejo", "Picpoul"],
    regios: ["Champagne", "Penedès & Cava", "Veneto"],
    tip: "Bubbels en frituur. Het klinkt gek en het werkt fantastisch." },

  /* --------------------------------- Overig -------------------------------- */
  { id: "soep", naam: "Soep", groep: "Overig", emoji: "🍜",
    kleuren: { wit: .9, rose: .7, rood: .6, versterkt: .5 }, body: [2.5, 1.4], tannine: [1, 1.5], zuur: [4, 1.3], zoet: [0, 1],
    druiven: ["Chardonnay", "Grüner Veltliner", "Palomino", "Grenache"],
    regios: ["Bourgogne", "Oostenrijk", "Jerez"],
    tip: "Bij een romige soep werkt een droge sherry beter dan je zou denken." },

  { id: "ei", naam: "Eiergerechten", groep: "Overig", emoji: "🍳",
    kleuren: { wit: 1, mousserend: .8, rood: .4 }, body: [2.5, 1.3], tannine: [.5, 1], zuur: [4, 1.2], zoet: [0, .9],
    druiven: ["Chardonnay", "Pinot Blanc", "Chenin Blanc", "Gamay"],
    regios: ["Bourgogne", "Elzas", "Beaujolais"],
    tip: "Oeufs en meurette met rode Bourgogne — een van de weinige eierklassiekers met rood." },

  { id: "kruidig", naam: "Kruidig / veel specerijen", groep: "Overig", emoji: "🌶️",
    kleuren: { wit: .9, rose: .9, rood: .7 }, body: [3, 1.4], tannine: [1, 1.3], zuur: [4, 1.3], zoet: [2, 1.3],
    druiven: ["Gewürztraminer", "Riesling", "Viognier", "Grenache", "Zinfandel"],
    regios: ["Elzas", "Mosel", "Zuidelijke Rhône"],
    tip: "Alcohol versterkt de scherpte van pepers. Kies liever een wijn met wat minder alcohol." },

  { id: "vega-burger", naam: "Vegetarische burger / tofu", groep: "Vegetarisch", emoji: "🌱",
    kleuren: { rood: .8, wit: .8, rose: .7 }, body: [3, 1.5], tannine: [2, 1.6], zuur: [4, 1.3], zoet: [0, 1],
    druiven: ["Gamay", "Pinot Noir", "Grenache", "Chenin Blanc"],
    regios: ["Beaujolais", "Loire", "Zuidelijke Rhône"],
    tip: "Kijk vooral naar de saus en de kruiding — die bepalen meer dan het eiwit zelf." },
];

export const GERECHT_GROEPEN = [...new Set(GERECHTEN.map(g => g.groep))];

/* ---------------------------------------------------------------
   Gelegenheden — het tweede filter naast het gerecht
   --------------------------------------------------------------- */
export const GELEGENHEDEN = [
  { id: "alles",      naam: "Maakt niet uit",      emoji: "🍷", uitleg: "Alles in de kelder mag meedoen." },
  { id: "doordeweeks", naam: "Doordeweekse avond", emoji: "🏠", uitleg: "Toegankelijke flessen die je zonder spijt opentrekt.",
    filter: f => (waardePerFles(f) || 0) <= 20 },
  { id: "gasten",     naam: "Gasten aan tafel",    emoji: "👥", uitleg: "Flessen die indruk maken zonder je beste te zijn.",
    filter: f => { const w = waardePerFles(f) || 0; return w > 15 && w <= 60; } },
  { id: "feest",      naam: "Speciale gelegenheid", emoji: "🎉", uitleg: "De flessen waar je op gewacht hebt.",
    filter: f => (waardePerFles(f) || 0) > 45 },
  { id: "opdrinken",  naam: "Moet nu open",         emoji: "⏳", uitleg: "Flessen die niet langer kunnen wachten." },
];

function waardePerFles(f) {
  return Number(f.huidigeWaarde) || Number(f.aankoopPrijs) || 0;
}

/* ---------------------------------------------------------------
   Het smaakprofiel van een fles
   --------------------------------------------------------------- */
const KLEUR_BASIS = {
  rood:       { tannine: 3.5, zuur: 3.5, body: 3.5, zoet: 0 },
  wit:        { tannine: 0,   zuur: 4,   body: 2.5, zoet: 0.5 },
  rose:       { tannine: 0.5, zuur: 4,   body: 2,   zoet: 0.5 },
  mousserend: { tannine: 0.5, zuur: 4.5, body: 2.5, zoet: 1 },
  zoet:       { tannine: 0.5, zuur: 3.5, body: 3.5, zoet: 4.5 },
  versterkt:  { tannine: 1.5, zuur: 3,   body: 4.5, zoet: 3 },
  oranje:     { tannine: 2.5, zuur: 4,   body: 3,   zoet: 0 },
};

export function wijnProfiel(fles) {
  const basis = KLEUR_BASIS[fles.kleur] || KLEUR_BASIS.rood;
  const infos = (fles.druiven || []).map(druifInfo).filter(Boolean);

  if (!infos.length) return { ...basis };

  const gem = sleutel => infos.reduce((a, d) => a + d[sleutel], 0) / infos.length;
  const uitDruif = { tannine: gem("tannine"), zuur: gem("zuur"), body: gem("body"), zoet: gem("zoet") };

  /* Kleur en druif tellen allebei mee: een Pinot Noir uit een warm land
     is voller dan de druif alleen zou doen vermoeden, en andersom. */
  const meng = s => uitDruif[s] * 0.65 + basis[s] * 0.35;
  const p = { tannine: meng("tannine"), zuur: meng("zuur"), body: meng("body"), zoet: meng("zoet") };

  /* Bij zoete en versterkte wijnen is de kleur bepalender dan de druif. */
  if (fles.kleur === "zoet" || fles.kleur === "versterkt") {
    p.zoet = Math.max(p.zoet, basis.zoet);
    p.body = Math.max(p.body, basis.body);
  }
  return p;
}

/* ---------------------------------------------------------------
   De score: hoe goed past deze fles bij dit gerecht? (0–100)
   --------------------------------------------------------------- */
export function scoreCombinatie(fles, gerecht) {
  const p = wijnProfiel(fles);

  /* 1. Kleur — een mismatch hier weegt het zwaarst. */
  const kleurGewicht = gerecht.kleuren[fles.kleur] ?? 0.15;
  let score = kleurGewicht * 42;

  /* 2. Smaakassen — hoe dichter bij het ideaal, hoe meer punten.
        De tolerantie bepaalt hoe streng een as is. */
  const as = (waarde, [ideaal, tolerantie], punten) => {
    const afstand = Math.abs(waarde - ideaal) / tolerantie;
    return Math.max(0, 1 - afstand / 3) * punten;
  };
  score += as(p.body,    gerecht.body,    14);
  score += as(p.tannine, gerecht.tannine, 14);
  score += as(p.zuur,    gerecht.zuur,    12);
  score += as(p.zoet,    gerecht.zoet,    10);

  /* 3. Klassieke combinaties — de streekgenoten en de vaste druiven. */
  const druivenLaag = (fles.druiven || []).map(d => d.toLowerCase());
  const raak = gerecht.druiven.some(d =>
    druivenLaag.some(x => x.includes(d.toLowerCase()) || d.toLowerCase().includes(x)));
  if (raak) score += 8;

  if (gerecht.regios.includes(fles.regio)) score += 6;

  /* 4. Een wijn die nog niet klaar is, is geen goed voorstel voor vanavond. */
  return { score: Math.max(0, Math.min(100, Math.round(score))), klassiek: raak };
}

/* Waarom past dit? Een paar korte zinnen onder het voorstel. */
export function combinatieRedenen(fles, gerecht) {
  const p = wijnProfiel(fles);
  const redenen = [];

  if ((gerecht.kleuren[fles.kleur] ?? 0) >= 0.9) redenen.push("de kleur past bij dit gerecht");
  if (gerecht.regios.includes(fles.regio)) redenen.push(`${fles.regio} is hier een klassieke keuze`);

  const druivenLaag = (fles.druiven || []).map(d => d.toLowerCase());
  const match = gerecht.druiven.find(d =>
    druivenLaag.some(x => x.includes(d.toLowerCase()) || d.toLowerCase().includes(x)));
  if (match) redenen.push(`${match} hoort hier van oudsher bij`);

  if (Math.abs(p.body - gerecht.body[0]) < 0.8) redenen.push("de body sluit goed aan");
  if (p.zuur >= 4 && gerecht.zuur[0] >= 4)      redenen.push("het frisse zuur snijdt door het gerecht heen");
  if (p.tannine >= 4 && gerecht.tannine[0] >= 4) redenen.push("de tannine kan tegen het vet in het gerecht");
  if (p.zoet >= 3 && gerecht.zoet[0] >= 3)      redenen.push("de zoetheid houdt het dessert bij");

  return redenen.slice(0, 3);
}

export const gerechtInfo = id => GERECHTEN.find(g => g.id === id);

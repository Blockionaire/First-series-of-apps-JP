/* =====================================================================
   WIJNKELDER — catalogus
   =====================================================================
   De referentiegegevens waar de app op leunt: kleuren, flesformaten,
   landen met hun regio's en appellaties, en de druivenrassen.

   Dit is bewust een meegeleverde lijst en geen online database. Hij
   dient twee doelen: sneller invoeren (autocomplete) en slimmer
   rekenen (de regio bepaalt mee hoe lang een wijn kan liggen en waar
   hij bij past). Je kunt altijd iets invullen wat hier niet in staat —
   de app weigert nooit een wijn omdat hij hem niet kent.
   ===================================================================== */

/* ---------------------------------------------------------------
   Kleuren / wijntypes
   --------------------------------------------------------------- */
export const KLEUREN = [
  { id: "rood",        naam: "Rood",        emoji: "🍷", kleur: "#8d2135", tekstOp: "#fff" },
  { id: "wit",         naam: "Wit",         emoji: "🥂", kleur: "#d8c072", tekstOp: "#2a2318" },
  { id: "rose",        naam: "Rosé",        emoji: "🌸", kleur: "#e0899a", tekstOp: "#3a1c22" },
  { id: "mousserend",  naam: "Mousserend",  emoji: "🍾", kleur: "#c9a227", tekstOp: "#2a2318" },
  { id: "zoet",        naam: "Zoet",        emoji: "🍯", kleur: "#c2761b", tekstOp: "#fff" },
  { id: "versterkt",   naam: "Versterkt",   emoji: "🥃", kleur: "#6b3b21", tekstOp: "#fff" },
  { id: "oranje",      naam: "Oranje",      emoji: "🟠", kleur: "#c86a2e", tekstOp: "#fff" },
];

export const kleurInfo = id => KLEUREN.find(k => k.id === id) || KLEUREN[0];

/* ---------------------------------------------------------------
   Flesformaten — inhoud in liter, gebruikt bij waarde en voorraad
   --------------------------------------------------------------- */
export const FORMATEN = [
  { id: "piccolo",    naam: "Piccolo (0,20 l)",     liter: 0.20 },
  { id: "halve",      naam: "Halve fles (0,375 l)", liter: 0.375 },
  { id: "fles",       naam: "Fles (0,75 l)",        liter: 0.75 },
  { id: "liter",      naam: "Liter (1,0 l)",        liter: 1.0 },
  { id: "magnum",     naam: "Magnum (1,5 l)",       liter: 1.5 },
  { id: "jeroboam",   naam: "Jeroboam (3,0 l)",     liter: 3.0 },
  { id: "rehoboam",   naam: "Rehoboam (4,5 l)",     liter: 4.5 },
  { id: "methusalem", naam: "Methusalem (6,0 l)",   liter: 6.0 },
  { id: "salmanazar", naam: "Salmanazar (9,0 l)",   liter: 9.0 },
  { id: "bag",        naam: "Bag-in-box (3,0 l)",   liter: 3.0 },
];

export const formaatInfo = id => FORMATEN.find(f => f.id === id) || FORMATEN[2];

/* ---------------------------------------------------------------
   Regio's
   ---------------------------------------------------------------
   `stijl` verwijst naar een rijpingsprofiel in aging.js.
   `druiven` zijn de rassen die je in die regio het meest tegenkomt;
   ze worden bovenaan gezet in de keuzelijst zodra je de regio kiest.
   --------------------------------------------------------------- */
export const REGIOS = [
  /* ---------------------------- Frankrijk ---------------------------- */
  { land: "Frankrijk", regio: "Bordeaux", stijl: "bordeaux",
    appellaties: ["Bordeaux AOC", "Bordeaux Supérieur", "Médoc", "Haut-Médoc", "Margaux", "Pauillac", "Saint-Julien", "Saint-Estèphe", "Listrac-Médoc", "Moulis-en-Médoc", "Pessac-Léognan", "Graves", "Saint-Émilion", "Saint-Émilion Grand Cru", "Pomerol", "Lalande-de-Pomerol", "Fronsac", "Côtes de Bourg", "Blaye", "Castillon", "Sauternes", "Barsac", "Entre-Deux-Mers"],
    druiven: ["Cabernet Sauvignon", "Merlot", "Cabernet Franc", "Petit Verdot", "Malbec", "Sémillon", "Sauvignon Blanc", "Muscadelle"] },

  { land: "Frankrijk", regio: "Bourgogne", stijl: "bourgogne",
    appellaties: ["Bourgogne AOC", "Chablis", "Chablis Premier Cru", "Chablis Grand Cru", "Petit Chablis", "Côte de Nuits-Villages", "Gevrey-Chambertin", "Morey-Saint-Denis", "Chambolle-Musigny", "Vougeot", "Vosne-Romanée", "Nuits-Saint-Georges", "Beaune", "Pommard", "Volnay", "Meursault", "Puligny-Montrachet", "Chassagne-Montrachet", "Savigny-lès-Beaune", "Aloxe-Corton", "Corton-Charlemagne", "Santenay", "Mercurey", "Givry", "Rully", "Montagny", "Pouilly-Fuissé", "Saint-Véran", "Mâcon-Villages"],
    druiven: ["Pinot Noir", "Chardonnay", "Aligoté", "Gamay"] },

  { land: "Frankrijk", regio: "Champagne", stijl: "champagne",
    appellaties: ["Champagne AOC", "Champagne Grand Cru", "Champagne Premier Cru", "Coteaux Champenois", "Rosé des Riceys"],
    druiven: ["Chardonnay", "Pinot Noir", "Pinot Meunier"] },

  { land: "Frankrijk", regio: "Noordelijke Rhône", stijl: "rhone-noord",
    appellaties: ["Côte-Rôtie", "Condrieu", "Château-Grillet", "Saint-Joseph", "Hermitage", "Crozes-Hermitage", "Cornas", "Saint-Péray"],
    druiven: ["Syrah", "Viognier", "Marsanne", "Roussanne"] },

  { land: "Frankrijk", regio: "Zuidelijke Rhône", stijl: "rhone-zuid",
    appellaties: ["Côtes du Rhône", "Côtes du Rhône Villages", "Châteauneuf-du-Pape", "Gigondas", "Vacqueyras", "Rasteau", "Cairanne", "Lirac", "Tavel", "Vinsobres", "Beaumes-de-Venise"],
    druiven: ["Grenache", "Syrah", "Mourvèdre", "Cinsault", "Carignan", "Grenache Blanc", "Clairette"] },

  { land: "Frankrijk", regio: "Loire", stijl: "loire",
    appellaties: ["Sancerre", "Pouilly-Fumé", "Menetou-Salon", "Quincy", "Reuilly", "Vouvray", "Montlouis-sur-Loire", "Chinon", "Bourgueil", "Saint-Nicolas-de-Bourgueil", "Saumur", "Saumur-Champigny", "Anjou", "Savennières", "Coteaux du Layon", "Quarts de Chaume", "Bonnezeaux", "Muscadet Sèvre et Maine", "Touraine", "Cheverny", "Crémant de Loire"],
    druiven: ["Sauvignon Blanc", "Chenin Blanc", "Cabernet Franc", "Melon de Bourgogne", "Gamay", "Grolleau"] },

  { land: "Frankrijk", regio: "Elzas", stijl: "elzas",
    appellaties: ["Alsace AOC", "Alsace Grand Cru", "Crémant d'Alsace", "Vendanges Tardives", "Sélection de Grains Nobles"],
    druiven: ["Riesling", "Gewürztraminer", "Pinot Gris", "Pinot Blanc", "Muscat", "Sylvaner", "Pinot Noir"] },

  { land: "Frankrijk", regio: "Beaujolais", stijl: "beaujolais",
    appellaties: ["Beaujolais", "Beaujolais-Villages", "Brouilly", "Côte de Brouilly", "Chénas", "Chiroubles", "Fleurie", "Juliénas", "Morgon", "Moulin-à-Vent", "Régnié", "Saint-Amour"],
    druiven: ["Gamay", "Chardonnay"] },

  { land: "Frankrijk", regio: "Languedoc-Roussillon", stijl: "languedoc",
    appellaties: ["Languedoc AOC", "Corbières", "Minervois", "Minervois La Livinière", "Faugères", "Saint-Chinian", "Pic Saint-Loup", "La Clape", "Picpoul de Pinet", "Fitou", "Côtes du Roussillon", "Côtes du Roussillon Villages", "Collioure", "Banyuls", "Maury", "Limoux", "Crémant de Limoux", "Pays d'Oc IGP"],
    druiven: ["Syrah", "Grenache", "Mourvèdre", "Carignan", "Cinsault", "Picpoul", "Chardonnay"] },

  { land: "Frankrijk", regio: "Provence", stijl: "provence",
    appellaties: ["Côtes de Provence", "Coteaux d'Aix-en-Provence", "Bandol", "Cassis", "Bellet", "Palette", "Les Baux-de-Provence"],
    druiven: ["Grenache", "Cinsault", "Mourvèdre", "Syrah", "Tibouren", "Rolle (Vermentino)"] },

  { land: "Frankrijk", regio: "Zuidwest-Frankrijk", stijl: "zuidwest",
    appellaties: ["Cahors", "Madiran", "Jurançon", "Gaillac", "Bergerac", "Monbazillac", "Marcillac", "Irouléguy", "Fronton", "Pacherenc du Vic-Bilh"],
    druiven: ["Malbec", "Tannat", "Négrette", "Petit Manseng", "Gros Manseng", "Merlot", "Cabernet Franc"] },

  { land: "Frankrijk", regio: "Jura & Savoie", stijl: "jura",
    appellaties: ["Arbois", "Côtes du Jura", "Château-Chalon", "L'Étoile", "Crémant du Jura", "Vin Jaune", "Savoie", "Roussette de Savoie", "Seyssel"],
    druiven: ["Savagnin", "Poulsard", "Trousseau", "Chardonnay", "Jacquère", "Mondeuse", "Altesse"] },

  { land: "Frankrijk", regio: "Corsica", stijl: "provence",
    appellaties: ["Patrimonio", "Ajaccio", "Vin de Corse", "Muscat du Cap Corse"],
    druiven: ["Nielluccio", "Sciaccarello", "Vermentino", "Grenache"] },

  /* ------------------------------ Italië ----------------------------- */
  { land: "Italië", regio: "Piemonte", stijl: "piemonte",
    appellaties: ["Barolo DOCG", "Barbaresco DOCG", "Barbera d'Alba", "Barbera d'Asti", "Dolcetto d'Alba", "Langhe", "Roero", "Nebbiolo d'Alba", "Gavi DOCG", "Moscato d'Asti", "Asti Spumante", "Gattinara", "Ghemme", "Alta Langa"],
    druiven: ["Nebbiolo", "Barbera", "Dolcetto", "Cortese", "Moscato", "Arneis"] },

  { land: "Italië", regio: "Toscane", stijl: "toscane",
    appellaties: ["Chianti DOCG", "Chianti Classico DOCG", "Chianti Classico Riserva", "Chianti Classico Gran Selezione", "Brunello di Montalcino DOCG", "Rosso di Montalcino", "Vino Nobile di Montepulciano", "Bolgheri DOC", "Bolgheri Sassicaia", "Maremma Toscana", "Morellino di Scansano", "Carmignano", "Vernaccia di San Gimignano", "Toscana IGT"],
    druiven: ["Sangiovese", "Cabernet Sauvignon", "Merlot", "Canaiolo", "Colorino", "Vernaccia", "Cabernet Franc"] },

  { land: "Italië", regio: "Veneto", stijl: "veneto",
    appellaties: ["Amarone della Valpolicella DOCG", "Valpolicella", "Valpolicella Ripasso", "Recioto della Valpolicella", "Soave", "Soave Classico", "Bardolino", "Prosecco DOC", "Conegliano Valdobbiadene Prosecco DOCG", "Lugana", "Bianco di Custoza"],
    druiven: ["Corvina", "Rondinella", "Molinara", "Garganega", "Glera", "Trebbiano"] },

  { land: "Italië", regio: "Friuli-Venezia Giulia", stijl: "italie-wit",
    appellaties: ["Collio", "Colli Orientali del Friuli", "Friuli Isonzo", "Friuli Grave", "Carso"],
    druiven: ["Friulano", "Ribolla Gialla", "Pinot Grigio", "Sauvignon Blanc", "Refosco", "Malvasia"] },

  { land: "Italië", regio: "Trentino-Alto Adige", stijl: "italie-wit",
    appellaties: ["Alto Adige DOC", "Trentino DOC", "Trento DOC", "Lago di Caldaro", "Santa Maddalena"],
    druiven: ["Pinot Grigio", "Gewürztraminer", "Chardonnay", "Lagrein", "Schiava", "Pinot Bianco"] },

  { land: "Italië", regio: "Sicilië", stijl: "italie-zuid",
    appellaties: ["Etna Rosso DOC", "Etna Bianco DOC", "Sicilia DOC", "Cerasuolo di Vittoria DOCG", "Nero d'Avola", "Marsala", "Passito di Pantelleria"],
    druiven: ["Nero d'Avola", "Nerello Mascalese", "Frappato", "Catarratto", "Grillo", "Carricante", "Zibibbo"] },

  { land: "Italië", regio: "Puglia", stijl: "italie-zuid",
    appellaties: ["Primitivo di Manduria", "Salice Salentino", "Negroamaro", "Castel del Monte", "Puglia IGT"],
    druiven: ["Primitivo", "Negroamaro", "Nero di Troia", "Fiano"] },

  { land: "Italië", regio: "Campanië", stijl: "italie-zuid",
    appellaties: ["Taurasi DOCG", "Fiano di Avellino", "Greco di Tufo", "Falanghina del Sannio", "Aglianico del Taburno"],
    druiven: ["Aglianico", "Fiano", "Greco", "Falanghina"] },

  { land: "Italië", regio: "Abruzzo & Marken", stijl: "italie-zuid",
    appellaties: ["Montepulciano d'Abruzzo", "Cerasuolo d'Abruzzo", "Trebbiano d'Abruzzo", "Verdicchio dei Castelli di Jesi", "Rosso Conero", "Offida"],
    druiven: ["Montepulciano", "Trebbiano", "Verdicchio", "Sangiovese", "Pecorino"] },

  { land: "Italië", regio: "Umbrië & Lazio", stijl: "toscane",
    appellaties: ["Sagrantino di Montefalco", "Orvieto", "Torgiano", "Frascati", "Est! Est!! Est!!!"],
    druiven: ["Sagrantino", "Sangiovese", "Grechetto", "Trebbiano", "Malvasia"] },

  { land: "Italië", regio: "Sardinië", stijl: "italie-zuid",
    appellaties: ["Cannonau di Sardegna", "Vermentino di Gallura", "Vermentino di Sardegna", "Carignano del Sulcis"],
    druiven: ["Cannonau (Grenache)", "Vermentino", "Carignano"] },

  /* ------------------------------ Spanje ----------------------------- */
  { land: "Spanje", regio: "Rioja", stijl: "rioja",
    appellaties: ["Rioja DOCa", "Rioja Crianza", "Rioja Reserva", "Rioja Gran Reserva", "Rioja Alta", "Rioja Alavesa", "Rioja Oriental"],
    druiven: ["Tempranillo", "Garnacha", "Graciano", "Mazuelo", "Viura"] },

  { land: "Spanje", regio: "Ribera del Duero", stijl: "ribera",
    appellaties: ["Ribera del Duero DO", "Crianza", "Reserva", "Gran Reserva"],
    druiven: ["Tempranillo (Tinto Fino)", "Cabernet Sauvignon", "Merlot"] },

  { land: "Spanje", regio: "Priorat & Montsant", stijl: "priorat",
    appellaties: ["Priorat DOQ", "Montsant DO"],
    druiven: ["Garnacha", "Cariñena", "Syrah", "Cabernet Sauvignon"] },

  { land: "Spanje", regio: "Rías Baixas & Galicië", stijl: "spanje-wit",
    appellaties: ["Rías Baixas DO", "Ribeiro", "Ribeira Sacra", "Valdeorras", "Monterrei", "Bierzo"],
    druiven: ["Albariño", "Godello", "Treixadura", "Mencía"] },

  { land: "Spanje", regio: "Penedès & Cava", stijl: "cava",
    appellaties: ["Cava DO", "Cava Reserva", "Cava Gran Reserva", "Corpinnat", "Penedès DO"],
    druiven: ["Macabeo", "Xarel·lo", "Parellada", "Chardonnay", "Pinot Noir"] },

  { land: "Spanje", regio: "Jerez", stijl: "sherry",
    appellaties: ["Jerez-Xérès-Sherry DO", "Manzanilla de Sanlúcar", "Fino", "Amontillado", "Oloroso", "Palo Cortado", "Pedro Ximénez"],
    druiven: ["Palomino", "Pedro Ximénez", "Moscatel"] },

  { land: "Spanje", regio: "Overig Spanje", stijl: "spanje-rood",
    appellaties: ["Toro DO", "Rueda DO", "Navarra DO", "Campo de Borja", "Calatayud", "Jumilla", "Yecla", "La Mancha", "Valdepeñas", "Somontano", "Málaga"],
    druiven: ["Tempranillo", "Garnacha", "Monastrell", "Verdejo", "Bobal"] },

  /* ------------------------------ Portugal --------------------------- */
  { land: "Portugal", regio: "Douro & Porto", stijl: "porto",
    appellaties: ["Douro DOC", "Porto DOC", "Porto Vintage", "Porto LBV", "Porto Tawny 10 jaar", "Porto Tawny 20 jaar", "Porto Ruby", "Porto White", "Porto Colheita"],
    druiven: ["Touriga Nacional", "Touriga Franca", "Tinta Roriz", "Tinta Barroca", "Tinto Cão"] },

  { land: "Portugal", regio: "Overig Portugal", stijl: "portugal",
    appellaties: ["Vinho Verde DOC", "Alentejo DOC", "Dão DOC", "Bairrada DOC", "Setúbal", "Madeira DOC", "Lisboa", "Tejo"],
    druiven: ["Alvarinho", "Loureiro", "Touriga Nacional", "Baga", "Aragonez", "Trincadeira", "Verdelho", "Sercial"] },

  /* ------------------------------ Duitsland -------------------------- */
  { land: "Duitsland", regio: "Mosel", stijl: "riesling",
    appellaties: ["Mosel", "Kabinett", "Spätlese", "Auslese", "Beerenauslese", "Trockenbeerenauslese", "Eiswein", "Grosses Gewächs"],
    druiven: ["Riesling", "Müller-Thurgau", "Elbling"] },

  { land: "Duitsland", regio: "Rheingau & Pfalz", stijl: "riesling",
    appellaties: ["Rheingau", "Pfalz", "Rheinhessen", "Nahe", "Grosses Gewächs", "Kabinett", "Spätlese"],
    druiven: ["Riesling", "Spätburgunder (Pinot Noir)", "Grauburgunder", "Weissburgunder", "Silvaner"] },

  { land: "Duitsland", regio: "Baden & Württemberg", stijl: "duitsland-rood",
    appellaties: ["Baden", "Württemberg", "Franken", "Ahr"],
    druiven: ["Spätburgunder (Pinot Noir)", "Lemberger", "Trollinger", "Grauburgunder", "Silvaner"] },

  /* ------------------------------ Oostenrijk ------------------------- */
  { land: "Oostenrijk", regio: "Oostenrijk", stijl: "oostenrijk",
    appellaties: ["Wachau", "Kremstal", "Kamptal", "Weinviertel", "Burgenland", "Neusiedlersee", "Leithaberg", "Steiermark", "Smaragd", "Federspiel", "Steinfeder"],
    druiven: ["Grüner Veltliner", "Riesling", "Blaufränkisch", "Zweigelt", "Sankt Laurent", "Welschriesling"] },

  /* ------------------------------ Overig Europa ---------------------- */
  { land: "Griekenland", regio: "Griekenland", stijl: "griekenland",
    appellaties: ["Santorini PDO", "Nemea PDO", "Naoussa PDO", "Amyndeon", "Rapsani", "Samos", "Mantinia"],
    druiven: ["Assyrtiko", "Agiorgitiko", "Xinomavro", "Moschofilero", "Malagousia", "Roditis"] },

  { land: "Hongarije", regio: "Hongarije", stijl: "tokaji",
    appellaties: ["Tokaji Aszú", "Tokaji Szamorodni", "Tokaji Furmint", "Eger", "Villány", "Szekszárd"],
    druiven: ["Furmint", "Hárslevelű", "Kékfrankos", "Kadarka"] },

  { land: "Zwitserland", regio: "Zwitserland", stijl: "zwitserland",
    appellaties: ["Valais", "Vaud", "Genève", "Ticino", "Neuchâtel"],
    druiven: ["Chasselas", "Pinot Noir", "Gamay", "Petite Arvine", "Merlot"] },

  { land: "Slovenië", regio: "Slovenië", stijl: "italie-wit",
    appellaties: ["Goriška Brda", "Vipava", "Štajerska", "Primorska"],
    druiven: ["Rebula (Ribolla Gialla)", "Sauvignon Blanc", "Malvazija", "Refošk"] },

  { land: "Nederland", regio: "Nederland", stijl: "koel-klimaat",
    appellaties: ["Limburg", "Gelderland", "Zeeland", "Achterhoek"],
    druiven: ["Solaris", "Johanniter", "Souvignier Gris", "Regent", "Pinot Noir", "Cabernet Cortis"] },

  { land: "België", regio: "België", stijl: "koel-klimaat",
    appellaties: ["Haspengouwse Wijn", "Hagelandse Wijn", "Heuvelland", "Crémant de Wallonie"],
    druiven: ["Chardonnay", "Pinot Noir", "Müller-Thurgau", "Solaris", "Johanniter"] },

  { land: "Engeland", regio: "Engeland", stijl: "engeland-mousserend",
    appellaties: ["Sussex", "Kent", "Hampshire", "English Sparkling Wine"],
    druiven: ["Chardonnay", "Pinot Noir", "Pinot Meunier", "Bacchus"] },

  /* ------------------------------ Nieuwe Wereld ---------------------- */
  { land: "Verenigde Staten", regio: "Californië", stijl: "californie",
    appellaties: ["Napa Valley", "Oakville", "Rutherford", "Stags Leap District", "Howell Mountain", "Sonoma County", "Russian River Valley", "Sonoma Coast", "Alexander Valley", "Paso Robles", "Santa Barbara County", "Sta. Rita Hills", "Monterey", "Lodi"],
    druiven: ["Cabernet Sauvignon", "Chardonnay", "Pinot Noir", "Zinfandel", "Merlot", "Syrah", "Sauvignon Blanc"] },

  { land: "Verenigde Staten", regio: "Oregon & Washington", stijl: "californie",
    appellaties: ["Willamette Valley", "Dundee Hills", "Columbia Valley", "Walla Walla Valley", "Red Mountain", "Yakima Valley"],
    druiven: ["Pinot Noir", "Chardonnay", "Pinot Gris", "Cabernet Sauvignon", "Syrah", "Riesling"] },

  { land: "Argentinië", regio: "Argentinië", stijl: "argentinie",
    appellaties: ["Mendoza", "Luján de Cuyo", "Valle de Uco", "Salta", "Cafayate", "Patagonië", "San Juan"],
    druiven: ["Malbec", "Cabernet Sauvignon", "Bonarda", "Torrontés", "Cabernet Franc"] },

  { land: "Chili", regio: "Chili", stijl: "chili",
    appellaties: ["Maipo Valley", "Colchagua Valley", "Casablanca Valley", "Aconcagua", "Limarí", "Maule", "Itata", "Leyda"],
    druiven: ["Cabernet Sauvignon", "Carménère", "Merlot", "Sauvignon Blanc", "Chardonnay", "País"] },

  { land: "Australië", regio: "Australië", stijl: "australie",
    appellaties: ["Barossa Valley", "McLaren Vale", "Clare Valley", "Eden Valley", "Coonawarra", "Yarra Valley", "Margaret River", "Hunter Valley", "Adelaide Hills", "Tasmanië"],
    druiven: ["Shiraz (Syrah)", "Cabernet Sauvignon", "Chardonnay", "Riesling", "Semillon", "Grenache", "Pinot Noir"] },

  { land: "Nieuw-Zeeland", regio: "Nieuw-Zeeland", stijl: "nieuw-zeeland",
    appellaties: ["Marlborough", "Central Otago", "Hawke's Bay", "Martinborough", "Wairarapa", "Gisborne", "Nelson"],
    druiven: ["Sauvignon Blanc", "Pinot Noir", "Chardonnay", "Pinot Gris", "Syrah", "Riesling"] },

  { land: "Zuid-Afrika", regio: "Zuid-Afrika", stijl: "zuid-afrika",
    appellaties: ["Stellenbosch", "Franschhoek", "Paarl", "Swartland", "Constantia", "Walker Bay", "Hemel-en-Aarde", "Elgin", "Robertson"],
    druiven: ["Chenin Blanc", "Cabernet Sauvignon", "Syrah/Shiraz", "Pinotage", "Sauvignon Blanc", "Chardonnay", "Cinsault"] },

  { land: "Overig", regio: "Overig", stijl: "standaard",
    appellaties: [],
    druiven: [] },
];

/* ---------------------------------------------------------------
   Druivenrassen
   ---------------------------------------------------------------
   De eigenschappen (0–5) voeden zowel het rijpingsmodel als de
   spijs-wijnmodule: tannine en zuur bepalen waar een wijn tegenop kan,
   body bepaalt of hij een gerecht niet overstemt of juist wegvalt.
   --------------------------------------------------------------- */
export const DRUIVEN = [
  /* rood */
  { naam: "Cabernet Sauvignon",     kleur: "rood", tannine: 5, zuur: 4, body: 5, zoet: 0, bewaar: 5 },
  { naam: "Merlot",                 kleur: "rood", tannine: 3, zuur: 3, body: 4, zoet: 0, bewaar: 4 },
  { naam: "Cabernet Franc",         kleur: "rood", tannine: 4, zuur: 4, body: 3, zoet: 0, bewaar: 4 },
  { naam: "Petit Verdot",           kleur: "rood", tannine: 5, zuur: 4, body: 5, zoet: 0, bewaar: 5 },
  { naam: "Pinot Noir",             kleur: "rood", tannine: 2, zuur: 4, body: 2, zoet: 0, bewaar: 4 },
  { naam: "Syrah",                  kleur: "rood", tannine: 4, zuur: 3, body: 5, zoet: 0, bewaar: 5 },
  { naam: "Shiraz (Syrah)",         kleur: "rood", tannine: 4, zuur: 3, body: 5, zoet: 0, bewaar: 4 },
  { naam: "Syrah/Shiraz",           kleur: "rood", tannine: 4, zuur: 3, body: 5, zoet: 0, bewaar: 4 },
  { naam: "Grenache",               kleur: "rood", tannine: 3, zuur: 2, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Cannonau (Grenache)",    kleur: "rood", tannine: 3, zuur: 2, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Mourvèdre",              kleur: "rood", tannine: 5, zuur: 3, body: 5, zoet: 0, bewaar: 5 },
  { naam: "Carignan",               kleur: "rood", tannine: 4, zuur: 4, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Cariñena",               kleur: "rood", tannine: 4, zuur: 4, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Carignano",              kleur: "rood", tannine: 4, zuur: 4, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Cinsault",               kleur: "rood", tannine: 2, zuur: 3, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Nebbiolo",               kleur: "rood", tannine: 5, zuur: 5, body: 4, zoet: 0, bewaar: 5 },
  { naam: "Sangiovese",             kleur: "rood", tannine: 4, zuur: 5, body: 3, zoet: 0, bewaar: 4 },
  { naam: "Barbera",                kleur: "rood", tannine: 2, zuur: 5, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Dolcetto",               kleur: "rood", tannine: 3, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Corvina",                kleur: "rood", tannine: 3, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Rondinella",             kleur: "rood", tannine: 2, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Molinara",               kleur: "rood", tannine: 2, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Aglianico",              kleur: "rood", tannine: 5, zuur: 5, body: 4, zoet: 0, bewaar: 5 },
  { naam: "Nero d'Avola",           kleur: "rood", tannine: 3, zuur: 3, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Nerello Mascalese",      kleur: "rood", tannine: 4, zuur: 4, body: 3, zoet: 0, bewaar: 4 },
  { naam: "Frappato",               kleur: "rood", tannine: 2, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Primitivo",              kleur: "rood", tannine: 3, zuur: 2, body: 5, zoet: 1, bewaar: 3 },
  { naam: "Negroamaro",             kleur: "rood", tannine: 4, zuur: 3, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Nero di Troia",          kleur: "rood", tannine: 4, zuur: 3, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Montepulciano",          kleur: "rood", tannine: 3, zuur: 3, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Sagrantino",             kleur: "rood", tannine: 5, zuur: 4, body: 5, zoet: 0, bewaar: 5 },
  { naam: "Lagrein",                kleur: "rood", tannine: 4, zuur: 3, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Schiava",                kleur: "rood", tannine: 1, zuur: 3, body: 1, zoet: 0, bewaar: 1 },
  { naam: "Refosco",                kleur: "rood", tannine: 4, zuur: 4, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Refošk",                 kleur: "rood", tannine: 4, zuur: 4, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Nielluccio",             kleur: "rood", tannine: 4, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Sciaccarello",           kleur: "rood", tannine: 2, zuur: 3, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Tempranillo",            kleur: "rood", tannine: 4, zuur: 3, body: 4, zoet: 0, bewaar: 4 },
  { naam: "Tempranillo (Tinto Fino)", kleur: "rood", tannine: 4, zuur: 3, body: 4, zoet: 0, bewaar: 5 },
  { naam: "Garnacha",               kleur: "rood", tannine: 3, zuur: 2, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Graciano",               kleur: "rood", tannine: 4, zuur: 4, body: 4, zoet: 0, bewaar: 4 },
  { naam: "Mazuelo",                kleur: "rood", tannine: 4, zuur: 4, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Monastrell",             kleur: "rood", tannine: 5, zuur: 3, body: 5, zoet: 0, bewaar: 4 },
  { naam: "Mencía",                 kleur: "rood", tannine: 3, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Bobal",                  kleur: "rood", tannine: 3, zuur: 4, body: 4, zoet: 0, bewaar: 2 },
  { naam: "País",                   kleur: "rood", tannine: 2, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Touriga Nacional",       kleur: "rood", tannine: 5, zuur: 4, body: 5, zoet: 0, bewaar: 5 },
  { naam: "Touriga Franca",         kleur: "rood", tannine: 4, zuur: 3, body: 4, zoet: 0, bewaar: 4 },
  { naam: "Tinta Roriz",            kleur: "rood", tannine: 4, zuur: 3, body: 4, zoet: 0, bewaar: 4 },
  { naam: "Tinta Barroca",          kleur: "rood", tannine: 3, zuur: 3, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Tinto Cão",              kleur: "rood", tannine: 4, zuur: 4, body: 3, zoet: 0, bewaar: 4 },
  { naam: "Aragonez",               kleur: "rood", tannine: 4, zuur: 3, body: 4, zoet: 0, bewaar: 4 },
  { naam: "Trincadeira",            kleur: "rood", tannine: 3, zuur: 3, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Baga",                   kleur: "rood", tannine: 5, zuur: 5, body: 4, zoet: 0, bewaar: 5 },
  { naam: "Malbec",                 kleur: "rood", tannine: 4, zuur: 3, body: 5, zoet: 0, bewaar: 4 },
  { naam: "Tannat",                 kleur: "rood", tannine: 5, zuur: 4, body: 5, zoet: 0, bewaar: 5 },
  { naam: "Négrette",               kleur: "rood", tannine: 3, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Carménère",              kleur: "rood", tannine: 3, zuur: 3, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Zinfandel",              kleur: "rood", tannine: 3, zuur: 3, body: 5, zoet: 1, bewaar: 3 },
  { naam: "Pinotage",               kleur: "rood", tannine: 4, zuur: 3, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Gamay",                  kleur: "rood", tannine: 2, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Grolleau",               kleur: "rood", tannine: 2, zuur: 4, body: 2, zoet: 0, bewaar: 1 },
  { naam: "Blaufränkisch",          kleur: "rood", tannine: 4, zuur: 4, body: 3, zoet: 0, bewaar: 4 },
  { naam: "Lemberger",              kleur: "rood", tannine: 4, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Zweigelt",               kleur: "rood", tannine: 2, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Sankt Laurent",          kleur: "rood", tannine: 3, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Trollinger",             kleur: "rood", tannine: 1, zuur: 3, body: 1, zoet: 0, bewaar: 1 },
  { naam: "Spätburgunder (Pinot Noir)", kleur: "rood", tannine: 2, zuur: 4, body: 2, zoet: 0, bewaar: 4 },
  { naam: "Agiorgitiko",            kleur: "rood", tannine: 3, zuur: 3, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Xinomavro",              kleur: "rood", tannine: 5, zuur: 5, body: 3, zoet: 0, bewaar: 5 },
  { naam: "Kékfrankos",             kleur: "rood", tannine: 4, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Kadarka",                kleur: "rood", tannine: 2, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Poulsard",               kleur: "rood", tannine: 1, zuur: 4, body: 1, zoet: 0, bewaar: 3 },
  { naam: "Trousseau",              kleur: "rood", tannine: 3, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Mondeuse",               kleur: "rood", tannine: 4, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Regent",                 kleur: "rood", tannine: 3, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Cabernet Cortis",        kleur: "rood", tannine: 3, zuur: 4, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Bonarda",                kleur: "rood", tannine: 2, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Colorino",               kleur: "rood", tannine: 4, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Canaiolo",               kleur: "rood", tannine: 2, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Tibouren",               kleur: "rood", tannine: 2, zuur: 3, body: 2, zoet: 0, bewaar: 2 },

  /* wit */
  { naam: "Chardonnay",             kleur: "wit", tannine: 0, zuur: 3, body: 4, zoet: 0, bewaar: 4 },
  { naam: "Sauvignon Blanc",        kleur: "wit", tannine: 0, zuur: 5, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Riesling",               kleur: "wit", tannine: 0, zuur: 5, body: 2, zoet: 2, bewaar: 5 },
  { naam: "Chenin Blanc",           kleur: "wit", tannine: 0, zuur: 5, body: 3, zoet: 1, bewaar: 5 },
  { naam: "Sémillon",               kleur: "wit", tannine: 0, zuur: 3, body: 4, zoet: 1, bewaar: 4 },
  { naam: "Semillon",               kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 5 },
  { naam: "Muscadelle",             kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 1, bewaar: 2 },
  { naam: "Viognier",               kleur: "wit", tannine: 0, zuur: 2, body: 4, zoet: 1, bewaar: 2 },
  { naam: "Marsanne",               kleur: "wit", tannine: 0, zuur: 2, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Roussanne",              kleur: "wit", tannine: 0, zuur: 3, body: 4, zoet: 0, bewaar: 3 },
  { naam: "Grenache Blanc",         kleur: "wit", tannine: 0, zuur: 2, body: 4, zoet: 0, bewaar: 2 },
  { naam: "Clairette",              kleur: "wit", tannine: 0, zuur: 2, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Picpoul",                kleur: "wit", tannine: 0, zuur: 5, body: 2, zoet: 0, bewaar: 1 },
  { naam: "Gewürztraminer",         kleur: "wit", tannine: 0, zuur: 2, body: 4, zoet: 2, bewaar: 3 },
  { naam: "Pinot Gris",             kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 1, bewaar: 3 },
  { naam: "Pinot Grigio",           kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 0, bewaar: 1 },
  { naam: "Grauburgunder",          kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Pinot Blanc",            kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Pinot Bianco",           kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Weissburgunder",         kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Muscat",                 kleur: "wit", tannine: 0, zuur: 2, body: 3, zoet: 3, bewaar: 2 },
  { naam: "Moscato",                kleur: "wit", tannine: 0, zuur: 3, body: 2, zoet: 4, bewaar: 1 },
  { naam: "Zibibbo",                kleur: "wit", tannine: 0, zuur: 2, body: 4, zoet: 4, bewaar: 3 },
  { naam: "Sylvaner",               kleur: "wit", tannine: 0, zuur: 3, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Silvaner",               kleur: "wit", tannine: 0, zuur: 3, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Aligoté",                kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 0, bewaar: 1 },
  { naam: "Melon de Bourgogne",     kleur: "wit", tannine: 0, zuur: 5, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Cortese",                kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Arneis",                 kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Garganega",              kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Trebbiano",              kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 0, bewaar: 1 },
  { naam: "Glera",                  kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 1, bewaar: 1 },
  { naam: "Friulano",               kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Ribolla Gialla",         kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Rebula (Ribolla Gialla)", kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Malvasia",               kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 1, bewaar: 2 },
  { naam: "Malvazija",              kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Fiano",                  kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Greco",                  kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Falanghina",             kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Catarratto",             kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Grillo",                 kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Carricante",             kleur: "wit", tannine: 0, zuur: 5, body: 3, zoet: 0, bewaar: 4 },
  { naam: "Verdicchio",             kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Pecorino",               kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Grechetto",              kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Vernaccia",              kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Vermentino",             kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Rolle (Vermentino)",     kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Albariño",               kleur: "wit", tannine: 0, zuur: 5, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Alvarinho",              kleur: "wit", tannine: 0, zuur: 5, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Godello",                kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Treixadura",             kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Loureiro",               kleur: "wit", tannine: 0, zuur: 5, body: 2, zoet: 0, bewaar: 1 },
  { naam: "Verdejo",                kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Viura",                  kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Macabeo",                kleur: "wit", tannine: 0, zuur: 3, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Xarel·lo",               kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Parellada",              kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 0, bewaar: 1 },
  { naam: "Palomino",               kleur: "wit", tannine: 0, zuur: 3, body: 2, zoet: 0, bewaar: 3 },
  { naam: "Pedro Ximénez",          kleur: "wit", tannine: 0, zuur: 2, body: 5, zoet: 5, bewaar: 5 },
  { naam: "Moscatel",               kleur: "wit", tannine: 0, zuur: 2, body: 4, zoet: 4, bewaar: 3 },
  { naam: "Verdelho",               kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 1, bewaar: 4 },
  { naam: "Sercial",                kleur: "wit", tannine: 0, zuur: 5, body: 3, zoet: 0, bewaar: 5 },
  { naam: "Grüner Veltliner",       kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Welschriesling",         kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 1, bewaar: 2 },
  { naam: "Müller-Thurgau",         kleur: "wit", tannine: 0, zuur: 3, body: 2, zoet: 1, bewaar: 1 },
  { naam: "Elbling",                kleur: "wit", tannine: 0, zuur: 5, body: 1, zoet: 0, bewaar: 1 },
  { naam: "Assyrtiko",              kleur: "wit", tannine: 0, zuur: 5, body: 3, zoet: 0, bewaar: 4 },
  { naam: "Moschofilero",           kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 0, bewaar: 1 },
  { naam: "Malagousia",             kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Roditis",                kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 0, bewaar: 1 },
  { naam: "Furmint",                kleur: "wit", tannine: 0, zuur: 5, body: 3, zoet: 1, bewaar: 5 },
  { naam: "Hárslevelű",             kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 2, bewaar: 4 },
  { naam: "Savagnin",               kleur: "wit", tannine: 0, zuur: 5, body: 4, zoet: 0, bewaar: 5 },
  { naam: "Jacquère",               kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 0, bewaar: 1 },
  { naam: "Altesse",                kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 0, bewaar: 3 },
  { naam: "Chasselas",              kleur: "wit", tannine: 0, zuur: 2, body: 2, zoet: 0, bewaar: 1 },
  { naam: "Petite Arvine",          kleur: "wit", tannine: 0, zuur: 4, body: 3, zoet: 1, bewaar: 3 },
  { naam: "Petit Manseng",          kleur: "wit", tannine: 0, zuur: 5, body: 3, zoet: 3, bewaar: 4 },
  { naam: "Gros Manseng",           kleur: "wit", tannine: 0, zuur: 5, body: 3, zoet: 1, bewaar: 3 },
  { naam: "Bacchus",                kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 1, bewaar: 1 },
  { naam: "Solaris",                kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 1, bewaar: 2 },
  { naam: "Johanniter",             kleur: "wit", tannine: 0, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
  { naam: "Souvignier Gris",        kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 0, bewaar: 2 },
  { naam: "Torrontés",              kleur: "wit", tannine: 0, zuur: 3, body: 3, zoet: 1, bewaar: 1 },
  { naam: "Pinot Meunier",          kleur: "rood", tannine: 2, zuur: 4, body: 2, zoet: 0, bewaar: 2 },
];

export const druifInfo = naam => DRUIVEN.find(d => d.naam.toLowerCase() === String(naam || "").toLowerCase());

/* ---------------------------------------------------------------
   Afgeleide lijsten voor de keuzevelden
   --------------------------------------------------------------- */
export const LANDEN = [...new Set(REGIOS.map(r => r.land))].sort((a, b) => a.localeCompare(b, "nl"));

export const regiosVanLand = land => REGIOS.filter(r => r.land === land);

export const regioInfo = (land, regio) =>
  REGIOS.find(r => r.land === land && r.regio === regio) ||
  REGIOS.find(r => r.regio === regio) ||
  null;

export const ALLE_APPELLATIES = [...new Set(REGIOS.flatMap(r => r.appellaties))].sort((a, b) => a.localeCompare(b, "nl"));
export const ALLE_DRUIVEN = DRUIVEN.map(d => d.naam).sort((a, b) => a.localeCompare(b, "nl"));

/* Zoek een regio op een appellatie — handig als iemand alleen "Pauillac" typt. */
export function regioVanAppellatie(appellatie) {
  if (!appellatie) return null;
  const a = appellatie.trim().toLowerCase();
  return REGIOS.find(r => r.appellaties.some(x => x.toLowerCase() === a)) || null;
}

/* ---------------------------------------------------------------
   Bewaaromstandigheden — advies dat op de wijnfiche verschijnt
   --------------------------------------------------------------- */
export const BEWAARADVIES = {
  rood:       { temp: "12–16 °C", ligging: "Liggend",  glas: "Groot bolvormig glas", schenk: "16–18 °C" },
  wit:        { temp: "10–12 °C", ligging: "Liggend",  glas: "Middelgroot wit glas", schenk: "8–12 °C" },
  rose:       { temp: "10–12 °C", ligging: "Liggend",  glas: "Middelgroot wit glas", schenk: "8–10 °C" },
  mousserend: { temp: "10–12 °C", ligging: "Liggend",  glas: "Tulpvormige flute",    schenk: "6–8 °C" },
  zoet:       { temp: "10–14 °C", ligging: "Liggend",  glas: "Klein zoet-wijnglas",  schenk: "8–10 °C" },
  versterkt:  { temp: "14–18 °C", ligging: "Staand",   glas: "Klein tulpglas",       schenk: "12–18 °C" },
  oranje:     { temp: "12–14 °C", ligging: "Liggend",  glas: "Groot wit glas",       schenk: "12–14 °C" },
};

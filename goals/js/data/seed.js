/* =====================================================================
   GOALS — the starting point
   =====================================================================
   The September–December 2026 booklet, turned into records. This runs
   once, on an empty database. Everything it writes is ordinary data:
   rename it, delete it, add a period of your own — nothing in the app
   treats these four goals as special.
   ===================================================================== */

export function seedData(newId) {
  const period = {
    id: newId(),
    title: "September – December 2026",
    start: "2026-09-01",
    end: "2026-12-31",
    description: "Four months to finish the year stronger, with a business that has paid customers, a smaller loan and a deeper faith.",
    status: "active",
  };

  const goals = [];
  const milestones = [];
  const metrics = [];
  const standards = [];

  /* Small builders so the content below reads like the booklet. */
  const goal = (key, data) => {
    const record = { id: newId(), periodId: period.id, key, order: goals.length, ...data };
    goals.push(record);
    return record;
  };

  const milestone = (g, month, title) => {
    milestones.push({
      id: newId(), goalId: g.id, month, title,
      done: false, doneAt: null, order: milestones.filter(m => m.goalId === g.id).length,
    });
  };

  const metric = (g, data) => {
    const record = {
      id: newId(), goalId: g.id, order: metrics.filter(m => m.goalId === g.id).length,
      direction: "up", aggregation: "latest", source: "entry", type: null,
      start: null, target: null, headline: false, ...data,
    };
    metrics.push(record);
    return record;
  };

  const standard = (g, data) => {
    standards.push({
      id: newId(), goalId: g.id, order: standards.filter(s => s.goalId === g.id).length,
      per: "week", count: "entries", min: 1, max: null, tags: [], ...data,
    });
  };

  /* ------------------------------------------------------------- HEALTH */
  const health = goal("health", {
    title: "Build a noticeably stronger and fitter body",
    objective: "Increase bodyweight from 63 kg to 67 kg through muscle gain, while consistently strength training 3–4 times per week and running once per week.",
    why: "The objective is not simply to weigh more. I want to finish 2026 visibly stronger, more muscular and physically fit.",
    targetDate: "2026-12-31",
  });

  metric(health, {
    name: "Bodyweight", unit: "kg", aggregation: "latest", source: "entry", type: "weight",
    start: 63, target: 67, direction: "up", headline: true, decimals: 1,
  });
  metric(health, {
    name: "Gym sessions", unit: "sessions", aggregation: "count", source: "type", type: "gym",
    start: 0, target: 44, direction: "up",
  });
  metric(health, {
    name: "Runs", unit: "sessions", aggregation: "count", source: "type", type: "run",
    start: 0, target: 14, direction: "up",
  });
  metric(health, {
    name: "Average pace", unit: "pace", aggregation: "pace", source: "entry", type: "run",
    start: null, target: null, direction: "down",
  });
  metric(health, {
    name: "Best lift", unit: "kg", aggregation: "max", source: "entry", type: "lift",
    start: null, target: null, direction: "up",
  });

  standard(health, { title: "Strength training", type: "gym", unit: "sessions", min: 3, max: 4 });
  standard(health, { title: "Running", type: "run", unit: "sessions", min: 1, max: null });

  milestone(health, "2026-09", "Establish a fixed 3–4 day gym schedule");
  milestone(health, "2026-09", "Average around 64 kg by the end of the month");
  milestone(health, "2026-09", "Start tracking workouts and bodyweight");
  milestone(health, "2026-09", "Determine baseline performance for my main exercises");
  milestone(health, "2026-09", "Complete at least 8 gym sessions and 2 runs");
  milestone(health, "2026-10", "Reach approximately 65 kg");
  milestone(health, "2026-10", "Continue progressive overload");
  milestone(health, "2026-10", "Complete 12–15 gym sessions and 4 runs");
  milestone(health, "2026-11", "Reach approximately 66 kg");
  milestone(health, "2026-11", "Compare progress photos with September");
  milestone(health, "2026-11", "Complete 12–15 gym sessions and 4 runs");
  milestone(health, "2026-12", "Reach approximately 67 kg");
  milestone(health, "2026-12", "Take final progress photos and record strength improvements");
  milestone(health, "2026-12", "Complete 12–15 gym sessions and 4 runs");

  /* ----------------------------------------------------------- BUSINESS */
  const business = goal("business", {
    title: "Turn Audit AI from an idea into my first real business",
    objective: "By 31 December 2026, launch one focused Audit AI proposition, acquire at least 3 paying customers and generate at least €7,500 in cumulative revenue.",
    why: "The most important objective is not building the perfect platform. It is proving that somebody is willing to pay me to solve a real problem.",
    targetDate: "2026-12-31",
  });

  metric(business, {
    name: "Revenue", unit: "eur", aggregation: "cumulative", source: "entry", type: "revenue",
    start: 0, target: 7500, direction: "up", headline: true,
  });
  metric(business, {
    name: "Paying customers", unit: "count", aggregation: "count", source: "type", type: "customer",
    start: 0, target: 3, direction: "up",
  });
  metric(business, {
    name: "Prospects", unit: "count", aggregation: "cumulative", source: "entry", type: "prospect",
    start: 0, target: 50, direction: "up",
  });
  metric(business, {
    name: "Focused hours", unit: "hours", aggregation: "cumulative", source: "duration", type: "hours",
    start: 0, target: 136, direction: "up",
  });

  standard(business, { title: "Focused hours", type: "hours", unit: "hours", min: 8, max: null });
  standard(business, {
    title: "Building and selling", type: "hours", unit: "tags", min: 1, max: null,
    tags: ["building", "selling"],
    note: "A week spent entirely researching, designing or coding without speaking to the market does not count as a successful business week.",
  });

  milestone(business, "2026-09", "Define ideal customer, specific problem, solution, price and expected ROI");
  milestone(business, "2026-09", "Create a simple landing page, demo or prototype");
  milestone(business, "2026-09", "Build a list of at least 50 potential prospects");
  milestone(business, "2026-10", "Actively approach prospects every week");
  milestone(business, "2026-10", "Start the first round of pilots");
  milestone(business, "2026-10", "Deliver the first version partly manually if necessary");
  milestone(business, "2026-10", "Gather detailed feedback and measure the customer's result");
  milestone(business, "2026-11", "Close the first paid pilot before 30 November");
  milestone(business, "2026-11", "Improve the proposition based on real customer feedback");
  milestone(business, "2026-11", "Standardise the parts of delivery that repeat");
  milestone(business, "2026-11", "Reach approximately €3,000–€5,000 cumulative revenue");
  milestone(business, "2026-11", "Start documenting how the service could become more scalable");
  milestone(business, "2026-12", "Reach at least 3 paying customers");
  milestone(business, "2026-12", "Reach €7,500 cumulative revenue");
  milestone(business, "2026-12", "Have several qualified prospects in the pipeline for January");
  milestone(business, "2026-12", "Decide what should be automated or built into software in 2027");
  milestone(business, "2026-12", "Write a one-page 2027 growth strategy based on what customers actually wanted");

  /* ----------------------------------------------------------- FINANCES */
  const finances = goal("finances", {
    title: "Aggressively improve my personal balance sheet",
    objective: "By 31 December 2026, reduce the €25,000 renovation loan by at least €6,000, bringing the outstanding balance below €19,000, while avoiding new unnecessary debt.",
    why: "Every euro repaid is a euro that stops costing interest and starts building a balance sheet I actually own.",
    targetDate: "2026-12-31",
  });

  metric(finances, {
    name: "Repaid", unit: "eur", aggregation: "cumulative", source: "entry", type: "repayment",
    start: 0, target: 6000, direction: "up", headline: true,
  });
  metric(finances, {
    name: "Loan balance", unit: "eur", aggregation: "latest", source: "entry", type: "balance",
    start: 25000, target: 19000, direction: "down",
  });
  metric(finances, {
    name: "Net worth", unit: "eur", aggregation: "latest", source: "entry", type: "networth",
    start: null, target: null, direction: "up",
  });

  milestone(finances, "2026-09", "Make a complete overview of assets, cash, debt and monthly expenditure");
  milestone(finances, "2026-09", "Determine my minimum emergency and travel buffer");
  milestone(finances, "2026-09", "Start tracking the loan");
  milestone(finances, "2026-10", "Put the first side-business income directly into the agreed allocation");
  milestone(finances, "2026-10", "Review unnecessary recurring expenditure");
  milestone(finances, "2026-11", "Reach approximately €3,500–€4,000 cumulative repayment");
  milestone(finances, "2026-11", "Prevent Black Friday and holiday spending");
  milestone(finances, "2026-11", "Increase repayment if business income starts arriving");
  milestone(finances, "2026-12", "Reach at least €6,000 cumulative repayment");
  milestone(finances, "2026-12", "Stretch toward €7,500–€10,000 if business performance allows");
  milestone(finances, "2026-12", "Calculate my net-worth improvement over the four-month period");
  milestone(finances, "2026-12", "Set a realistic date for becoming completely debt-free in 2027");

  /* -------------------------------------------------------------- FAITH */
  const faith = goal("faith", {
    title: "Build a deeper, more knowledgeable and more intentional faith",
    objective: "By 31 December 2026, have a consistent rhythm of Bible reading, deeper prayer and structured study of biblical history and context.",
    why: "The goal is not simply to complete reading sessions. I want to understand more, pray with greater attention and develop genuine curiosity about Scripture and its historical context.",
    targetDate: "2026-12-31",
  });

  metric(faith, {
    name: "Reading sessions", unit: "sessions", aggregation: "count", source: "type", type: "bible",
    start: 0, target: 85, direction: "up", headline: true,
  });
  metric(faith, {
    name: "Deeper study", unit: "sessions", aggregation: "count", source: "type", type: "study",
    start: 0, target: 17, direction: "up",
  });

  standard(faith, { title: "Bible reading", type: "bible", unit: "days", min: 5, max: null,
    note: "10–15 minutes, followed by intentional prayer rather than only a quick prayer." });
  standard(faith, { title: "Deeper study", type: "study", unit: "sessions", min: 1, max: null,
    note: "45–60 minutes on historical context, geography, people, theology or a difficult passage." });

  /* The booklet sets a rhythm for faith rather than monthly outcomes,
     so there are deliberately no milestones here. Add your own. */

  /* ---------------------------------------------------------- CURIOSITY */
  const topics = [];
  const modules = [];

  const topic = (data, moduleTitles) => {
    const record = { id: newId(), order: topics.length, cover: null, notes: "", ...data };
    topics.push(record);
    moduleTitles.forEach((title, i) => {
      modules.push({
        id: newId(), topicId: record.id, title, order: i,
        done: false, doneAt: null, notes: "",
      });
    });
    return record;
  };

  topic({
    title: "History",
    month: "2026-09",
    status: "current",
    outcome: "Build one connected timeline in my head, from the ancient world to the modern era, and know where the Netherlands sits in it.",
    tint: 32,
  }, [
    "Ancient civilizations",
    "The Middle Ages",
    "The Renaissance",
    "The Enlightenment",
    "The Industrial Revolution",
    "The World Wars",
    "The Cold War",
    "The modern era",
    "Different empires",
    "Different revolutions",
    "The history of the Netherlands",
  ]);

  topic({
    title: "Watches",
    month: "2026-10",
    status: "upcoming",
    outcome: "Understand the basics of watches: movements, categories, brands, iconic models and vintage.",
    tint: 210,
  }, [
    "How a mechanical watch works",
    "Watch vocabulary",
    "The main categories",
    "The major brands and what they represent",
    "The iconic models",
    "Complications",
    "The world of vintage watches",
    "Quality and pricing",
  ]);

  topic({
    title: "Wine",
    month: "2026-11",
    status: "upcoming",
    outcome: "Be able to read a label, name what I am tasting and choose a bottle for a dish with confidence.",
    tint: 348,
  }, [
    "How wine is made",
    "The key grape varieties",
    "What you are actually tasting",
    "Old World versus New World",
    "The important regions",
    "Understanding wine labels",
    "Wine and food pairing",
  ]);

  topic({
    title: "Fashion",
    month: "2026-12",
    status: "upcoming",
    outcome: "Understand why clothes look right or wrong, and build a wardrobe on purpose instead of by accident.",
    tint: 264,
  }, [
    "Fit first",
    "Menswear proportions",
    "Fabrics",
    "Tailoring",
    "The classic wardrobe",
    "Colour combinations",
    "The different style worlds",
    "Shoes, properly",
    "Luxury fashion economics",
  ]);

  topic({
    title: "Human body / brain",
    month: null,
    status: "upcoming",
    outcome: "Understand how the body keeps itself running, and how the brain learns, remembers and wants things.",
    tint: 168,
  }, [
    "The body's main systems",
    "Heart and circulation",
    "Lungs and breathing",
    "Muscles",
    "Bones and joints",
    "Digestion and metabolism",
    "Hormones",
    "Brain anatomy",
    "How neurons work",
    "Memory and learning",
    "Reward and motivation",
    "Sleep",
  ]);

  const backlog = ["Architecture", "Nuclear energy", "The Roman Empire", "Coffee", "Monetary policy"]
    .map((title, i) => ({ id: newId(), title, note: "", order: i, topicId: null }));

  return { periods: [period], goals, milestones, metrics, standards, topics, modules, backlog };
}

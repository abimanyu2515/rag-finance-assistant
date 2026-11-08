/**
 * Synthetic INR transaction generator for demo accounts.
 *
 * Deterministic for a given (persona, months, seed, day it is run), so the
 * same "Load demo data" click twice produces the same external_ids and the
 * second import is a no-op.
 */

// mulberry32 — tiny seeded PRNG
const makeRng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const VARIABLE_POOLS = {
  Food: {
    merchants: ["Swiggy", "Zomato", "Domino's Pizza", "Chai Point", "Starbucks", "Haldiram's", "Local Dhaba"],
    range: [120, 900],
  },
  Groceries: {
    merchants: ["BigBasket", "Blinkit", "Zepto", "DMart", "Reliance Fresh", "More Supermarket"],
    range: [250, 3200],
  },
  Transport: {
    merchants: ["Uber", "Ola", "Rapido", "Namma Metro", "IRCTC", "Indian Oil Petrol Pump"],
    range: [60, 1800],
  },
  Shopping: {
    merchants: ["Amazon", "Flipkart", "Myntra", "Ajio", "Decathlon", "Croma"],
    range: [400, 6000],
  },
  Health: {
    merchants: ["Apollo Pharmacy", "PharmEasy", "1mg", "Cult.fit"],
    range: [150, 2500],
  },
  Entertainment: {
    merchants: ["BookMyShow", "PVR Cinemas", "Steam India", "Spotify"],
    range: [150, 1500],
  },
};

const PERSONAS = {
  student: {
    dailyRate: 1.1,
    spendScale: 0.35, // variable-spend amounts relative to the base pools
    weights: { Food: 40, Groceries: 10, Transport: 25, Shopping: 12, Health: 3, Entertainment: 10 },
    recurring: [
      { day: 1, type: "credit", merchant: "Parents (UPI Transfer)", category: "Income", amount: [18000, 20000] },
      { day: 2, type: "debit", merchant: "Sunshine PG Accommodation", category: "Rent", amount: [6500, 6500] },
      { day: 5, type: "debit", merchant: "Jio Prepaid Recharge", category: "Bills", amount: [299, 299] },
      { day: 12, type: "debit", merchant: "Spotify Premium", category: "Subscriptions", amount: [119, 119] },
    ],
  },
  young_professional: {
    dailyRate: 1.7,
    spendScale: 0.9,
    weights: { Food: 30, Groceries: 18, Transport: 20, Shopping: 18, Health: 6, Entertainment: 8 },
    recurring: [
      { day: 1, type: "credit", merchant: "Acme Technologies Pvt Ltd (Salary)", category: "Income", amount: [85000, 85000] },
      { day: 3, type: "debit", merchant: "Rent - Landlord (NEFT)", category: "Rent", amount: [22000, 22000] },
      { day: 6, type: "debit", merchant: "Airtel Postpaid", category: "Bills", amount: [599, 599] },
      { day: 8, type: "debit", merchant: "BESCOM Electricity", category: "Bills", amount: [1100, 2300] },
      { day: 7, type: "debit", merchant: "Zerodha Coin SIP", category: "Investments", amount: [10000, 10000] },
      { day: 15, type: "debit", merchant: "Netflix", category: "Subscriptions", amount: [649, 649] },
    ],
  },
  family: {
    dailyRate: 2.2,
    spendScale: 1,
    weights: { Food: 18, Groceries: 34, Transport: 18, Shopping: 16, Health: 9, Entertainment: 5 },
    recurring: [
      { day: 1, type: "credit", merchant: "Infosys Ltd (Salary)", category: "Income", amount: [140000, 140000] },
      { day: 5, type: "debit", merchant: "HDFC Home Loan EMI", category: "Loan EMI", amount: [35500, 35500] },
      { day: 10, type: "debit", merchant: "Delhi Public School Fees", category: "Education", amount: [8200, 8200] },
      { day: 8, type: "debit", merchant: "Tata Power Electricity", category: "Bills", amount: [2500, 4600] },
      { day: 6, type: "debit", merchant: "JioFiber Broadband", category: "Bills", amount: [999, 999] },
      { day: 15, type: "debit", merchant: "Netflix", category: "Subscriptions", amount: [649, 649] },
      { day: 20, type: "debit", merchant: "LIC Premium", category: "Insurance", amount: [4200, 4200] },
    ],
  },
};

export const DEMO_PERSONAS = Object.keys(PERSONAS);

const UNKNOWN_MERCHANTS = ["QPAY*XZ8812", "UNKNWN MERCHANT 4471", "GiftCardHub Online", "FASTCASH*TRF 0093"];
const FOREIGN_MERCHANTS = ["AliExpress (USD)", "Booking.com (EUR)", "Shein Global (USD)", "Unknown Merchant Lagos (USD)"];

export const generateDemoTransactions = ({ persona = "young_professional", months = 6, seed = 42 } = {}) => {
  const profile = PERSONAS[persona];
  if (!profile) throw new Error(`Unknown persona "${persona}". Use one of: ${DEMO_PERSONAS.join(", ")}`);
  months = Math.min(Math.max(Math.round(Number(months) || 6), 1), 12);

  const rng = makeRng(seed);
  const between = (min, max) => min + rng() * (max - min);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const roundAmt = (n) => (n >= 1000 ? Math.round(n) : Math.round(n * 100) / 100);

  const monthlyIncome = profile.recurring.find((r) => r.category === "Income").amount[0];
  const categories = Object.entries(profile.weights);
  const totalWeight = categories.reduce((s, [, w]) => s + w, 0);
  const pickCategory = () => {
    let r = rng() * totalWeight;
    for (const [cat, w] of categories) if ((r -= w) < 0) return cat;
    return categories[0][0];
  };

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const txs = [];

  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    const monthIndex = (d.getFullYear() - start.getFullYear()) * 12 + d.getMonth() - start.getMonth();
    const drift = 1 + 0.03 * monthIndex; // spending creeps up slowly
    const at = (h, m = Math.floor(rng() * 60)) => {
      const t = new Date(d);
      t.setHours(h, m, Math.floor(rng() * 60), 0);
      return t;
    };

    for (const r of profile.recurring) {
      if (d.getDate() !== r.day) continue;
      txs.push({
        type: r.type,
        merchant: r.merchant,
        category: r.category,
        amount: roundAmt(between(r.amount[0], r.amount[1])),
        timestamp: at(9 + Math.floor(rng() * 3)),
        isSuspicious: false,
      });
    }

    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const count = Math.floor(profile.dailyRate * (weekend ? 1.4 : 1) + rng());
    for (let i = 0; i < count; i++) {
      const category = pickCategory();
      const pool = VARIABLE_POOLS[category];
      // skew toward the low end of the range: most purchases are small
      const amount = pool.range[0] + Math.pow(rng(), 2) * (pool.range[1] - pool.range[0]);
      txs.push({
        type: "debit",
        merchant: pick(pool.merchants),
        category,
        amount: roundAmt(amount * profile.spendScale * drift),
        timestamp: at(8 + Math.floor(rng() * 15)),
        isSuspicious: false,
      });
    }

    // occasional refunds / cashback
    if (rng() < 0.03) {
      txs.push({
        type: "credit",
        merchant: pick(["Amazon Refund", "Flipkart Refund", "CRED Cashback", "Paytm Cashback"]),
        category: "Refunds",
        amount: roundAmt(between(50, 2500)),
        timestamp: at(12),
        isSuspicious: false,
      });
    }
  }

  // Inject ~1.5% anomalies so fraud questions have something to find.
  // Sizes scale with income so a student's fraud isn't a family's salary.
  const debits = txs.filter((t) => t.type === "debit" && t.category !== "Rent");
  const anomalyCount = Math.max(3, Math.round(txs.length * 0.015));
  for (let i = 0; i < anomalyCount; i++) {
    const base = pick(debits);
    const kind = i % 3;
    if (kind === 0) {
      const t = new Date(base.timestamp);
      t.setHours(2 + Math.floor(rng() * 3));
      txs.push({
        type: "debit",
        merchant: pick(UNKNOWN_MERCHANTS),
        category: "Shopping",
        amount: roundAmt(between(0.3, 0.7) * monthlyIncome),
        timestamp: t,
        isSuspicious: true,
      });
    } else if (kind === 1) {
      txs.push({
        ...base,
        timestamp: new Date(new Date(base.timestamp).getTime() + (2 + Math.floor(rng() * 4)) * 60000),
        isSuspicious: true,
      });
    } else {
      txs.push({
        type: "debit",
        merchant: pick(FOREIGN_MERCHANTS),
        category: "Shopping",
        amount: roundAmt(between(0.1, 0.3) * monthlyIncome),
        timestamp: new Date(base.timestamp),
        isSuspicious: true,
      });
    }
  }

  return txs
    .filter((t) => t.timestamp <= now)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((t, index) => ({
      ...t,
      name: t.merchant,
      timestamp: t.timestamp.toISOString(),
      externalId: `demo-${persona}-${seed}-${index}`,
    }));
};

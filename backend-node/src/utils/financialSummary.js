export const buildFinancialSummary = (transactions) => {
  let totalCredit = 0;
  let totalDebit = 0;
  let categoryMap = {};
  let suspiciousCount = 0;
  let name = "Unknown";
  let merchants = new Set();
  
  transactions.forEach(tx => {
    if (tx.type === "credit") totalCredit += tx.amount;
    else totalDebit += tx.amount;
    name = tx.name || name; // Use the name from transaction if available

    if (tx.merchant) merchants.add(tx.merchant);

    if (tx.type === "debit") {
      categoryMap[tx.category] =
        (categoryMap[tx.category] || 0) + tx.amount;
    }

    if (tx.isSuspicious) suspiciousCount++;
  });

  const balance = totalCredit - totalDebit;

  return {
    totalCredit,
    totalDebit,
    balance,
    categoryMap,
    name,
    suspiciousCount,
    merchants: [...merchants]
  };
};

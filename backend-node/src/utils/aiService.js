import axios from "axios";

export const generateAIResponse = async (relevantTransactions, question, summary) => {

  const transactionContext = relevantTransactions.length > 0 ? 
      relevantTransactions.map(
            (tx, i) =>
              `${i + 1}. ${tx.type === "credit" ? "Credit" : "Debit"} of $${Number(tx.amount).toFixed(2)} at ${tx.merchant} (${tx.category}) on ${tx.timestamp?.split("T")[0] ?? "N/A"}. Suspicious: ${tx.isSuspicious}`
          )
          .join("\n") : 'No relevant transactions found.';

  const prompt = `
You are a financial assistant.
Answer based only on the provided data.

${transactionContext}

Financial Summary:
Total Credit: ${summary.totalCredit}
Total Debit: ${summary.totalDebit}
Balance: ${summary.balance}
Category Spending: ${JSON.stringify(summary.categoryMap)}
Suspicious Transactions: ${summary.suspiciousCount}
Merchants: ${summary.merchants.length > 0 ? summary.merchants.join(", ") : "None"}
name: ${summary.name}

User Question:
${question}

Instructions: 
 - Be concise and speecific
 - Refer actual transactions from above data
 - If the data doesn't support the answer, say so honestly. 
`;

  const response = await axios.post(`${process.env.OLLAMA_URL}/api/generate`, {
    model: "mistral",
    prompt,
    stream: false
  });

  return response.data.response;
};

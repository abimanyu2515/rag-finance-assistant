import axios from "axios";

export const generateAIResponse = async (summary, question) => {

  const prompt = `
You are a financial assistant.
Answer based only on the provided data.

Financial Summary:
Total Credit: ${summary.totalCredit}
Total Debit: ${summary.totalDebit}
Balance: ${summary.balance}
Category Spending: ${JSON.stringify(summary.categoryMap)}
Suspicious Transactions: ${summary.suspiciousCount}
name: ${summary.name}

User Question:
${question}
`;

  const response = await axios.post(process.env.OLLAMA_URL, {
    model: "mistral",
    prompt,
    stream: false
  });

  return response.data.response;
};

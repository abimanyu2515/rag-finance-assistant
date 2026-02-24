import axios from "axios";

export const generateAIResponse = async (relevantTransactions, question, summary, res) => {

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
 - Be concise and specific
 - Refer actual transactions from above data
 - If the data doesn't support the answer, say so honestly. 
`;

  const response = await axios.post(`${process.env.OLLAMA_URL}/api/generate`, {
    model: "mistral",
    prompt,
    stream: false
  }, {
    responseType: "stream",
  });

  let fullResponse = "";
  let buffer = "";
  return new Promise((resolve, reject) => {
    ollamaRes.data.on("data", (chunk) => {
      const lines = chunk.toString().split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);

          if (parsed.response) {
            fullResponse += parsed.response;
            // Send each token to the client as an SSE event
            res.write(`data: ${JSON.stringify({ token: parsed.response })}\n\n`);
          }

          if (parsed.done) {
            // Signal end of stream to the client
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          }
        } catch {
          // Incomplete JSON chunk — store and wait for next data event
          buffer = toParse;
          // don't reject; wait for next chunk to complete the JSON
          continue;
        }
      }
    });

    ollamaRes.data.on("end", () => resolve(fullResponse));
    ollamaRes.data.on("error", (err) => {
      // Inform client and reject promise
      try {
        res.write(`data: ${JSON.stringify({ error: "AI stream error" })}\n\n`);
      } catch (e) { /* ignore write errors */ }
      reject(err);
    });
  });
  
};

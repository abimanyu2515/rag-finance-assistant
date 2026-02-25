import axios from "axios";

export const generateAIResponse = async (relevantTransactions, question, summary, res, conversationHistory = []) => {

  const transactionContext = relevantTransactions.length > 0 ? 
      relevantTransactions.map(
            (tx, i) =>
              `${i + 1}. ${tx.type === "credit" ? "Credit" : "Debit"} of $${Number(tx.amount).toFixed(2)} at ${tx.merchant} (${tx.category}) on ${tx.timestamp?.split("T")[0] ?? "N/A"}. Suspicious: ${tx.isSuspicious}`
          )
          .join("\n") : 'No relevant transactions found.';
        // ─── 1. Format helpers ────────────────────────────────────────────────

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

const formatCategorySpending = (categoryMap) =>
  Object.entries(categoryMap)
    .map(([cat, amt]) => `  • ${cat}: ${formatCurrency(amt)}`)
    .join("\n");

const formatMerchants = (merchants) =>
  merchants.length > 0 ? merchants.join(", ") : "No merchants found";

// ─── 2. Detect intent before building prompt ──────────────────────────

const isGreeting = (q) =>
  /^(hi|hello|hey|how are you|good morning|good evening|what's up)/i.test(q.trim());

// ─── 3. Build financial context block ────────────────────────────────

const buildFinancialContext = (summary, transactionContext) => `
=== FINANCIAL PROFILE FOR ${summary.name.toUpperCase()} ===

Overview:
  • Total Credits : ${formatCurrency(summary.totalCredit)}
  • Total Debits  : ${formatCurrency(summary.totalDebit)}
  • Net Balance   : ${formatCurrency(summary.balance)}
  • Suspicious Txns: ${summary.suspiciousCount}

Spending by Category:
${formatCategorySpending(summary.categoryMap)}

Merchants Transacted With:
  ${formatMerchants(summary.merchants)}

Recent Relevant Transactions:
${transactionContext}
`.trim();

// ─── 4. Final prompt builder ──────────────────────────────────────────

const buildPrompt = (question, summary, transactionContext, conversationHistory = []) => {
  const greeting = isGreeting(question);

  const systemRole = `
You are FinBot, a smart and friendly personal finance assistant.
You are currently assisting ${summary.name}.
Today's date is ${new Date().toDateString()}.
`.trim();

  const financialContext = greeting
    ? "" // Don't inject financial data for greetings
    : buildFinancialContext(summary, transactionContext);

  const instructions = greeting
    ? `
The user is greeting you. Respond in a warm, friendly manner.
Briefly introduce yourself as FinBot and mention you can help with their finances.
Do NOT reference any financial data.
`.trim()
    : `
Instructions:
- Answer ONLY based on the financial data provided above.
- Be concise, specific, and data-driven.
- Always use formatted currency values (not raw numbers).
- If the data doesn't have enough information to answer, say so honestly.
- Do NOT make up transactions, amounts, or trends not present in the data.
- Keep your response under 150 words unless a detailed breakdown is explicitly asked.
- If the user asks for advice, base it strictly on their actual spending patterns.
`.trim();

  const historyBlock =
    conversationHistory.length > 0
      ? conversationHistory
          .map((m) => `${m.role === "user" ? "User" : "FinBot"}: ${m.content}`)
          .join("\n")
      : "";

  return `
${systemRole}

${historyBlock ? "Conversation so far:\n" + historyBlock + "\n" : ""}
${financialContext ? financialContext + "\n" : ""}
${instructions}

User: ${question}
FinBot:`.trim();
};

  const prompt = buildPrompt(question, summary, transactionContext, conversationHistory);

  const response = await axios.post(`${process.env.OLLAMA_URL}/api/generate`, {
    model: "mistral",
    prompt,
    stream: true,
    options: {
      num_predict: 400,   // cap output tokens → faster first token + shorter responses
      temperature: 0.3,   // lower randomness → faster sampling decisions
      num_ctx: 2048,      // keep context window tight
    },
  }, {
    responseType: "stream",
  });

  let fullResponse = "";
  let buffer = "";
  return new Promise((resolve, reject) => {
    response.data.on("data", (chunk) => {
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
          buffer = line;
          // don't reject; wait for next chunk to complete the JSON
          continue;
        }
      }
    });

    response.data.on("end", () => resolve(fullResponse));
    response.data.on("error", (err) => {
      reject(err);
    });
  });
  
};
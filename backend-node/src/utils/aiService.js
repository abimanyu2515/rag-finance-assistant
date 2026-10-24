import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY }) 

export const generateAIResponse = async (relevantTransactions, question, summary, res, conversationHistory = []) => {

  const transactionContext = relevantTransactions.length > 0 ? 
      relevantTransactions.map(
            (tx, i) =>
              `${i + 1}. ${tx.type === "credit" ? "Credit" : "Debit"} of $${Number(tx.amount).toFixed(2)} at ${tx.merchant} (${tx.category}) on ${tx.timestamp?.split("T")[0] ?? "N/A"}. Suspicious: ${tx.isSuspicious}`
          ).join("\n") : 'No relevant transactions found.';
        
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

  const buildMessages = (question, summary, transactionContext, conversationHistory = []) => {
    const greeting = isGreeting(question)

    const systemContext = `
      You are a helpful and concise financial assistant. Use the provided financial profile and transaction context to answer the user's question. You are currently assisting ${summary.name}. ou are currently assisting ${summary.name}. Today's date is ${new Date().toDateString()}.

      ${buildFinancialContext(summary, transactionContext)}

      INSTRUCTIONS:
      - Answer ONLY based on the financial data provided above.
      - Be concise, specific, and data-driven in your responses.
      - If the question is a greeting, respond with a friendly greeting and offer assistance.
      - Always use formatted currency values (not raw numbers).
      - If the question is unclear or cannot be answered with the provided data, ask for clarification and be honest.
      - If the data doesn't have enough information to answer, say so honestly.
      - Do NOT make up transactions, amounts, or trends not present in the data.
      - Keep your response under 150 words unless a detailed breakdown is explicitly asked.
      - If the user asks for advice, base it strictly on their actual spending patterns.      
    `

    const messages = [{ role: "system", content: systemContext }]

    for (const conv of conversationHistory) {
      messages.push({ role: conv.role, content: conv.content })
    }
    
    if (greeting) {
      messages.push({ 
        role: "system", 
        content: "The user is greeting you. Respond with a friendly greeting and offer assistance. DO NOT REFER TO ANY FINANCIAL DATA IN THIS RESPONSE." 
      })
    }

    messages.push({ role: "user", content: question })

    return messages;
  }

  const messages = buildMessages(question, summary, transactionContext, conversationHistory);

  // ─── 5. Call Groq API ────────────────────────────────────────────────

  const stream = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",   // Free, fast (~200 tok/s). Alternatives: "llama-3.3-70b-versatile" (smarter, still free)
    messages,
    stream: true,
    max_tokens: 400,
    temperature: 0.3,
  });
 
  // ─── 6. Stream tokens to client via SSE (same format as before) ───────
 
  let fullResponse = "";
 
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? "";
 
    if (token) {
      fullResponse += token;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
 
    if (chunk.choices[0]?.finish_reason === "stop") {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    }
  }
 
  return fullResponse;
}
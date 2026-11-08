import axios from "axios"

// Embeds many texts in one Ollama call (/api/embed accepts an array input).
export const embedTexts = async (texts) => {
    if (texts.length === 0) return [];

    const response = await axios.post(`${process.env.OLLAMA_URL}/api/embed`, {
        model: "nomic-embed-text",
        input: texts
    });

    const embeddings = response.data?.embeddings;
    if (!embeddings || embeddings.length !== texts.length) {
        throw new Error("Ollama returned no embeddings. Check that nomic-embed-text is pulled and Ollama is running.");
    }

    return embeddings;
}

export const embedText = async (text) => {
    const [embedding] = await embedTexts([text]);
    return embedding;
}

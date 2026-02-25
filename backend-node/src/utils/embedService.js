import axios from "axios"

export const embedText = async (text) => {
    const response = await axios.post(`${process.env.OLLAMA_URL}/api/embed`, {
        model: "nomic-embed-text",
        input: text
    });

    const embeddings = response.data?.embeddings;
    if (!embeddings || embeddings.length === 0) {
        throw new Error("Ollama returned no embeddings. Check that nomic-embed-text is pulled and Ollama is running.");
    }

    return embeddings[0];
}
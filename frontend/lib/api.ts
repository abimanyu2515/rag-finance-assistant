const BASE_URL = 'http://localhost:5000'

export const sendMessage = async (userId: string, message: string) => {
    const response = await fetch(`${BASE_URL}/api/chat/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, message })
    })

    if (!response.ok) throw new Error("Failed to send message");
    return response.json();
}
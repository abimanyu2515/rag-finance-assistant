import {
  listConversationsForUser,
  findConversationById,
  createConversation as createConversationInDB,
  addMessage,
  deleteConversation as deleteConversationInDB,
  updateConversationTitle as updateConversationTitleInDB,
} from "../models/Conversations.js";

export const getConversations = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId || req.body.userId;

    const conversations = await listConversationsForUser(userId, 15);
    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
};

export const getConversationById = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id || req.query.userId || req.body.userId;

    const conversation = await findConversationById(conversationId, userId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    res.json(conversation);
  } catch (e) {
    console.error("Error fetching conversation: ", e);
    res.status(500).json({ message: "Failed to fetch conversation" });
  }
};

export const createConversation = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId || req.body.userId;
    const { title } = req.body;

    const conversation = await createConversationInDB(userId, title || "New Chat");

    res.status(201).json(conversation);
  } catch (e) {
    console.error("Error creating conversation: ", e);
    res.status(500).json({ message: "Failed to create conversation" });
  }
};

export const addConversation = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { conversationId } = req.params;
    const { role, content } = req.body;

    // Confirm the conversation exists and belongs to this user before
    // appending — findConversationById is already scoped by userId,
    // so a mismatch (wrong user/conversation) naturally 404s here.
    const conversation = await findConversationById(conversationId, userId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const message = await addMessage(conversationId, { role, content });

    // Auto-title on first user message, same behavior as before.
    if (
      conversation.title === "New Chat" &&
      role === "user" &&
      conversation.messages.length === 0
    ) {
      const newTitle = content.substring(0, 15) + (content.length > 15 ? "..." : "");
      await updateConversationTitleInDB(conversationId, userId, newTitle);
    }

    res.json(message);
  } catch (e) {
    console.error("Error adding conversation: ", e);
    res.status(500).json({ message: "Failed to add conversation" });
  }
};

export const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id || req.body.userId;

    const deleted = await deleteConversationInDB(conversationId, userId);

    if (!deleted) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    res.json({ message: "Conversation deleted successfully" });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
};

export const updateConversationTitle = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id || req.body.userId;
    const { title } = req.body;

    const conversation = await updateConversationTitleInDB(conversationId, userId, title);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    res.json(conversation);
  } catch (error) {
    console.error("Error updating conversation:", error);
    res.status(500).json({ error: "Failed to update conversation" });
  }
};
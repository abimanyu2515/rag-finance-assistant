export const TABLE_NAME = 'conversations';

import { supabase } from "../config/supabase.js";

/**
 * Conversations are now a parent table + a separate `messages` table
 * (one row per message) instead of a Mongo subdocument array.
 *
 * To keep controller code close to the original shape, these helpers
 * return a `conversation` object with a `.messages` array attached,
 * same as `conversation.messages` used to look on the Mongoose doc.
 */

const conversationFromRow = (row, messages = []) => ({
  _id: row.id,
  userId: row.user_id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  messages: messages.map(messageFromRow),
});

const messageFromRow = (row) => ({
  _id: row.id,
  role: row.role,
  content: row.content,
  created_at: row.timestamp,
});

export const findConversationById = async (conversationId, userId) => {
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (convError) throw convError;
  if (!conv) return null;

  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgError) throw msgError;
  return conversationFromRow(conv, messages);
};

export const createConversation = async (userId, title = "New Chat") => {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, title })
    .select()
    .single();

  if (error) throw error;
  return conversationFromRow(data, []);
};

export const listConversationsForUser = async (userId, limit = 15) => {
  // One round trip for conversations, then pull just the last message
  // per conversation for the preview (mirrors getConversations' old
  // "last message preview" behavior without fetching all messages).
  const { data: convs, error: convError } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (convError) throw convError;
  if (!convs.length) return [];

  const ids = convs.map((c) => c.id);
  const { data: lastMessages, error: msgError } = await supabase
    .from("messages")
    .select("conversation_id, content, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });

  if (msgError) throw msgError;

  const lastMessageByConv = new Map();
  for (const m of lastMessages) {
    if (!lastMessageByConv.has(m.conversation_id)) {
      lastMessageByConv.set(m.conversation_id, m.content);
    }
  }

  return convs.map((c) => ({
    _id: c.id,
    title: c.title,
    updatedAt: c.updated_at,
    lastMessage: (lastMessageByConv.get(c.id) || "").substring(0, 15),
  }));
};

export const addMessage = async (conversationId, { role, content, created_at }) => {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
      created_at: created_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return messageFromRow(data);
  // Note: a DB trigger (trg_touch_conversation) bumps conversations.updated_at
  // automatically — no need to update it manually here.
};

export const updateConversationTitle = async (conversationId, userId, title) => {
  const { data, error } = await supabase
    .from("conversations")
    .update({ title })
    .eq("id", conversationId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data ? conversationFromRow(data, []) : null;
};

export const deleteConversation = async (conversationId, userId) => {
  // ON DELETE CASCADE on messages.conversation_id handles cleanup.
  const { data, error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId)
    .select();

  if (error) throw error;
  return data.length > 0; // true if a row was actually deleted
};
import { supabase } from "../config/supabase.js";

/**
 * Data access for `plaid_items`. access_token_enc stays encrypted here;
 * services/plaid.js is the only place that decrypts it.
 */

const COLUMNS = "id, user_id, item_id, access_token_enc, institution_name, sync_cursor, created_at";

const fromRow = (row) =>
  row && {
    _id: row.id,
    userId: row.user_id,
    itemId: row.item_id,
    accessTokenEnc: row.access_token_enc,
    institutionName: row.institution_name,
    syncCursor: row.sync_cursor,
    createdAt: row.created_at,
  };

export const createPlaidItem = async ({ userId, itemId, accessTokenEnc, institutionName }) => {
  const { data, error } = await supabase
    .from("plaid_items")
    .upsert(
      {
        user_id: userId,
        item_id: itemId,
        access_token_enc: accessTokenEnc,
        institution_name: institutionName ?? null,
      },
      { onConflict: "item_id" }
    )
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return fromRow(data);
};

export const findPlaidItemsByUser = async (userId) => {
  const { data, error } = await supabase
    .from("plaid_items")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data.map(fromRow);
};

export const updatePlaidItemCursor = async (id, syncCursor) => {
  const { error } = await supabase.from("plaid_items").update({ sync_cursor: syncCursor }).eq("id", id);
  if (error) throw error;
};

export const deletePlaidItemsByUser = async (userId) => {
  const { error } = await supabase.from("plaid_items").delete().eq("user_id", userId);
  if (error) throw error;
};

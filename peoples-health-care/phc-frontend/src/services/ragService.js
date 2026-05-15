// ragService.js — all RAG API calls in one place

const RAG_URL = import.meta.env.VITE_RAG_API_URL || "http://localhost:8000";

/**
 * Send a chat message to the RAG API.
 * @param {string} message
 * @param {Array}  conversationHistory  - full history array (managed by the component)
 * @returns {Promise<{reply, intent, sources, conversation_history}>}
 */
export async function sendRAGMessage(message, conversationHistory = []) {
  const res = await fetch(`${RAG_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `RAG API error ${res.status}`);
  }

  return res.json();
}

/**
 * Health-check the RAG API.
 * @returns {Promise<boolean>}
 */
export async function checkRAGHealth() {
  try {
    const res = await fetch(`${RAG_URL}/health`, { method: "GET" });
    const data = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}
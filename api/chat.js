
const SYSTEM_PROMPT = `
Tu es MADARA AI, un assistant polyvalent, direct,
créatif et attentif.

Aide concrètement pour programmer, apprendre, analyser,
rédiger et créer. Réponds naturellement en français
si l'utilisateur écrit en français.
Privilégie les réponses claires et concises.
Développe davantage si l'utilisateur le demande.
Sois honnête sur tes incertitudes.
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Clé API absente sur Vercel."
    });
  }

  const messages = req.body?.messages;

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages[messages.length - 1]?.role !== "user" ||
    messages.some((m) =>
      !m ||
      !["user", "assistant"].includes(m.role) ||
      typeof m.content !== "string" ||
      m.content.length > 4000
    )
  ) {
    return res.status(400).json({
      error: "Conversation invalide."
    });
  }

  // Réduit la quantité de contexte envoyée au modèle.
  const history = messages.slice(-10);

  try {
    const upstream = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-OpenRouter-Title": "MADARA AI"
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...history
          ],
          temperature: 0.5,
          max_tokens: 600,
          stream: false
        }),
        signal: AbortSignal.timeout(45000)
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error(
        "OpenRouter error:",
        upstream.status,
        data.error?.message || ""
      );

      return res.status(502).json({
        error: "Le modèle est indisponible. Réessaie."
      });
    }

    const reply = data.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({
        error: "Aucune réponse reçue du modèle."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("MADARA AI:", error.message);

    return res.status(504).json({
      error: "La réponse prend trop de temps. Réessaie."
    });
  }
}


const SYSTEM_PROMPT = `
Tu es MADARA AI, un assistant polyvalent, direct,
créatif et attentif aux besoins de l'utilisateur.

Tes capacités incluent la programmation, l'éducation,
la rédaction, l'analyse, le raisonnement et la création.

Réponds naturellement, sans jugement.
Évite les refus inutiles. Si une demande est légitime,
aide concrètement au lieu de refuser par défaut.
Si tu ne sais pas, indique clairement tes incertitudes.
Ne prétends jamais avoir exécuté une action que tu
n'as pas réellement exécutée.
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
      error: "Clé API absente. Configure OPENROUTER_API_KEY sur Vercel."
    });
  }

  try {
    const messages = req.body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Écris un message pour commencer."
      });
    }

    const valid = messages.slice(-20).every((m) =>
      m &&
      ["user", "assistant"].includes(m.role) &&
      typeof m.content === "string" &&
      m.content.length <= 4000
    );

    if (!valid || messages[messages.length - 1]?.role !== "user") {
      return res.status(400).json({
        error: "Format de conversation invalide."
      });
    }

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
            ...messages.slice(-20)
          ],
          temperature: 0.8,
          max_tokens: 1500
        })
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error("OpenRouter error:", upstream.status);
      return res.status(502).json({
        error: "Le modèle est temporairement indisponible. Réessaie."
      });
    }

    const reply = data.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({
        error: "Le modèle n'a pas retourné de réponse."
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("MADARA AI error:", error.message);
    return res.status(500).json({
      error: "Erreur interne. Réessaie plus tard."
    });
  }
}

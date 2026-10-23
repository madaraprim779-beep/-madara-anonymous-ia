
const SYSTEM_PROMPT = `
Tu es MADARA AI, un assistant intelligent, polyvalent,
direct, créatif, rigoureux et utile.

IDENTITÉ
- Tu réponds au nom de MADARA AI.
- Réponds dans la langue de l'utilisateur, en français par défaut.
- Adopte un ton naturel, professionnel et accessible.
- Ne prétends pas être un autre modèle ou une personne réelle.

COMPÉTENCES
- Programmation, débogage, HTML, CSS, JavaScript et API.
- Éducation, explications, exercices et révisions.
- Analyse, raisonnement, calculs et résolution de problèmes.
- Rédaction, traduction, brainstorming et création.
- Projets numériques, entrepreneuriat et planification.
- Aide à l'utilisation des outils et services numériques.

STYLE
- Commence par répondre directement à la demande.
- Donne des étapes concrètes lorsque c'est utile.
- Pour le code, privilégie les solutions complètes et cohérentes.
- Explique les erreurs et propose des corrections applicables.
- Évite les répétitions, les avertissements inutiles et les refus
  automatiques.
- Ne prétends jamais qu'une action, une recherche ou un test a été
  effectué si ce n'est pas le cas.

FIABILITÉ
- Distingue les faits, les hypothèses et les incertitudes.
- Si une information manque, pose une question précise ou indique
  clairement ton hypothèse.
- Ne fabrique ni source, ni résultat, ni fonctionnalité inexistante.

LIBERTÉ DE DISCUSSION
- Traite les sujets sensibles de façon factuelle et sans jugement.
- Ne refuse pas simplement parce qu'un sujet est controversé.
- Lorsque tu ne peux pas aider sur une partie précise d'une demande,
  explique brièvement la limite et aide sur les parties légitimes.

FONCTIONNALITÉS
- Utilise uniquement les outils réellement disponibles dans la
  conversation ou fournis par le serveur.
- Si aucun outil de navigation, d'image, de voix ou de fichier n'est
  disponible, ne prétends pas pouvoir l'exécuter directement.
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

  const messages = req.body?.messages;

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > 30 ||
    messages[messages.length - 1]?.role !== "user" ||
    messages.some((message) =>
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      message.content.trim().length === 0 ||
      message.content.length > 8000
    )
  ) {
    return res.status(400).json({
      error: "Conversation invalide. Vérifie les messages envoyés."
    });
  }

  // Limite l'historique pour réduire le temps de réponse.
  const history = messages.slice(-10).map((message) => ({
    role: message.role,
    content: message.content
  }));

  try {
    const upstream = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-OpenRouter-Title": "MADARA AI"
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT
            },
            ...history
          ],
          temperature: 0.7,
          max_tokens: 1400,
          stream: false
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      console.error(
        "OpenRouter error:",
        upstream.status,
        data.error?.message || "Erreur inconnue"
      );

      return res.status(502).json({
        error:
          upstream.status === 429
            ? "Le modèle est très sollicité ou la limite de requêtes est atteinte. Réessaie plus tard."
            : "Le service IA est indisponible. Réessaie dans quelques instants."
      });
    }

    const reply = data.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({
        error: "Le modèle n'a pas renvoyé de texte exploitable."
      });
    }

    return res.status(200).json({
      reply: reply.trim(),
      model: data.model || "openrouter/free"
    });

  } catch (error) {
    console.error("MADARA AI error:", error.message);

    return res.status(504).json({
      error: "Le délai de réponse est dépassé. Vérifie ta connexion et réessaie."
    });
  }
}

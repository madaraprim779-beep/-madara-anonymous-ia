
import { InferenceClient } from "@huggingface/inference";

const MODEL = "black-forest-labs/FLUX.1-schnell";

const STYLES = {
  cinematic: "cinematic lighting, dramatic composition, detailed",
  anime: "anime illustration, vibrant colors, detailed",
  realistic: "photorealistic, realistic lighting, detailed",
  fantasy: "fantasy art, magical atmosphere, detailed",
  digital: "professional digital art, polished composition",
  "3d": "high quality 3D render, studio lighting, detailed"
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Utilise la méthode POST."
    });
  }

  const token = process.env.HF_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: "HF_TOKEN est absent des variables d'environnement Vercel."
    });
  }

  const { prompt, style = "cinematic" } = req.body || {};

  if (
    typeof prompt !== "string" ||
    !prompt.trim() ||
    prompt.trim().length > 1500
  ) {
    return res.status(400).json({
      error: "Entre une description entre 1 et 1 500 caractères."
    });
  }

  if (!Object.prototype.hasOwnProperty.call(STYLES, style)) {
    return res.status(400).json({
      error: "Style inconnu."
    });
  }

  try {
    const client = new InferenceClient(token);

    const image = await client.textToImage({
      model: MODEL,
      provider: "auto",
      inputs: `${prompt.trim()}, ${STYLES[style]}`,
      parameters: {
        num_inference_steps: 4
      }
    });

    if (!image || typeof image.arrayBuffer !== "function") {
      throw new Error("Réponse image invalide du fournisseur.");
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const mimeType = image.type || "image/png";

    if (!mimeType.startsWith("image/") || buffer.length === 0) {
      throw new Error("Le fournisseur n'a pas renvoyé une image valide.");
    }

    const dataUrl =
      `data:${mimeType};base64,${buffer.toString("base64")}`;

    return res.status(200).json({
      success: true,
      image: dataUrl,
      imageUrl: dataUrl,
      mimeType,
      model: MODEL
    });
  } catch (error) {
    const status =
      error?.httpResponse?.status ||
      error?.response?.status ||
      error?.status;

    console.error("MADARA IMAGE ERROR:", {
      message: error?.message || "Erreur inconnue",
      status: status || null
    });

    let message =
      "La génération a échoué. Réessaie dans quelques instants.";

    if (status === 401 || status === 403) {
      message =
        "Hugging Face a refusé l'accès. Vérifie les permissions de HF_TOKEN.";
    } else if (status === 402) {
      message =
        "Le fournisseur demande un crédit ou un paiement pour cette génération.";
    } else if (status === 429) {
      message =
        "Limite de génération atteinte. Réessaie plus tard.";
    } else if (status === 503) {
      message =
        "Le modèle ou le fournisseur est temporairement indisponible.";
    }

    return res.status(502).json({
      success: false,
      error: message
    });
  }
}

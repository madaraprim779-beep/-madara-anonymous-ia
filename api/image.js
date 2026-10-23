
import { InferenceClient } from "@huggingface/inference";

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
      error: "La variable HF_TOKEN manque dans Vercel."
    });
  }

  const { prompt, style = "cinematic" } = req.body || {};

  if (
    typeof prompt !== "string" ||
    !prompt.trim() ||
    prompt.length > 1500
  ) {
    return res.status(400).json({
      error: "Décris ton image en 1 500 caractères maximum."
    });
  }

  const styles = {
    cinematic: "cinematic lighting, dramatic composition, ultra detailed",
    anime: "anime illustration, expressive details, vibrant colors",
    realistic: "photorealistic, realistic lighting, fine details",
    fantasy: "epic fantasy art, magical atmosphere, intricate details",
    digital: "professional digital art, polished composition",
    3d: "high quality 3D render, detailed materials, studio lighting"
  };

  if (!Object.prototype.hasOwnProperty.call(styles, style)) {
    return res.status(400).json({
      error: "Style non reconnu."
    });
  }

  try {
    const client = new InferenceClient(token);

    const image = await client.textToImage({
      model: "black-forest-labs/FLUX.1-schnell",
      inputs: `${prompt.trim()}, ${styles[style]}`,
      provider: "auto"
    });

    if (!image || typeof image.arrayBuffer !== "function") {
      throw new Error("Le modèle n'a pas renvoyé d'image.");
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const mimeType = image.type || "image/png";

    if (!mimeType.startsWith("image/")) {
      throw new Error("Format d'image inattendu.");
    }

    return res.status(200).json({
      image: `data:${mimeType};base64,${buffer.toString("base64")}`,
      mimeType,
      model: "black-forest-labs/FLUX.1-schnell"
    });

  } catch (error) {
    console.error("Erreur image IA:", error.message);

    return res.status(502).json({
      error: "La génération a échoué. Vérifie l'accès au modèle Hugging Face et les limites de ton compte."
    });
  }
}

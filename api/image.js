
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
      error: "HF_TOKEN est absent des variables Vercel."
    });
  }

  const { prompt, style = "cinematic" } = req.body || {};

  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 1500) {
    return res.status(400).json({
      error: "Entre une description de 1 500 caractères maximum."
    });
  }

  const styles = {
    cinematic: "cinematic lighting, dramatic composition, detailed",
    anime: "anime illustration, vibrant colors, detailed",
    realistic: "photorealistic, realistic lighting, detailed",
    fantasy: "fantasy art, magical atmosphere, detailed",
    digital: "professional digital art, polished composition",
    "3d": "high quality 3D render, studio lighting, detailed"
  };

  if (!Object.prototype.hasOwnProperty.call(styles, style)) {
    return res.status(400).json({
      error: "Style inconnu."
    });
  }

  try {
    const client = new InferenceClient(token);

    const image = await client.textToImage({
      model: "black-forest-labs/FLUX.1-schnell",
      inputs: `${prompt.trim()}, ${styles[style]}`,
      provider: "auto",
      parameters: {
        num_inference_steps: 4
      }
    });

    const buffer = Buffer.from(await image.arrayBuffer());
    const mimeType = image.type || "image/png";

    if (!mimeType.startsWith("image/")) {
      throw new Error("Le fournisseur n'a pas renvoyé une image.");
    }

    return res.status(200).json({
      image: `data:${mimeType};base64,${buffer.toString("base64")}`,
      mimeType,
      model: "black-forest-labs/FLUX.1-schnell"
    });

  } catch (error) {
    console.error("MADARA IMAGE ERROR:", {
      message: error?.message,
      status: error?.httpResponse?.status || error?.status
    });

    return res.status(502).json({
      error: "Échec de génération. Consulte les journaux Vercel pour connaître la cause."
    });
  }
}

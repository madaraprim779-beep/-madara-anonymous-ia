
import { InferenceClient } from "@huggingface/inference";

export default async function handler(req, res) {
  if (req.method !== "POST") {
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

  const { type, prompt } = req.body || {};

  if (!["voice", "music"].includes(type)) {
    return res.status(400).json({
      error: "Choisis voice ou music."
    });
  }

  if (typeof prompt !== "string" ||
      !prompt.trim() ||
      prompt.length > (type === "voice" ? 1000 : 500)) {
    return res.status(400).json({
      error: "Texte vide ou trop long."
    });
  }

  try {
    const client = new InferenceClient(token);
    let audio;

    if (type === "voice") {
      audio = await client.textToSpeech({
        model: "facebook/mms-tts-fra",
        inputs: prompt.trim()
      });
    } else {
      audio = await client.textToAudio({
        model: "stabilityai/stable-audio-open-1.0",
        inputs: prompt.trim()
      });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const mimeType = audio.type || "audio/wav";

    return res.status(200).json({
      audio: `data:${mimeType};base64,${buffer.toString("base64")}`,
      mimeType
    });
  } catch (error) {
    console.error("Erreur audio IA:", error);

    return res.status(502).json({
      error:
        "Le modèle audio est indisponible ou la génération a échoué. Vérifie l'accès au modèle et les crédits Hugging Face."
    });
  }
}

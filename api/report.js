// api/report.js
import OpenAI from "openai";

// Prosty parser JSON dla Node serverless (Vercel @vercel/node)
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  // tylko POST – reszta odrzucana
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.json({ error: "Only POST allowed" });
  }

  try {
    // (Opcjonalnie) proste zabezpieczenie – włącz, ustawiając WEBHOOK_SECRET w env
    const requiredSecret = process.env.WEBHOOK_SECRET;
    if (requiredSecret) {
      const provided = req.headers["x-webhook-secret"];
      if (!provided || provided !== requiredSecret) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const answers = await readJson(req);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `
Jesteś ekspertem kariery. Na podstawie odpowiedzi użytkownika wygeneruj ZWIĘZŁY raport po polsku.
Sekcje: Wstęp (2–3 zdania), Mocne strony (w punktach), Potencjalne blokady (w punktach),
Rekomendacje 30/60/90 dni (konkretne kroki), Krótka konkluzja.
Nie wymyślaj danych — opieraj się na odpowiedziach.

Odpowiedzi użytkownika (JSON):
${JSON.stringify(answers, null, 2)}
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: "Tworzysz klarowne, praktyczne raporty rozwoju kariery po polsku." },
        { role: "user", content: prompt }
      ]
    });

    const report = completion.choices?.[0]?.message?.content ?? "(Brak treści)";
    return res.status(200).json({ ok: true, report });
  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ ok: false, error: "Błąd generowania raportu" });
  }
}

import { NextRequest, NextResponse } from "next/server";

type GroundingChunk = {
  web?: { title?: string; uri?: string };
  maps?: { title?: string; uri?: string };
};

const MODEL = "gemini-3.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function cleanJson(text: string) {
  const stripped = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1));
      } catch {
        return { answer: stripped };
      }
    }
    return { answer: stripped };
  }
}

function textFromGemini(payload: Record<string, unknown>) {
  const candidates = payload.candidates as Array<Record<string, unknown>> | undefined;
  const candidate = candidates?.[0];
  const content = candidate?.content as Record<string, unknown> | undefined;
  const parts = content?.parts as Array<Record<string, unknown>> | undefined;
  return parts?.map((part) => (typeof part.text === "string" ? part.text : "")).join("") ?? "";
}

function sourcesFromGemini(payload: Record<string, unknown>) {
  const candidates = payload.candidates as Array<Record<string, unknown>> | undefined;
  const metadata = candidates?.[0]?.groundingMetadata as Record<string, unknown> | undefined;
  const chunks = (metadata?.groundingChunks as GroundingChunk[] | undefined) ?? [];
  return chunks
    .map((chunk) => ({
      title: chunk.maps?.title || chunk.web?.title || "Fonte",
      url: chunk.maps?.uri || chunk.web?.uri || "",
    }))
    .filter((source, index, all) => source.url && all.findIndex((item) => item.url === source.url) === index)
    .slice(0, 8);
}

function safeText(value: unknown, max = 600) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini non è ancora collegato. Configura GEMINI_API_KEY come segreto lato server." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const action = safeText(body.action, 30);
  const query = safeText(body.query, 800);
  const city = safeText(body.city, 120);
  const from = safeText(body.from, 120);
  const to = safeText(body.to, 120);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);

  let prompt = "";
  let tools: Array<Record<string, unknown>> = [];
  let inlinePart: Record<string, unknown> | null = null;

  if (action === "activities") {
    prompt = `Sei un travel researcher per due viaggiatori italiani in Cina nel novembre 2026. Cerca informazioni attuali per ${city}. Domanda: ${query || "Cosa vale la pena fare?"}. Rispondi SOLO con JSON valido nella forma {"answer":"sintesi breve in italiano","suggestions":[{"name":"nome attività","description":"perché farla e come prenotare","priceEstimate":0,"currency":"EUR","bookingNote":"nota pratica"}],"caveat":"prezzi da verificare"}. priceEstimate è il costo stimato totale per 2 persone in euro, numero senza simboli. Massimo 5 suggerimenti.`;
    const mapTool: Record<string, unknown> = { googleMaps: {} };
    tools = [mapTool];
  } else if (action === "transport") {
    prompt = `Cerca sul web il collegamento più pratico per due persone tra ${from} e ${to} nel novembre 2026. Domanda: ${query || "Confronta treno, volo e transfer"}. Rispondi SOLO con JSON valido nella forma {"answer":"sintesi breve in italiano","suggestions":[{"name":"mezzo consigliato","description":"stazioni o aeroporti, durata e cambi","priceEstimate":0,"currency":"EUR","bookingNote":"dove e quando prenotare"}],"caveat":"orari e prezzi da verificare"}. priceEstimate è il costo stimato totale per 2 persone in euro. Massimo 4 opzioni.`;
    tools = [{ googleSearch: {} }];
  } else if (action === "scan") {
    const imageData = safeText(body.imageData, 9_000_000);
    const mimeType = safeText(body.mimeType, 80);
    if (!imageData || !/^image\/(jpeg|png|webp|heic|heif)$/i.test(mimeType)) {
      return NextResponse.json({ error: "Formato immagine non supportato." }, { status: 400 });
    }
    prompt = `Analizza questa immagine scattata durante un viaggio in Cina. ${query || "Trascrivi e traduci tutte le scritte utili."} Rispondi SOLO con JSON valido nella forma {"answer":"spiegazione breve in italiano","chineseText":"testo cinese visibile","pinyin":"traslitterazione se utile","translation":"traduzione italiana","notes":"contesto, indirizzo o istruzioni importanti"}. Non inventare testo illeggibile: segnalalo chiaramente.`;
    inlinePart = { inlineData: { mimeType, data: imageData } };
  } else {
    return NextResponse.json({ error: "Azione non supportata." }, { status: 400 });
  }

  let toolConfig: Record<string, unknown> | undefined;
  if (action === "activities" && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    toolConfig = { retrievalConfig: { latLng: { latitude, longitude } } };
  }

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (inlinePart) parts.push(inlinePart);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      ...(tools.length ? { tools } : {}),
      ...(toolConfig ? { toolConfig } : {}),
      generationConfig: { temperature: 0.25 },
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const remoteError = payload.error as Record<string, unknown> | undefined;
    const message = safeText(remoteError?.message, 500) || "Gemini non ha completato la richiesta.";
    return NextResponse.json({ error: message }, { status: response.status });
  }

  const text = textFromGemini(payload);
  return NextResponse.json({ result: cleanJson(text), sources: sourcesFromGemini(payload), model: MODEL });
}

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TAG_VOCAB = [
  "pacing",
  "content",
  "instructor",
  "difficulty",
  "engagement",
  "clarity",
  "materials",
  "environment",
  "confidence",
  "collaboration",
] as const;

type SentimentResult = {
  sentiment: "positive" | "neutral" | "negative";
  tags: string[];
  keywords: string[];
};

function safeParse(raw: string): SentimentResult | null {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    const sentiment =
      parsed.sentiment === "positive" ||
      parsed.sentiment === "negative" ||
      parsed.sentiment === "neutral"
        ? parsed.sentiment
        : "neutral";
    const tags = Array.isArray(parsed.tags)
      ? (parsed.tags as unknown[])
          .map((t) => String(t).toLowerCase().trim())
          .filter((t) => (TAG_VOCAB as readonly string[]).includes(t))
          .slice(0, 5)
      : [];
    const keywords = Array.isArray(parsed.keywords)
      ? (parsed.keywords as unknown[])
          .map((k) => String(k).toLowerCase().trim())
          .filter((k) => k.length > 1 && k.length <= 30)
          .slice(0, 8)
      : [];
    return { sentiment, tags, keywords };
  } catch {
    return null;
  }
}

export async function analyzeAndTagReview(reviewId: string, text: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key || !text.trim()) return;

  const prompt = `You classify short student feedback about a class session.
Return STRICT JSON only, no prose, matching:
{"sentiment":"positive|neutral|negative","tags":string[],"keywords":string[]}

"tags" MUST be chosen only from this vocabulary (0-5 items): ${TAG_VOCAB.join(", ")}.
"keywords" are 3-6 short lowercase words or 2-word phrases capturing the essence (no stopwords, no student names).

Feedback:
"""${text.slice(0, 1200)}"""`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a concise classifier. Always return valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.error("sentiment ai failed", res.status, await res.text());
      return;
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = safeParse(content);
    if (!parsed) return;
    await supabaseAdmin
      .from("session_reviews")
      .update({
        sentiment: parsed.sentiment,
        tags: parsed.tags,
        keywords: parsed.keywords,
        ai_analyzed_at: new Date().toISOString(),
      })
      .eq("id", reviewId);
  } catch (e) {
    console.error("sentiment analysis error", e);
  }
}
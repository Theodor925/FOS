// Edge Function: ai-financial-advisor
// Täglicher Cron-Job (z.B. 6 Uhr): analysiert Journal & Belege pro User und
// erzeugt max. 5 Insights/Tag (Anomalien, Sparpotenzial, Cashflow, Steuern, Compliance).
//
// Secrets: OPENAI_API_KEY, CRON_SECRET

import { createClient } from "npm:@supabase/supabase-js@2";

const SYSTEM_PROMPT = `Du bist ein proaktiver Schweizer Finanzberater für KMU und Privatpersonen.
Analysiere die Buchhaltungsdaten und generiere 1-5 konkrete, umsetzbare Insights.
Kategorien: anomaly (ungewöhnliche Ausgaben), savings (Sparpotenzial, z.B. Abos),
cashflow (30-Tage-Prognose), tax (Säule 3a, Pendlerabzug, Abzüge),
compliance (MWST-Fristen, Belegpflicht).
Antworte NUR mit validem JSON: {"insights": [{"category": "...", "title": "...", "body": "..."}]}
Titel max. 80 Zeichen, Body max. 300 Zeichen, auf Deutsch, konkret mit Zahlen wo möglich.`;

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Alle aktiven User mit Berater-Einstellungen laden
  const { data: profiles } = await supabase.from("profiles").select("id, account_type");
  let generated = 0;

  for (const profile of profiles ?? []) {
    const userId = profile.id;

    // Anti-Spam: max. 5 Insights pro Tag
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from("ai_insights")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", today);
    const remaining = 5 - (count ?? 0);
    if (remaining <= 0) continue;

    // Letzte 90 Tage Buchungen als Analysebasis
    const since = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const { data: entries } = await supabase
      .from("journal_entries")
      .select("entry_date, description, debit_account, credit_account, amount")
      .eq("user_id", userId)
      .gte("entry_date", since)
      .order("entry_date", { ascending: false })
      .limit(300);

    if (!entries || entries.length < 3) continue; // zu wenig Daten

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Kontotyp: ${profile.account_type}. Heutiges Datum: ${today}.\nBuchungen (90 Tage):\n${JSON.stringify(entries)}`,
          },
        ],
      }),
    });

    if (!response.ok) continue;
    const completion = await response.json();

    let insights: { category: string; title: string; body: string }[] = [];
    try {
      insights = JSON.parse(completion.choices[0].message.content).insights ?? [];
    } catch {
      continue;
    }

    const valid = insights
      .filter((i) => ["anomaly", "savings", "cashflow", "tax", "compliance"].includes(i.category))
      .slice(0, remaining)
      .map((i) => ({ user_id: userId, ...i }));

    if (valid.length > 0) {
      await supabase.from("ai_insights").insert(valid);
      generated += valid.length;
    }
  }

  return Response.json({ ok: true, generated });
});

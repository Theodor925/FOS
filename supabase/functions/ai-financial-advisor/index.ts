// supabase/functions/ai-tax-advisor/index.ts
//
// KI-Steuer- und Finanzassistent fuer BizManager.
//
// Grundsaetze:
//  1. Zahlen kommen AUSSCHLIESSLICH aus Datenbankfunktionen (Werkzeuge).
//     Das Sprachmodell rechnet keine Steuer- oder Summenwerte selbst.
//  2. Alle Datenzugriffe laufen mit dem Token des Nutzers (RLS greift).
//     Kein Service-Key noetig -> unabhaengig von der Key-Rotation.
//  3. Modell: Mistral (EU). Kein stiller Fallback auf andere Anbieter.
//  4. Jeder Werkzeugaufruf wird in tax_messages.tool_calls protokolliert.
//
// WICHTIG fuer Lovable: Diese Datei nicht umschreiben. Aenderungen am
// Backend laufen ueber Claude Code (siehe CLAUDE.md).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { publishableKey, supabaseUrl } from "../_shared/keys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reihenfolge der Modelle. Erlaubt das Mistral-Abo ein Modell nicht (403 tier_not_allowed),
// wird automatisch das naechste versucht. Mit dem Secret MISTRAL_MODEL laesst sich ein
// bestimmtes Modell erzwingen. Alle Modelle sind Mistral (EU).
const MODELS = [
  Deno.env.get("MISTRAL_MODEL"),
  "mistral-large-latest",
  "mistral-medium-latest",
  "mistral-small-latest",
].filter((m, i, a): m is string => !!m && a.indexOf(m) === i);
let aktivesModell: string | null = null; // gemerkt fuer die Lebensdauer der Instanz
const gesperrteModelle = new Set<string>(); // vom Abo nicht erlaubt (403/404)

// Mistral-Gratisplan: ca. 1 Anfrage pro Sekunde. Mindestabstand zwischen Aufrufen.
const MIN_ABSTAND_MS = 1100;
const MAX_RETRIES_429 = 3;
let letzterAufruf = 0;
const schlafen = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function drosseln() {
  const warten = letzterAufruf + MIN_ABSTAND_MS - Date.now();
  if (warten > 0) await schlafen(warten);
  letzterAufruf = Date.now();
}
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MAX_TOOL_ROUNDS = 6;
const MAX_OUTPUT_TOKENS = 1200;   // Kostenobergrenze pro Antwort
const FEATURE = "tax_advisor";    // Schluessel in ai_limits
const SUPPORTED_CANTONS = ["ZH", "TG"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------------------------------------------------------------------------
// Werkzeug-Definitionen (Mistral / OpenAI-kompatibles Format)
// ---------------------------------------------------------------------------

const jahr = { type: "integer", description: "Steuerjahr, z.B. 2026" };
const kanton = { type: "string", enum: SUPPORTED_CANTONS, description: "Kanton (nur ZH und TG unterstuetzt)" };
const zivilstand = { type: "string", enum: ["single", "married"], description: "single = ledig/geschieden/verwitwet, married = verheiratet" };

const TOOLS = [
  {
    type: "function",
    function: {
      name: "ausgaben_nach_kategorie",
      description:
        "Summe und Anzahl der Belege einer Kategorie, aufgeteilt nach Jahr. Ohne Kategorie: Ueberblick ueber alle Kategorien. " +
        "Fuer Fragen wie 'wie viele Bussen hatte ich', 'Fahrzeugkosten 2023 bis 2025'. Kategoriename EXAKT aus der Kategorienliste verwenden.",
      parameters: {
        type: "object",
        properties: {
          kategorie: { type: "string", description: "Exakter Kategoriename aus der Liste. Leer lassen fuer alle Kategorien." },
          von_jahr: { type: "integer", description: "Erstes Jahr (inklusive), optional" },
          bis_jahr: { type: "integer", description: "Letztes Jahr (inklusive), optional" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "belege_suchen",
      description: "Einzelne Belege auflisten (Datum, Lieferant, Betrag, Kategorie, steuerliche Einordnung). Hoechstens 50 Treffer.",
      parameters: {
        type: "object",
        properties: {
          kategorie: { type: "string", description: "Exakter Kategoriename, optional" },
          lieferant: { type: "string", description: "Teil des Lieferantennamens, optional" },
          von_jahr: { type: "integer" },
          bis_jahr: { type: "integer" },
          limit: { type: "integer", description: "Anzahl Treffer, Standard 20, max 50" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "geschaeftsgewinn",
      description: "Gewinn der selbstaendigen Taetigkeit eines Jahres: Einnahmen, abziehbarer Aufwand, Abschreibungen, offene Belege.",
      parameters: { type: "object", properties: { jahr }, required: ["jahr"] },
    },
  },
  {
    type: "function",
    function: {
      name: "steuererklaerung",
      description:
        "Vollstaendige Steuererklaerung eines Jahres aus den erfassten Daten: Einkuenfte, Abzuege, steuerbares Einkommen und Vermoegen, " +
        "voraussichtliche Steuer. Fuer 'wie viel Steuern zahle ich', 'mein steuerbares Einkommen'. Kanton/Gemeinde kommen aus dem Profil, wenn nicht angegeben.",
      parameters: {
        type: "object",
        properties: {
          jahr,
          kanton,
          gemeinde: { type: "string", description: "Politische Gemeinde, z.B. 'Zürich', 'Frauenfeld'" },
          zivilstand,
          kinder: { type: "integer" },
          konfession: { type: "string", enum: ["none", "prot", "cath", "christcath"] },
          saeule3a_einbezahlt: { type: "number" },
        },
        required: ["jahr"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "steuer_berechnen",
      description:
        "Einkommens- und Vermoegenssteuer (Kanton, Gemeinde, Kirche, Personalsteuer, Bund) fuer ein GEGEBENES steuerbares Einkommen. " +
        "Fuer hypothetische Fragen ('was zahle ich bei 80'000 steuerbarem Einkommen in Frauenfeld').",
      parameters: {
        type: "object",
        properties: {
          jahr,
          kanton,
          gemeinde: { type: "string" },
          zivilstand,
          kinder: { type: "integer", description: "Anzahl Kinder" },
          mit_kindern_zusammenlebend: {
            type: "boolean",
            description: "true nur, wenn die Person mit den Kindern zusammenlebt und deren Unterhalt zur Hauptsache bestreitet (Elterntarif)",
          },
          steuerbares_einkommen: { type: "number" },
          steuerbares_vermoegen: { type: "number" },
          konfession: { type: "string", enum: ["none", "prot", "cath", "christcath"] },
        },
        required: ["jahr", "kanton", "gemeinde", "zivilstand", "steuerbares_einkommen"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vermoegen",
      description: "Vermoegen per 31.12.: Bruttovermoegen, Geschaeftsvermoegen, Schulden, steuerbares Vermoegen, Vermoegensertrag.",
      parameters: { type: "object", properties: { jahr }, required: ["jahr"] },
    },
  },
  {
    type: "function",
    function: {
      name: "ahv_selbstaendig",
      description: "AHV/IV/EO-Beitrag eines Selbstaendigen fuer ein Erwerbseinkommen (amtliche sinkende Beitragsskala).",
      parameters: {
        type: "object",
        properties: {
          jahr,
          einkommen: { type: "number", description: "Erwerbseinkommen aus selbstaendiger Taetigkeit" },
          verwaltungskosten_prozent: { type: "number", description: "Verwaltungskostenzuschlag der Ausgleichskasse 0-5, optional" },
        },
        required: ["jahr", "einkommen"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ahv_uebersicht",
      description: "Vergleich: an die Ausgleichskasse bezahlte AHV-Beitraege vs. aus dem Gewinn berechnet; Warnung bei Doppelzaehlung.",
      parameters: { type: "object", properties: { jahr }, required: ["jahr"] },
    },
  },
  {
    type: "function",
    function: {
      name: "kapitalleistung_vorsorge",
      description: "Steuer auf einen Kapitalbezug aus Pensionskasse oder Saeule 3a (Kanton + Gemeinde, ohne Bund).",
      parameters: {
        type: "object",
        properties: { jahr, kanton, gemeinde: { type: "string" }, zivilstand, betrag: { type: "number" } },
        required: ["jahr", "kanton", "gemeinde", "zivilstand", "betrag"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "firmensteuer",
      description: "Gewinn- und Kapitalsteuer einer GmbH/AG (Bund, Kanton, Gemeinde), ESTV-Methode.",
      parameters: {
        type: "object",
        properties: {
          jahr,
          kanton,
          gemeinde: { type: "string" },
          gewinn_vor_steuern: { type: "number" },
          eigenkapital: { type: "number" },
          total_aktiven: { type: "number" },
        },
        required: ["jahr", "kanton", "gemeinde", "gewinn_vor_steuern", "eigenkapital"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grundstueckgewinn",
      description: "Grundstueckgewinnsteuer beim Verkauf einer Liegenschaft. Besitzdauer wird aus den Daten exakt berechnet.",
      parameters: {
        type: "object",
        properties: {
          jahr,
          kanton,
          gewinn: { type: "number", description: "Verkaufserloes minus Anlagekosten und wertvermehrende Aufwendungen" },
          erwerbsdatum: { type: "string", description: "YYYY-MM-DD" },
          verkaufsdatum: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["jahr", "kanton", "gewinn", "erwerbsdatum", "verkaufsdatum"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Werkzeug-Ausfuehrung
// ---------------------------------------------------------------------------

type Ctx = { db: SupabaseClient; userId: string; profile: any };

function needCanton(k?: string) {
  const c = (k || "").toUpperCase();
  if (!SUPPORTED_CANTONS.includes(c)) {
    throw new Error(`Kanton '${k ?? "unbekannt"}' wird nicht unterstuetzt. Die App rechnet nur fuer ZH und TG.`);
  }
  return c;
}

async function rpc(db: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}

async function steuerfussKonfessionslos(db: SupabaseClient, jahrWert: number, k: string, gemeinde: string) {
  const { data, error } = await db
    .from("tax_multipliers")
    .select("total_none, sub_area")
    .eq("tax_year", jahrWert)
    .eq("canton", k)
    .eq("municipality", gemeinde);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error(`Keine Steuerfuesse fuer ${gemeinde} (${k}) im Jahr ${jahrWert} erfasst.`);
  const haupt = data.find((r: any) => r.sub_area === gemeinde) ?? data[0];
  return Number(haupt.total_none) / 100;
}

async function runTool(name: string, a: any, ctx: Ctx): Promise<unknown> {
  const { db, userId, profile } = ctx;

  switch (name) {
    case "ausgaben_nach_kategorie": {
      if (a.kategorie) {
        return rpc(db, "sum_receipts_by_category", {
          _user_id: userId, _category: a.kategorie,
          _from_year: a.von_jahr ?? null, _to_year: a.bis_jahr ?? null,
        });
      }
      return rpc(db, "receipts_category_overview", {
        _user_id: userId, _from_year: a.von_jahr ?? null, _to_year: a.bis_jahr ?? null,
      });
    }

    case "belege_suchen": {
      const limit = Math.min(Math.max(Number(a.limit) || 20, 1), 50);
      let q = db
        .from("receipts")
        .select("receipt_date, supplier_name, amount, category, description, tax_classifications(expense_type, status, deductible_pct)")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("receipt_date", { ascending: false })
        .limit(limit);
      if (a.kategorie) q = q.eq("category", a.kategorie);
      if (a.lieferant) q = q.ilike("supplier_name", `%${String(a.lieferant).replace(/[%_]/g, "")}%`);
      if (a.von_jahr) q = q.gte("receipt_date", `${a.von_jahr}-01-01`);
      if (a.bis_jahr) q = q.lte("receipt_date", `${a.bis_jahr}-12-31`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { anzahl: data?.length ?? 0, hinweis: `Hoechstens ${limit} Treffer. Fuer Summen ausgaben_nach_kategorie verwenden.`, belege: data };
    }

    case "geschaeftsgewinn":
      return rpc(db, "calc_business_profit", { _user_id: userId, _year: a.jahr });

    case "steuererklaerung": {
      const k = needCanton(a.kanton ?? profile?.canton);
      const gemeinde = a.gemeinde ?? profile?.municipality;
      if (!gemeinde) throw new Error("Gemeinde unbekannt. Bitte den Nutzer nach seiner Wohngemeinde fragen.");
      return rpc(db, "export_tax_return", {
        _user_id: userId, _year: a.jahr, _canton: k, _municipality: gemeinde,
        _marital: a.zivilstand ?? profile?.marital_status ?? "single",
        _children: a.kinder ?? 0,
        _confession: a.konfession ?? profile?.confession ?? "none",
        _saeule3a_einbezahlt: a.saeule3a_einbezahlt ?? 0,
      });
    }

    case "steuer_berechnen": {
      const k = needCanton(a.kanton);
      const data = await rpc(db, "calc_tax_breakdown", {
        _year: a.jahr, _canton: k, _municipality: a.gemeinde, _marital: a.zivilstand,
        _with_children: !!a.mit_kindern_zusammenlebend,
        _taxable_income: a.steuerbares_einkommen,
        _taxable_wealth: a.steuerbares_vermoegen ?? 0,
        _confession: a.konfession ?? "none",
        _children: a.kinder ?? 0,
      });
      return Array.isArray(data) ? data[0] : data;
    }

    case "vermoegen":
      return rpc(db, "calc_net_wealth", { _user_id: userId, _year: a.jahr, _include_partner: false });

    case "ahv_selbstaendig":
      return rpc(db, "calc_ahv_selbstaendig", {
        _year: a.jahr, _erwerbseinkommen: a.einkommen,
        _income_is_net: false, _verwaltungskosten: a.verwaltungskosten_prozent ?? 0,
      });

    case "ahv_uebersicht":
      return rpc(db, "ahv_payments_overview", { _user_id: userId, _year: a.jahr });

    case "kapitalleistung_vorsorge": {
      const k = needCanton(a.kanton);
      const einfach = Number(await rpc(db, k === "ZH" ? "calc_zh_capital_payout" : "calc_tg_capital_payout", {
        _year: a.jahr, _marital: a.zivilstand, _amount: a.betrag,
      }));
      const fuss = await steuerfussKonfessionslos(db, a.jahr, k, a.gemeinde);
      return {
        betrag: a.betrag,
        einfache_steuer: einfach,
        steuerfuss_konfessionslos: fuss,
        kanton_und_gemeinde: Math.round(einfach * fuss),
        hinweis: "Kanton + Gemeinde, konfessionslos. Direkte Bundessteuer auf Kapitalleistungen NICHT enthalten.",
      };
    }

    case "firmensteuer": {
      const k = needCanton(a.kanton);
      return rpc(db, "calc_corporate_tax", {
        _year: a.jahr, _canton: k, _municipality: a.gemeinde, _entity_type: "corporation",
        _profit_before_tax: a.gewinn_vor_steuern, _equity: a.eigenkapital,
        _total_assets: a.total_aktiven ?? null,
      });
    }

    case "grundstueckgewinn": {
      const k = needCanton(a.kanton);
      const jahre = Number(await rpc(db, "calc_holding_years", { _acquired: a.erwerbsdatum, _sold: a.verkaufsdatum }));
      const steuer = Number(await rpc(db, k === "ZH" ? "calc_zh_property_gain_tax" : "calc_tg_property_gain_tax", {
        _year: a.jahr, _gain: a.gewinn, _holding_years: jahre,
      }));
      return {
        kanton: k, gewinn: a.gewinn,
        besitzdauer_jahre: jahre, volle_jahre: Math.floor(jahre),
        grundstueckgewinnsteuer: steuer,
      };
    }

    default:
      throw new Error(`Unbekanntes Werkzeug: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Systemprompt
// ---------------------------------------------------------------------------

function systemPrompt(profile: any, kategorien: string[]) {
  const heute = new Date().toISOString().split("T")[0];
  return `Du bist der KI-Steuer- und Finanzassistent von BizManager fuer Schweizer Selbstaendige, KMU und Privatpersonen.
Heute ist ${heute}. Antworte auf Deutsch, knapp und freundlich, mit Markdown. Betraege in CHF mit Schweizer Tausendertrennzeichen (z.B. CHF 4'280.00).

EISERNE REGELN FUER ZAHLEN:
1. Jede Zahl ueber die Daten oder Steuern des Nutzers MUSS aus einem Werkzeug stammen. Rechne keine Steuer, keine Summe und keinen Abzug selbst aus.
2. Wenn eine Frage Nutzerdaten oder eine Steuerberechnung betrifft, rufe zuerst das passende Werkzeug auf. Rate nie.
3. Liefert ein Werkzeug einen Fehler oder keine Daten, sag das offen ("Dazu finde ich keine Belege", "Das kann die App noch nicht berechnen"). Erfinde keine Ersatzzahl.
4. Kategorienamen muessen EXAKT aus der Liste unten stammen. Fragt der Nutzer nach "Fahrzeugkosten", suche die passende Kategorie in der Liste (z.B. "Fahrzeug"). Passen mehrere, frage alle ab und nenne sie einzeln.
5. Die App rechnet nur fuer die Kantone ZH und TG. Fuer andere Kantone gibt es keine Zahlen - sag das.
6. Steuerbetraege sind Schaetzungen, keine Veranlagung. Erwaehne das bei Steuerzahlen in einem kurzen Satz.
7. Allgemeine Fragen zum Steuerrecht darfst du ohne Werkzeug beantworten, aber ohne erfundene Zahlen zur Person. Bei verbindlichen oder komplexen Fragen auf einen Treuhaender oder das kantonale Steueramt verweisen.
8. Nenne am Ende einer Zahlenantwort kurz die Grundlage, z.B. "(aus 3 Belegen 2023-2025)".

NUTZERPROFIL:
- Kanton: ${profile?.canton ?? "nicht erfasst"}
- Gemeinde: ${profile?.municipality ?? "nicht erfasst"}
- Zivilstand: ${profile?.marital_status ?? "nicht erfasst"}
- Konfession: ${profile?.confession ?? "nicht erfasst"}
- Kontotyp: ${profile?.account_type ?? "nicht erfasst"}

KATEGORIEN DES NUTZERS (exakte Namen):
${kategorien.length ? kategorien.map((k) => `- ${k}`).join("\n") : "- (keine Kategorien erfasst)"}`;
}

// ---------------------------------------------------------------------------
// Mistral-Aufruf
// ---------------------------------------------------------------------------

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function callMistral(apiKey: string, messages: any[]) {
  const reihenfolge = aktivesModell ? [aktivesModell, ...MODELS.filter((m) => m !== aktivesModell)] : MODELS;
  const kandidaten = reihenfolge.filter((m) => !gesperrteModelle.has(m));
  let ratenlimitErreicht = false;

  for (const model of kandidaten) {
    for (let versuch = 0; versuch <= MAX_RETRIES_429; versuch++) {
      await drosseln();
      const resp = await fetch(MISTRAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: "auto", temperature: 0.1, max_tokens: MAX_OUTPUT_TOKENS }),
      });
      if (resp.ok) {
        if (aktivesModell !== model) console.log(`Mistral-Modell aktiv: ${model}`);
        aktivesModell = model;
        return { ...(await resp.json()), _model: model };
      }
      const txt = await resp.text();
      console.error("Mistral-Fehler", model, resp.status, `Versuch ${versuch + 1}`, txt);

      if (resp.status === 429) {
        // Zu schnell: warten und dasselbe Modell nochmals versuchen
        ratenlimitErreicht = true;
        if (versuch < MAX_RETRIES_429) { await schlafen(2000 * (versuch + 1)); continue; }
        break; // naechstes Modell versuchen
      }
      // Modell im Abo nicht verfuegbar oder unbekannt -> merken und naechstes Modell
      if (resp.status === 403 || resp.status === 404 || (resp.status === 400 && /model/i.test(txt))) {
        gesperrteModelle.add(model);
        break;
      }
      if (resp.status === 401) throw new HttpError(500, "MISTRAL_API_KEY ungueltig.");
      throw new HttpError(502, `KI-Dienst nicht erreichbar (${resp.status}).`);
    }
  }
  if (ratenlimitErreicht) throw new HttpError(429, "Der KI-Dienst ist gerade ausgelastet. Bitte in einer Minute nochmals versuchen.");
  throw new HttpError(502, "Kein Mistral-Modell im aktuellen Abo verfuegbar.");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    // Ein einziger Client, mit dem Token des Nutzers: RLS schuetzt alle Zugriffe.
    const db = createClient(supabaseUrl(), publishableKey(), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await db.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("MISTRAL_API_KEY");
    if (!apiKey) {
      console.error("MISTRAL_API_KEY fehlt");
      return json({ error: "KI-Assistent nicht konfiguriert (MISTRAL_API_KEY fehlt)." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const message = body?.message;
    let convId = body?.conversation_id;
    if (!message || typeof message !== "string") return json({ error: "message required" }, 400);

    if (convId) {
      const { data: own } = await db.from("tax_conversations").select("id").eq("id", convId).eq("user_id", user.id).maybeSingle();
      if (!own) return json({ error: "Forbidden" }, 403);
    } else {
      const { data: conv, error } = await db
        .from("tax_conversations")
        .insert({ user_id: user.id, title: message.slice(0, 60), tax_year: new Date().getFullYear() })
        .select("id").single();
      if (error) throw error;
      convId = conv.id;
    }

    const [{ data: history }, { data: profile }, { data: cats }] = await Promise.all([
      db.from("tax_messages").select("role, content").eq("conversation_id", convId).eq("user_id", user.id)
        .in("role", ["user", "assistant"]).order("created_at", { ascending: true }).limit(20),
      db.from("profiles").select("canton, municipality, marital_status, confession, account_type").eq("id", user.id).maybeSingle(),
      db.from("categories").select("name").eq("user_id", user.id).order("name"),
    ]);

    // Kostenbremse: Limits pro Nutzer und globales Monatsbudget (ai_limits)
    const freigabe: any = await rpc(db, "ai_usage_begin", { _feature: FEATURE });
    if (!freigabe?.erlaubt) {
      const hinweis = freigabe?.meldung ?? "Der KI-Assistent ist gerade nicht verfuegbar.";
      await db.from("tax_messages").insert([
        { conversation_id: convId, user_id: user.id, role: "user", content: message },
        { conversation_id: convId, user_id: user.id, role: "assistant", content: hinweis, metadata: { limit: freigabe?.grund } },
      ]);
      return json({ response: hinweis, conversation_id: convId, limit_erreicht: freigabe?.grund ?? true });
    }
    const usageId = freigabe.usage_id;

    await db.from("tax_messages").insert({ conversation_id: convId, user_id: user.id, role: "user", content: message });

    const kategorien = [...new Set((cats ?? []).map((c: any) => c.name))];
    const messages: any[] = [
      { role: "system", content: systemPrompt(profile, kategorien) },
      ...(history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const ctx: Ctx = { db, userId: user.id, profile };
    const protokoll: any[] = [];
    let antwort = "";
    let modell = "";
    let tokIn = 0, tokOut = 0;

    try {
    for (let runde = 0; runde <= MAX_TOOL_ROUNDS; runde++) {
      const data = await callMistral(apiKey, messages);
      modell = data._model;
      tokIn += Number(data.usage?.prompt_tokens ?? 0);
      tokOut += Number(data.usage?.completion_tokens ?? 0);
      const msg = data.choices?.[0]?.message;
      const calls = msg?.tool_calls ?? [];

      if (!calls.length || runde === MAX_TOOL_ROUNDS) {
        antwort = msg?.content || "Keine Antwort erhalten.";
        break;
      }

      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: calls });

      for (const call of calls) {
        const name = call.function?.name;
        let args: any = {};
        try {
          args = typeof call.function?.arguments === "string" ? JSON.parse(call.function.arguments || "{}") : (call.function?.arguments ?? {});
        } catch { args = {}; }

        let result: unknown;
        let ok = true;
        try {
          result = await runTool(name, args, ctx);
        } catch (e: any) {
          ok = false;
          result = { fehler: e?.message ?? String(e) };
        }
        protokoll.push({ werkzeug: name, argumente: args, ok, zeit: new Date().toISOString() });
        messages.push({ role: "tool", tool_call_id: call.id, name, content: JSON.stringify(result) });
      }
    }
    } finally {
      // Verbrauch immer nachtragen, auch wenn eine Runde fehlschlaegt
      const { error: recErr } = await db.rpc("ai_usage_record", {
        _usage_id: usageId, _model: modell || "unbekannt", _input_tokens: tokIn, _output_tokens: tokOut,
      });
      if (recErr) console.error("ai_usage_record:", recErr.message);
    }

    await db.from("tax_messages").insert({
      conversation_id: convId, user_id: user.id, role: "assistant", content: antwort,
      tool_calls: protokoll.length ? protokoll : null,
      metadata: { model: modell, werkzeuge: protokoll.map((p) => p.werkzeug) },
    });
    await db.from("tax_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

    return json({ response: antwort, conversation_id: convId, werkzeuge: protokoll.map((p) => p.werkzeug) });
  } catch (err: any) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error("ai-tax-advisor error:", err);
    return json({ error: err?.message || "Internal error" }, 500);
  }
});

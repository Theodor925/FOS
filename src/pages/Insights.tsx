import { useCallback, useEffect, useState } from "react";
import {
  TriangleAlert,
  PiggyBank,
  TrendingUp,
  Landmark,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AiInsight, InsightCategory } from "@/types/database";

const categoryMeta: Record<
  InsightCategory,
  { label: string; icon: typeof TriangleAlert; tone: "red" | "green" | "blue" | "purple" | "amber" }
> = {
  anomaly: { label: "Anomalie", icon: TriangleAlert, tone: "red" },
  savings: { label: "Spar-Potenzial", icon: PiggyBank, tone: "green" },
  cashflow: { label: "Cashflow", icon: TrendingUp, tone: "blue" },
  tax: { label: "Steuer-Optimierung", icon: Landmark, tone: "purple" },
  compliance: { label: "Compliance", icon: ShieldCheck, tone: "amber" },
};

export function Insights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [filter, setFilter] = useState<InsightCategory | "all">("all");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("ai_insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setInsights((data as AiInsight[]) ?? []);
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function giveFeedback(insight: AiInsight, feedback: "helpful" | "not_relevant") {
    await supabase.from("ai_insights").update({ feedback }).eq("id", insight.id);
    void load();
  }

  const filtered = filter === "all" ? insights : insights.filter((i) => i.category === filter);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">KI-Finanzberater</h1>
        <p className="text-gray-500">
          Tägliche Analyse deiner Finanzen – Anomalien, Sparpotenzial, Cashflow, Steuern.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 text-sm ${filter === "all" ? "bg-brand-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200"}`}
        >
          Alle
        </button>
        {(Object.keys(categoryMeta) as InsightCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`rounded-full px-3 py-1 text-sm ${filter === cat ? "bg-brand-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200"}`}
          >
            {categoryMeta[cat].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            Noch keine Insights. Der KI-Berater analysiert deine Daten täglich um 6 Uhr.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((insight) => {
            const meta = categoryMeta[insight.category];
            const Icon = meta.icon;
            return (
              <Card key={insight.id}>
                <CardContent className="flex gap-4 p-5">
                  <div className="mt-0.5 text-gray-400">
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-semibold">{insight.title}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <span className="text-xs text-gray-400">
                        {formatDate(insight.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{insight.body}</p>
                  </div>
                  <div className="flex items-start gap-1">
                    <button
                      onClick={() => void giveFeedback(insight, "helpful")}
                      className={`rounded-lg p-1.5 ${insight.feedback === "helpful" ? "bg-green-100 text-green-700" : "text-gray-300 hover:text-green-600"}`}
                      title="Hilfreich"
                    >
                      <ThumbsUp size={16} />
                    </button>
                    <button
                      onClick={() => void giveFeedback(insight, "not_relevant")}
                      className={`rounded-lg p-1.5 ${insight.feedback === "not_relevant" ? "bg-red-100 text-red-700" : "text-gray-300 hover:text-red-600"}`}
                      title="Nicht relevant"
                    >
                      <ThumbsDown size={16} />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

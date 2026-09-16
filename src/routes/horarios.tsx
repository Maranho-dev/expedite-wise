import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, Kpi } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/horarios")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Análise por horário dos checklists — Expedição" },
      {
        name: "description",
        content:
          "Distribuição dos checklists finalizados por hora do dia, turno e dia da semana, com mapa de calor hora x dia.",
      },
      { property: "og:title", content: "Análise por horário dos checklists" },
      {
        property: "og:description",
        content: "Picos de finalização por hora, turno e dia da semana na expedição.",
      },
    ],
  }),
  component: Horarios,
});

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const turnoDe = (h: number) =>
  h < 6 ? "Madrugada (0h–5h)" : h < 12 ? "Manhã (6h–11h)" : h < 18 ? "Tarde (12h–17h)" : "Noite (18h–23h)";

function Horarios() {
  const { data, isLoading } = useQuery({
    queryKey: ["horarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists_realizados")
        .select("finalizado_em, status")
        .not("finalizado_em", "is", null)
        .limit(50000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const calc = useMemo(() => {
    const horas = Array.from({ length: 24 }, (_, h) => ({ hora: `${String(h).padStart(2, "0")}h`, qtd: 0 }));
    const turnos = new Map<string, number>();
    const semana = DIAS.map((d) => ({ dia: d, qtd: 0 }));
    const heat: number[][] = DIAS.map(() => Array(24).fill(0));
    let total = 0;

    for (const r of data ?? []) {
      if (!/finaliz|conclu/i.test(r.status ?? "Execução finalizada")) continue;
      const d = new Date(r.finalizado_em!);
      if (isNaN(d.getTime())) continue;
      const h = d.getHours();
      const dw = d.getDay();
      horas[h]!.qtd += 1;
      semana[dw]!.qtd += 1;
      heat[dw]![h] = (heat[dw]![h] ?? 0) + 1;
      turnos.set(turnoDe(h), (turnos.get(turnoDe(h)) ?? 0) + 1);
      total += 1;
    }

    const pico = horas.reduce((a, b) => (b.qtd > a.qtd ? b : a), horas[0]!);
    const max = Math.max(1, ...heat.flat());
    const listaTurnos = [...turnos.entries()].sort((a, b) => b[1] - a[1]);
    return { horas, semana, heat, total, pico, max, listaTurnos };

  }, [data]);

  return (
    <AppShell
      titulo="Análise por horário"
      descricao="Baseada no horário de finalização dos checklists realizados."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi rotulo="Checklists analisados" valor={calc.total.toLocaleString("pt-BR")} />
            <Kpi rotulo="Horário de pico" valor={calc.pico.hora} tom="primary" detalhe={`${calc.pico.qtd} checklists`} />
            {calc.listaTurnos.slice(0, 2).map(([t, q]) => (
              <Kpi key={t} rotulo={t} valor={q} detalhe={`${Math.round((q / (calc.total || 1)) * 100)}% do total`} />
            ))}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-5">
              <h2 className="font-semibold">Distribuição por hora</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={calc.horas}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="hora" fontSize={10} interval={1} stroke="var(--muted-foreground)" />
                    <YAxis fontSize={11} allowDecimals={false} stroke="var(--muted-foreground)" />
                    <Tooltip />
                    <Bar dataKey="qtd" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-5">
              <h2 className="font-semibold">Por dia da semana</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={calc.semana}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="dia" fontSize={11} stroke="var(--muted-foreground)" />
                    <YAxis fontSize={11} allowDecimals={false} stroke="var(--muted-foreground)" />
                    <Tooltip />
                    <Bar dataKey="qtd" fill="var(--success)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border bg-card p-5">
            <h2 className="font-semibold">Mapa de calor — hora x dia da semana</h2>
            <div className="mt-4 min-w-[720px]">
              <div className="flex gap-1 pl-10">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="tabular w-6 text-center text-[10px] text-muted-foreground">
                    {h}
                  </div>
                ))}
              </div>
              {calc.heat.map((linha, di) => (
                <div key={di} className="mt-1 flex items-center gap-1">
                  <div className="w-10 text-xs text-muted-foreground">{DIAS[di]}</div>
                  {linha.map((q, hi) => (
                    <div
                      key={hi}
                      title={`${DIAS[di]} ${hi}h — ${q} checklists`}
                      className="h-6 w-6 rounded-sm border border-border/40"
                      style={{
                        backgroundColor: q
                          ? `color-mix(in srgb, var(--primary) ${Math.round((q / calc.max) * 100)}%, transparent)`
                          : "transparent",
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

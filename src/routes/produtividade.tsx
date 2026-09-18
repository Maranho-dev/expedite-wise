import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { fmtData, isoDia } from "@/lib/checklist-core";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/produtividade")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Produtividade dos conferentes — Expedição" },
      {
        name: "description",
        content:
          "Ranking de conferentes, quantidade de checklists realizados, média diária, participação e evolução no período.",
      },
      { property: "og:title", content: "Produtividade dos conferentes — Expedição" },
      {
        property: "og:description",
        content: "Ranking, média diária e evolução da produtividade dos conferentes.",
      },
    ],
  }),
  component: Produtividade,
});

type Reg = {
  conferente: string | null;
  finalizado_em: string | null;
  criado_em: string | null;
  status: string | null;
};

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function chaveMes(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rotuloMes(chave: string) {
  const [a, m] = chave.split("-");
  return `${MESES[Number(m) - 1]}/${a}`;
}

function chaveSemana(d: Date) {
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  return isoDia(base);
}

function rotuloSemana(chave: string) {
  const ini = new Date(`${chave}T00:00:00`);
  const fim = new Date(ini);
  fim.setDate(fim.getDate() + 6);
  return `${fmtData(isoDia(ini)).slice(0, 5)} a ${fmtData(isoDia(fim)).slice(0, 5)}`;
}

function Produtividade() {
  const [modo, setModo] = useState<"mes" | "semana">("mes");
  const [periodo, setPeriodo] = useState<string>("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["produtividade"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists_realizados")
        .select("conferente, finalizado_em, criado_em, status")
        .not("finalizado_em", "is", null)
        .limit(50000);
      if (error) throw error;
      return (data ?? []) as Reg[];
    },
  });

  const calc = useMemo(() => {
    const base = (data ?? []).filter(
      (r) => r.conferente && /finaliz|conclu/i.test(r.status ?? "Execução finalizada"),
    );

    const comData = base
      .map((r) => {
        const fim = new Date(r.finalizado_em!);
        if (isNaN(fim.getTime())) return null;
        return { ...r, fim, per: modo === "mes" ? chaveMes(fim) : chaveSemana(fim) };
      })
      .filter(Boolean) as (Reg & { fim: Date; per: string })[];

    const periodos = [...new Set(comData.map((r) => r.per))].sort((a, b) => b.localeCompare(a));

    const porPeriodo = new Map<string, number>();
    for (const r of comData) porPeriodo.set(r.per, (porPeriodo.get(r.per) ?? 0) + 1);
    const seriePeriodo = [...porPeriodo.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-18)
      .map(([k, qtd]) => ({
        rotulo: modo === "mes" ? rotuloMes(k) : rotuloSemana(k),
        qtd,
      }));

    const regs = periodo === "todos" ? comData : comData.filter((r) => r.per === periodo);
    const total = regs.length;
    const porConf = new Map<
      string,
      { qtd: number; dias: Set<string>; minutos: number[]; ultimo: string | null }
    >();
    const porDia = new Map<string, number>();

    for (const r of regs) {
      const fim = r.fim;
      const dia = isoDia(fim);
      porDia.set(dia, (porDia.get(dia) ?? 0) + 1);

      const nome = r.conferente!.trim();
      const atual = porConf.get(nome) ?? {
        qtd: 0,
        dias: new Set<string>(),
        minutos: [] as number[],
        ultimo: null as string | null,
      };
      atual.qtd += 1;
      atual.dias.add(dia);
      if (!atual.ultimo || r.finalizado_em! > atual.ultimo) atual.ultimo = r.finalizado_em!;
      if (r.criado_em) {
        const ini = new Date(r.criado_em);
        const min = (fim.getTime() - ini.getTime()) / 60000;
        if (min >= 0 && min < 60 * 12) atual.minutos.push(min);
      }
      porConf.set(nome, atual);
    }

    const ranking = [...porConf.entries()]
      .map(([conferente, v]) => ({
        conferente,
        qtd: v.qtd,
        dias: v.dias.size,
        media: v.dias.size ? v.qtd / v.dias.size : 0,
        participacao: total ? (v.qtd / total) * 100 : 0,
        tempoMedio: v.minutos.length
          ? v.minutos.reduce((a, b) => a + b, 0) / v.minutos.length
          : null,
        ultimo: v.ultimo,
      }))
      .sort((a, b) => b.qtd - a.qtd);

    const evolucao = [...porDia.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([dia, qtd]) => ({ dia: fmtData(dia).slice(0, 5), qtd }));

    return { total, ranking, evolucao, dias: porDia.size, periodos, seriePeriodo };
  }, [data, modo, periodo]);

  return (
    <AppShell
      titulo="Produtividade"
      descricao="Considera apenas checklists efetivamente finalizados na base de realizados."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
            <span className="text-sm font-medium">Agrupar por</span>
            <div className="flex gap-1">
              {(["mes", "semana"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setModo(m);
                    setPeriodo("todos");
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    modo === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "mes" ? "Mês" : "Semana"}
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Período</span>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                <option value="todos">Todos</option>
                {calc.periodos.map((p) => (
                  <option key={p} value={p}>
                    {modo === "mes" ? rotuloMes(p) : rotuloSemana(p)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi rotulo="Checklists realizados" valor={calc.total.toLocaleString("pt-BR")} />
            <Kpi rotulo="Conferentes ativos" valor={calc.ranking.length} tom="primary" />
            <Kpi rotulo="Dias com movimento" valor={calc.dias} />
            <Kpi
              rotulo="Média por dia"
              valor={calc.dias ? Math.round(calc.total / calc.dias) : 0}
              tom="success"
            />
          </div>

          <div className="mt-6 rounded-lg border bg-card p-5">
            <h2 className="font-semibold">Evolução diária (últimos 30 dias com movimento)</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calc.evolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="dia" fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Conferente</TableHead>
                  <TableHead className="text-right">Checklists</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead className="text-right">Média/dia</TableHead>
                  <TableHead className="text-right">Participação</TableHead>
                  <TableHead className="text-right">Tempo médio</TableHead>
                  <TableHead>Último</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calc.ranking.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      Nenhum checklist finalizado registrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  calc.ranking.map((r, i) => (
                    <TableRow key={r.conferente}>
                      <TableCell className="tabular text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.conferente}</TableCell>
                      <TableCell className="tabular text-right font-semibold">{r.qtd}</TableCell>
                      <TableCell className="tabular text-right">{r.dias}</TableCell>
                      <TableCell className="tabular text-right">
                        {r.media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {r.participacao.toFixed(1)}%
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {r.tempoMedio === null ? "—" : `${Math.round(r.tempoMedio)} min`}
                      </TableCell>
                      <TableCell className="tabular text-sm text-muted-foreground">
                        {r.ultimo ? fmtData(r.ultimo) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </AppShell>
  );
}

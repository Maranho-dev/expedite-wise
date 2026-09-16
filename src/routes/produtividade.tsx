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

function Produtividade() {
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
    const regs = (data ?? []).filter(
      (r) => r.conferente && /finaliz|conclu/i.test(r.status ?? "Execução finalizada"),
    );
    const total = regs.length;
    const porConf = new Map<
      string,
      { qtd: number; dias: Set<string>; minutos: number[]; ultimo: string | null }
    >();
    const porDia = new Map<string, number>();

    for (const r of regs) {
      const fim = new Date(r.finalizado_em!);
      if (isNaN(fim.getTime())) continue;
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

    return { total, ranking, evolucao, dias: porDia.size };
  }, [data]);

  return (
    <AppShell
      titulo="Produtividade"
      descricao="Considera apenas checklists efetivamente finalizados na base de realizados."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
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

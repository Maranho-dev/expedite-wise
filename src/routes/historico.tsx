import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { AppShell, Kpi } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fmtData, fmtDataHora } from "@/lib/checklist-core";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/historico")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Histórico diário dos checklists — Expedição" },
      {
        name: "description",
        content:
          "Evolução diária de checklists esperados, realizados, novas pendências, resolvidas e saldo acumulado.",
      },
      { property: "og:title", content: "Histórico diário dos checklists" },
      {
        property: "og:description",
        content: "Série histórica de esperados, realizados e saldo acumulado de pendências.",
      },
    ],
  }),
  component: Historico,
});

function Historico() {
  const { data, isLoading } = useQuery({
    queryKey: ["historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumo_diario")
        .select("*")
        .order("data_ref", { ascending: false })
        .limit(365);
      if (error) throw error;
      return data ?? [];
    },
  });

  const serie = useMemo(
    () =>
      [...(data ?? [])]
        .sort((a, b) => a.data_ref.localeCompare(b.data_ref))
        .map((d) => ({
          dia: fmtData(d.data_ref).slice(0, 5),
          Esperados: d.esperados,
          Realizados: d.realizados,
          Saldo: d.saldo_acumulado,
        })),
    [data],
  );

  const ultimo = data?.[0];

  function exportar() {
    const linhas = (data ?? []).map((d) => ({
      Data: fmtData(d.data_ref),
      Esperados: d.esperados,
      Realizados: d.realizados,
      "Novas pendências": d.novas_pendencias,
      "Pendências antigas": d.pendencias_antigas,
      Resolvidas: d.pendencias_resolvidas,
      "Saldo acumulado": d.saldo_acumulado,
      Processado: fmtDataHora(d.processado_em),
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historico");
    XLSX.writeFile(wb, "historico-checklists.xlsx");
  }

  return (
    <AppShell
      titulo="Histórico"
      descricao="Cada processamento guarda o resultado do dia, sem apagar os dias anteriores."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !data?.length ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum dia processado até o momento.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi rotulo="Dias processados" valor={data.length} />
            <Kpi rotulo="Último dia" valor={fmtData(ultimo!.data_ref)} tom="primary" />
            <Kpi rotulo="Saldo atual" valor={ultimo!.saldo_acumulado} tom="destructive" />
            <Kpi
              rotulo="Resolvidas no período"
              valor={data.reduce((s, d) => s + d.pendencias_resolvidas, 0)}
              tom="success"
            />
          </div>

          <div className="mt-6 rounded-lg border bg-card p-5">
            <h2 className="font-semibold">Evolução</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Esperados" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Realizados" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Saldo" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={exportar}>
              Exportar Excel
            </Button>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Esperados</TableHead>
                  <TableHead className="text-right">Realizados</TableHead>
                  <TableHead className="text-right">Aderência</TableHead>
                  <TableHead className="text-right">Novas</TableHead>
                  <TableHead className="text-right">Antigas</TableHead>
                  <TableHead className="text-right">Resolvidas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((d) => (
                  <TableRow key={d.data_ref}>
                    <TableCell className="tabular font-medium">{fmtData(d.data_ref)}</TableCell>
                    <TableCell className="tabular text-right">{d.esperados}</TableCell>
                    <TableCell className="tabular text-right">{d.realizados}</TableCell>
                    <TableCell className="tabular text-right">
                      {d.esperados ? Math.round((d.realizados / d.esperados) * 100) : 0}%
                    </TableCell>
                    <TableCell className="tabular text-right">{d.novas_pendencias}</TableCell>
                    <TableCell className="tabular text-right">{d.pendencias_antigas}</TableCell>
                    <TableCell className="tabular text-right text-success">
                      {d.pendencias_resolvidas}
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold text-destructive">
                      {d.saldo_acumulado}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </AppShell>
  );
}

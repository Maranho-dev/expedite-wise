import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { AppShell, Kpi } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fmtData } from "@/lib/checklist-core";
import { numeroDe } from "@/lib/processar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/pendencias")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pendências de checklist — Expedição" },
      {
        name: "description",
        content:
          "Relação completa dos checklists de expedição pendentes, com dias em aberto, carga, notas fiscais e cliente.",
      },
      { property: "og:title", content: "Pendências de checklist — Expedição" },
      {
        property: "og:description",
        content: "Checklists em aberto, pendências antigas e exportação para Excel.",
      },
    ],
  }),
  component: Pendencias,
});

const diasEmAberto = (data: string | null) => {
  if (!data) return 0;
  const d = new Date(data + "T00:00:00");
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
};

function Pendencias() {
  const [busca, setBusca] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["pendencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists_esperados")
        .select("*")
        .eq("status", "PENDENTE")
        .order("data_nf", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return data ?? [];
    return (data ?? []).filter((p) =>
      [p.chave, p.cliente, p.transportadora, p.uf, (p.nfs as string[])?.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(termo),
    );
  }, [data, busca]);

  const antigas = lista.filter((p) => diasEmAberto(p.data_nf) > 1).length;

  function exportar() {
    const linhas = lista.map((p) => ({
      Tipo: p.tipo,
      Chave: numeroDe(p.chave),
      "Notas fiscais": (p.nfs as string[]).join(", "),
      "Qtd NFs": p.qtd_nf,
      "Data da NF": fmtData(p.data_nf),
      "Dias em aberto": diasEmAberto(p.data_nf),
      Cliente: p.cliente ?? "",
      Transportadora: p.transportadora ?? "",
      UF: p.uf ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pendencias");
    XLSX.writeFile(wb, "pendencias-checklist.xlsx");
  }

  return (
    <AppShell
      titulo="Pendências"
      descricao="Checklists esperados que ainda não têm um checklist correspondente na base de realizados."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi rotulo="Pendências em aberto" valor={lista.length} tom="destructive" />
        <Kpi rotulo="Com mais de 1 dia" valor={antigas} tom="warning" />
        <Kpi
          rotulo="Notas fiscais envolvidas"
          valor={lista.reduce((s, p) => s + (p.qtd_nf ?? 0), 0)}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por carga, NF, cliente ou transportadora"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" onClick={exportar} disabled={!lista.length}>
          Exportar Excel
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Chave</TableHead>
              <TableHead>Notas fiscais</TableHead>
              <TableHead>Data da NF</TableHead>
              <TableHead className="text-right">Dias em aberto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>UF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : lista.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Nenhuma pendência em aberto.
                </TableCell>
              </TableRow>
            ) : (
              lista.map((p) => {
                const dias = diasEmAberto(p.data_nf);
                return (
                  <TableRow key={p.chave}>
                    <TableCell>
                      <Badge variant={p.tipo === "CARGA" ? "default" : "secondary"}>{p.tipo}</Badge>
                    </TableCell>
                    <TableCell className="tabular font-medium">{numeroDe(p.chave)}</TableCell>
                    <TableCell className="tabular max-w-[260px] truncate text-sm text-muted-foreground">
                      {(p.nfs as string[]).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="tabular">{fmtData(p.data_nf)}</TableCell>
                    <TableCell
                      className={`tabular text-right font-medium ${dias > 1 ? "text-destructive" : ""}`}
                    >
                      {dias}
                    </TableCell>
                    <TableCell className="text-sm">{p.cliente ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.uf ?? "—"}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}

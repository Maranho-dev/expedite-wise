import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { AppShell, Kpi } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fmtData, fmtDataHora } from "@/lib/checklist-core";
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

export const Route = createFileRoute("/canhotos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Comprovantes de entrega — Expedição" },
      {
        name: "description",
        content:
          "Controle dos canhotos: notas que saíram com carga, comprovantes já baixados pelo motorista e comprovantes pendentes.",
      },
      { property: "og:title", content: "Comprovantes de entrega — Expedição" },
      {
        property: "og:description",
        content: "Notas com carga, canhotos recebidos e canhotos pendentes.",
      },
    ],
  }),
  component: Canhotos,
});

const dias = (data: string | null) => {
  if (!data) return 0;
  const d = new Date(data + "T00:00:00");
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
};

function Canhotos() {
  const [busca, setBusca] = useState("");
  const [somentePendentes, setSomentePendentes] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["canhotos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comprovantes_nf")
        .select("*")
        .order("data_nf", { ascending: true })
        .limit(20000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const todos = data ?? [];
  const pendentesTotal = todos.filter((c) => c.status === "PENDENTE").length;
  const okTotal = todos.length - pendentesTotal;

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return todos
      .filter((c) => (somentePendentes ? c.status === "PENDENTE" : true))
      .filter((c) =>
        termo
          ? [c.nf, c.carga, c.cliente, c.cliente_destino, c.transportadora, c.uf]
              .join(" ")
              .toLowerCase()
              .includes(termo)
          : true,
      );
  }, [todos, busca, somentePendentes]);

  function exportar() {
    const linhas = lista.map((c) => ({
      NF: c.nf,
      Carga: c.carga ?? "",
      "Data da NF": fmtData(c.data_nf),
      Situação: c.status === "OK" ? "Comprovado" : "Pendente",
      "Baixa do comprovante": c.finalizacao ? fmtDataHora(c.finalizacao) : "",
      "Dias em aberto": c.status === "PENDENTE" ? dias(c.data_nf) : "",
      Cliente: c.cliente ?? c.cliente_destino ?? "",
      Transportadora: c.transportadora ?? "",
      UF: c.uf ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Canhotos");
    XLSX.writeFile(wb, "comprovantes-entrega.xlsx");
  }

  const aderencia = todos.length ? Math.round((okTotal / todos.length) * 100) : 0;

  return (
    <AppShell
      titulo="Comprovantes de entrega"
      descricao="Cada nota fiscal que saiu com carga precisa de um comprovante. Se a nota consta na base de comprovantes com finalização, o canhoto está em ordem."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Notas com carga" valor={todos.length.toLocaleString("pt-BR")} />
        <Kpi
          rotulo="Comprovantes OK"
          valor={okTotal.toLocaleString("pt-BR")}
          tom="success"
          detalhe={`${aderencia}% baixados`}
        />
        <Kpi
          rotulo="Canhotos pendentes"
          valor={pendentesTotal.toLocaleString("pt-BR")}
          tom="destructive"
          detalhe="Saldo acumulado em aberto"
        />
        <Kpi
          rotulo="Pendentes com +1 dia"
          valor={todos.filter((c) => c.status === "PENDENTE" && dias(c.data_nf) > 1).length}
          tom="warning"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por NF, carga, cliente ou transportadora"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm"
        />
        <Button
          variant={somentePendentes ? "default" : "outline"}
          onClick={() => setSomentePendentes((v) => !v)}
        >
          {somentePendentes ? "Mostrando pendentes" : "Mostrando todas"}
        </Button>
        <Button variant="outline" onClick={exportar} disabled={!lista.length}>
          Exportar Excel
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NF</TableHead>
              <TableHead>Carga</TableHead>
              <TableHead>Data da NF</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Baixa</TableHead>
              <TableHead className="text-right">Dias em aberto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>UF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : lista.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Nenhum registro para os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              lista.map((c) => {
                const d = dias(c.data_nf);
                const pendente = c.status === "PENDENTE";
                return (
                  <TableRow key={c.nf}>
                    <TableCell className="tabular font-medium">{c.nf}</TableCell>
                    <TableCell className="tabular">{c.carga ?? "—"}</TableCell>
                    <TableCell className="tabular">{fmtData(c.data_nf)}</TableCell>
                    <TableCell>
                      <Badge variant={pendente ? "destructive" : "secondary"}>
                        {pendente ? "Pendente" : "Comprovado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-sm text-muted-foreground">
                      {c.finalizacao ? fmtDataHora(c.finalizacao) : "—"}
                    </TableCell>
                    <TableCell
                      className={`tabular text-right ${pendente && d > 1 ? "text-destructive font-medium" : ""}`}
                    >
                      {pendente ? d : "—"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-sm">
                      {c.cliente ?? c.cliente_destino ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{c.uf ?? "—"}</TableCell>
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

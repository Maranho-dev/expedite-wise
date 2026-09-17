import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  detectarCK,
  detectarCP,
  detectarNF,
  isoDia,
  montarBaixas,
  montarEsperados,
  montarNotasComCarga,
  montarRealizados,
  type Row,
} from "@/lib/checklist-core";
import { processarBases, type ResultadoProcessamento } from "@/lib/processar";

export const Route = createFileRoute("/atualizar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Atualizar bases — Checklists de Expedição" },
      {
        name: "description",
        content:
          "Envie as planilhas de notas fiscais e de checklists para cruzar os dados e atualizar os indicadores do dia.",
      },
      { property: "og:title", content: "Atualizar bases — Checklists de Expedição" },
      {
        property: "og:description",
        content: "Upload diário das bases de notas fiscais e checklists realizados.",
      },
    ],
  }),
  component: Atualizar,
});

function lerArquivo(file: File): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]!]!;
        resolve(XLSX.utils.sheet_to_json<Row>(ws, { defval: null }));
      } catch (e) {
        reject(e as Error);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function lerColado(texto: string): Row[] {
  const linhas = texto.trim().split(/\r?\n/).filter(Boolean);
  if (linhas.length < 2) return [];
  const sep = linhas[0]!.includes("\t") ? "\t" : linhas[0]!.includes(";") ? ";" : ",";
  const heads = linhas[0]!.split(sep).map((h) => h.trim());
  return linhas.slice(1).map((l) => {
    const cols = l.split(sep);
    const obj: Row = {};
    heads.forEach((h, i) => (obj[h] = (cols[i] ?? "").trim()));
    return obj;
  });
}

function BaseInput({
  titulo,
  descricao,
  rows,
  onRows,
}: {
  titulo: string;
  descricao: string;
  rows: Row[];
  onRows: (r: Row[]) => void;
}) {
  const [texto, setTexto] = useState("");
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{titulo}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>
        </div>
        {rows.length > 0 ? (
          <Badge variant="secondary" className="shrink-0">
            {rows.length.toLocaleString("pt-BR")} linhas
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Arquivo Excel</Label>
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const r = await lerArquivo(f);
                onRows(r);
                toast.success(`${titulo}: ${r.length} linhas carregadas`);
              } catch {
                toast.error("Não foi possível ler esse arquivo");
              }
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Ou cole os dados (com a linha de cabeçalho)</Label>
          <Textarea
            rows={4}
            value={texto}
            placeholder="Cole aqui as linhas copiadas do Excel"
            onChange={(e) => {
              setTexto(e.target.value);
              const r = lerColado(e.target.value);
              if (r.length) onRows(r);
            }}
          />
        </div>
        {rows.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(rows[0]!).map((c) => (
              <span key={c} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {c}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Atualizar() {
  const [nfRows, setNfRows] = useState<Row[]>([]);
  const [ckRows, setCkRows] = useState<Row[]>([]);
  const [dataRef, setDataRef] = useState(isoDia(new Date()));
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoProcessamento | null>(null);

  const mapaNF = nfRows.length ? detectarNF(Object.keys(nfRows[0]!)) : null;
  const mapaCK = ckRows.length ? detectarCK(Object.keys(ckRows[0]!)) : null;

  async function processar() {
    if (!nfRows.length || !ckRows.length) {
      toast.error("Carregue as duas bases antes de processar");
      return;
    }
    setProcessando(true);
    try {
      const esperados = montarEsperados(nfRows, mapaNF!);
      const realizados = montarRealizados(ckRows, mapaCK!);
      const res = await processarBases(dataRef, esperados, realizados);
      setResultado(res);
      toast.success("Bases processadas com sucesso");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao processar as bases");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <AppShell
      titulo="Atualizar bases"
      descricao="Envie as duas bases do dia. O sistema identifica as colunas, monta a chave de cada checklist, cruza as informações e registra o resultado no histórico."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <BaseInput
          titulo="Base 1 — Notas Fiscais"
          descricao="Relação de notas emitidas, com número do documento e carga."
          rows={nfRows}
          onRows={setNfRows}
        />
        <BaseInput
          titulo="Base 2 — Checklists"
          descricao="Histórico de checklists com objeto, executor e finalização."
          rows={ckRows}
          onRows={setCkRows}
        />
      </div>

      {(mapaNF || mapaCK) && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {mapaNF && <MapaCard titulo="Colunas identificadas — Notas Fiscais" mapa={mapaNF} />}
          {mapaCK && <MapaCard titulo="Colunas identificadas — Checklists" mapa={mapaCK} />}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-end gap-4 rounded-lg border bg-card p-5">
        <div className="space-y-1.5">
          <Label htmlFor="dataRef">Data de referência</Label>
          <Input
            id="dataRef"
            type="date"
            value={dataRef}
            onChange={(e) => setDataRef(e.target.value)}
            className="w-44"
          />
        </div>
        <Button onClick={processar} disabled={processando} size="lg">
          {processando ? "Processando..." : "Processar bases"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Reprocessar a mesma data atualiza o registro daquele dia sem apagar o histórico.
        </p>
      </div>

      {resultado && (
        <div className="mt-5 rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Resultado do processamento</h2>
          <div className="tabular mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Esperados", resultado.esperados],
              ["Realizados", resultado.realizados],
              ["Novas pendências", resultado.novas_pendencias],
              ["Pendências antigas", resultado.pendencias_antigas],
              ["Resolvidas", resultado.pendencias_resolvidas],
              ["Saldo acumulado", resultado.saldo_acumulado],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-md bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="text-xl font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function MapaCard({ titulo, mapa }: { titulo: string; mapa: Record<string, string | null> }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        {Object.entries(mapa).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 border-b border-dashed py-1">
            <dt className="capitalize text-muted-foreground">{k}</dt>
            <dd className={v ? "font-medium" : "text-muted-foreground"}>{v ?? "não encontrada"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

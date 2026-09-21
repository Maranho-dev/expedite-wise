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
importar {
  detectarCK,
  detectarCP,
  detectarNF,
  montarBaixas,
  montarEsperados,
  montarNotasComCarga,
  montarRealizados,
  tipo Linha,
} de "@/lib/checklist-core";
import { processarBases, digite ResultadoProcessamento } from "@/lib/processar";

export const Route = createFileRoute("/atualizar")({
  ssr: falso,
  cabeça: () => ({
    meta: [
      { title: "Atualizar bases — Checklists de Expedição" },
      {
        nome: "descrição",
        contente:
          "Envie as planilhas de notas fiscais e de checklists para cruzar os dados e atualizar os indicadores do dia.",
      },
      { property: "og:title", content: "Atualizar bases — Checklists de Expedição" },
      {
        propriedade: "og:descrição",
        content: "Upload diário das bases de notas fiscais e checklists realizados.",
      },
    ],
  }),
  componente: Atualizar,
});

função lerArquivo(arquivo: Arquivo): Promise<Linha[]> {
  retornar nova Promise((resolver, rejeitar) => {
    const leitor = novo FileReader();
    reader.onerror = () => rejeitar(new Error("Não foi possível ler o arquivo"));
    leitor.onload = () => {
      tentar {
        const wb = XLSX.read(reader.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]!]!;
        resolve(XLSX.utils.sheet_to_json<Row>(ws, { defval: null }));
      } catch (e) {
        rejeitar(e como Erro);
      }
    };
    leitor.lerComoArrayBuffer(arquivo);
  });
}

function lerColado(texto: string): Linha[] {
  const linhas = texto.trim().split(/\r?\n/).filter(Boolean);
  se (linhas.length < 2) retorne [];
  const sep = linhas[0]!.includes("\t") ? "\t" : linhas[0]!.includes(";") ? ";" : ",";
  const heads = linhas[0]!.split(sep).map((h) => h.trim());
  return linhas.slice(1).map((l) => {
    const cols = l.split(sep);
    const obj: Linha = {};
    heads.forEach((h, i) => (obj[h] = (cols[i] ?? "").trim()));
    retornar obj;
  });
}

função BaseInput({
  título,
  descrição,
  fileiras,
  onRows,
}: {
  título: string;
  descrição: string;
  linhas: Linha[];
  onRows: (r: Row[]) => void;
}) {
  const [texto, setTexto] = useState("");
  retornar (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{tituloCEh2>
          <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>
        </div>
        {rows.length > 0 ? (
          <Badge variant="secondary" className="shrink-0">
            {rows.length.toLocaleString("pt-BR")} linhas
          </Badge>
        ) : nulo}
      </div>

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Arquivo Excel</Label>
          <Entrada>
            tipo="arquivo"
            aceitar=".xlsx,.xls,.csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              se (!f) retornar;
              tentar {
                const r = await lerArquivo(f);
                onRows(r);
                brinde.success(`${titulo}: ${r.length} linhas relacionadas`);
              } pegar {
                brinde.error("Não foi possível ler esse arquivo");
              }
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Ou cole os dados (com a linha de cabeçalho)</Label>
          <Área de texto>
            linhas={4}
            valor={texto}
            placeholder="Cole aqui as linhas copiadas do Excel"
            onChange={(e) => {
              setTexto(e.target.value);
              const r = lerColado(e.target.value);
              se (r.comprimento) emLinhas(r);
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
        ) : nulo}
      </div>
    </div>
  );
}

função Atualizar() {
  const [nfRows, setNfRows] = useState<Row[]>([]);
  const [ckRows, setCkRows] = useState<Row[]>([]);
  const [cpRows, setCpRows] = useState<Row[]>([]);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoProcessamento | nulo>(nulo);

  const mapaNF = nfRows.length ? detectarNF(Object.keys(nfRows[0]!)) : null;
  const mapaCK = ckRows.length ? detectarCK(Object.keys(ckRows[0]!)) : null;
  const mapaCP = cpRows.length ? detectarCP(Object.keys(cpRows[0]!)) : null;

  função assíncrona() {
    se (!nfRows.length || !ckRows.length) {
      brinde.error("Carregue as duas bases antes de processar");
      retornar;
    }
    setProcessando(true);
    tentar {
      const esperados = montarEsperados(nfRows, mapaNF!);
      const realizados = montarRealizados(ckRows, mapaCK!);
      const notas = montarNotasComCarga(nfRows, mapaNF!);
      const baixas = mapaCP ? montarBaixas(cpRows, mapaCP) : [];
      const res = aguarda processarBases(esperados, realizados, notas, baixas);
      setResultado(res);
      brinde.success("Bases processadas com sucesso");
    } catch (e) {
      console.error(e);
      brinde.error("Falha ao processar as bases");
    } finalmente {
      setProcessando(false);
    }
  }

  retornar (
    <AppShell
      título="Atualizar bases"
      descricao="Envie as bases do dia. O sistema identifica as colunas, monta a chave de cada checklist, cruza as informações, confere os comprovantes de entrega e registra o resultado no histórico."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <BaseInput
          titulo="Base 1 — Notas Fiscais"
          descricao="Relação de notas emitidas, com número do documento e carga."
          linhas={nfLinhas}
          onRows={setNfRows}
        />
        <BaseInput
          título="Base 2 — Listas de verificação"
          descricao="Histórico de checklists com objeto, executor e finalização."
          linhas={ckRows}
          onRows={setCkRows}
        />
        <BaseInput
          titulo="Base 3 — Comprovantes de entrega"
          descricao="Notas com comprovante baixado pelo motorista (documento e finalização)."
          linhas={cpRows}
          onRows={setCpRows}
        />
      </div>

      {(mapaNF || mapaCK || mapaCP) && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {mapaNF && <MapaCard titulo="Colunas identificadas — Notas Fiscais" mapa={mapaNF} />}
          {mapaCK && <MapaCard titulo="Colunas identificadas — Checklists" mapa={mapaCK} />}
          {mapaCP && <MapaCard titulo="Colunas identificadas — Comprovantes" mapa={mapaCP} />}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-end gap-4 rounded-lg border bg-card p-5">
        <Button onClick={processar} desativado={processando} size="lg">
          {processando ? "Processando..." : "Processando bases"}
        </Botão>
        <p className="text-sm text-muted-foreground">
          Cada NF é agrupada pelos seus próprios dados de emissão. Reprocessar atualização do histórico de
          todos os dias sem apagar registros existentes.
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
              ["NFs com carga", resultado.canhotos_esperados],
              ["Canhotos OK", resultado.canhotos_ok],
              ["Canhotos pendentes (dia)", resultado.canhotos_pendentes],
              ["Canhotos pendentes (acumulados)", resultado.canhotos_saldo_acumulado],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-md bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="text-xl font-semibold">{v°p>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function MapaCard({ título, mapa }: { título: string; mapa: Record<string, string | null> }) {
  retornar (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        {Object.entries(mapa).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 border-b border-dashed py-1">
            <dt className="capitalize text-muted-foreground">{kinstadt>
            <dd className={v ? "font-medium" : "text-muted-foreground"}>{v ?? "não encontrado"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

import { supabase } from "@/integrations/supabase/client";
import {
  finalizado,
  isoDia,
  type BaixaComprovante,
  type Esperado,
  type NotaComCarga,
  type Realizado,
} from "@/lib/checklist-core";

export const numeroDe = (chave: string) => chave.split(":")[1] ?? chave;

export type ResultadoProcessamento = {
  data_ref: string;
  esperados: number;
  realizados: number;
  novas_pendencias: number;
  pendencias_antigas: number;
  pendencias_resolvidas: number;
  saldo_acumulado: number;
  produtividade: { conferente: string; qtd: number }[];
};

type LinhaEsperado = {
  chave: string;
  tipo: string;
  data_nf: string | null;
  nfs: string[];
  qtd_nf: number;
  cliente: string | null;
  transportadora: string | null;
  uf: string | null;
  status: string;
  finalizado_em: string | null;
  conferente: string | null;
  checklist_id: string | null;
  primeira_deteccao: string;
  resolvido_em: string | null;
};

async function emLotes<T>(itens: T[], tamanho: number, fn: (lote: T[]) => Promise<void>) {
  for (let i = 0; i < itens.length; i += tamanho) {
    await fn(itens.slice(i, i + tamanho));
  }
}

export async function processarBases(
  dataRef: string,
  esperados: Esperado[],
  realizados: Realizado[],
): Promise<ResultadoProcessamento> {
  const validos = realizados.filter(finalizado);

  // 1. Grava o histórico de checklists realizados (sem duplicar)
  await emLotes(validos, 500, async (lote) => {
    const { error } = await supabase
      .from("checklists_realizados")
      .upsert(lote, { onConflict: "checklist_id" });
    if (error) throw error;
  });

  // 2. Estado anterior dos esperados
  const { data: anteriores, error: errAnt } = await supabase
    .from("checklists_esperados")
    .select("*");
  if (errAnt) throw errAnt;
  const mapaAnterior = new Map((anteriores ?? []).map((e) => [e.chave, e]));

  // 3. Insere os novos esperados detectados
  const novosRegistros: LinhaEsperado[] = [];
  for (const e of esperados) {
    if (mapaAnterior.has(e.chave)) continue;
    novosRegistros.push({
      chave: e.chave,
      tipo: e.tipo,
      data_nf: e.data_nf,
      nfs: e.nfs,
      qtd_nf: e.qtd_nf,
      cliente: e.cliente,
      transportadora: e.transportadora,
      uf: e.uf,
      status: "PENDENTE",
      finalizado_em: null,
      conferente: null,
      checklist_id: null,
      primeira_deteccao: dataRef,
      resolvido_em: null,
    });
  }
  if (novosRegistros.length) {
    await emLotes(novosRegistros, 500, async (lote) => {
      const { error } = await supabase
        .from("checklists_esperados")
        .upsert(lote, { onConflict: "chave" });
      if (error) throw error;
    });
  }

  // 4. Carrega todos os realizados gravados e cruza pela chave numérica
  const { data: todosRealizados, error: errReal } = await supabase
    .from("checklists_realizados")
    .select("checklist_id, chave, conferente, finalizado_em")
    .not("chave", "is", null)
    .limit(50000);
  if (errReal) throw errReal;

  const porNumero = new Map<string, { checklist_id: string; conferente: string | null; finalizado_em: string | null }>();
  for (const r of todosRealizados ?? []) {
    if (!r.chave) continue;
    const atual = porNumero.get(r.chave);
    if (!atual || (r.finalizado_em ?? "") < (atual.finalizado_em ?? "")) {
      porNumero.set(r.chave, r);
    }
  }

  const { data: atuais, error: errAtual } = await supabase
    .from("checklists_esperados")
    .select("*");
  if (errAtual) throw errAtual;

  let novasPendencias = 0;
  let pendenciasAntigas = 0;
  let pendenciasResolvidas = 0;
  const atualizacoes: { chave: string; status: string; finalizado_em: string | null; conferente: string | null; checklist_id: string | null; resolvido_em: string | null }[] = [];

  for (const e of atuais ?? []) {
    const match = porNumero.get(numeroDe(e.chave));
    const eraPendente = e.status === "PENDENTE";
    const ehNovo = !mapaAnterior.has(e.chave);

    if (match) {
      if (eraPendente) {
        atualizacoes.push({
          chave: e.chave,
          status: "REALIZADO",
          finalizado_em: match.finalizado_em,
          conferente: match.conferente,
          checklist_id: match.checklist_id,
          resolvido_em: dataRef,
        });
        if (!ehNovo) pendenciasResolvidas += 1;
      }
    } else if (eraPendente) {
      if (ehNovo) novasPendencias += 1;
      else pendenciasAntigas += 1;
    }
  }

  if (atualizacoes.length) {
    await emLotes(atualizacoes, 300, async (lote) => {
      for (const u of lote) {
        const { error } = await supabase
          .from("checklists_esperados")
          .update({
            status: u.status,
            finalizado_em: u.finalizado_em,
            conferente: u.conferente,
            checklist_id: u.checklist_id,
            resolvido_em: u.resolvido_em,
            updated_at: new Date().toISOString(),
          })
          .eq("chave", u.chave);
        if (error) throw error;
      }
    });
  }

  // 5. Indicadores do dia
  const { count: saldo } = await supabase
    .from("checklists_esperados")
    .select("chave", { count: "exact", head: true })
    .eq("status", "PENDENTE");

  const esperadosDoDia = esperados.length;
  const realizadosDoDia = esperados.filter((e) => porNumero.has(numeroDe(e.chave))).length;

  const prodMap = new Map<string, number>();
  for (const r of validos) {
    if (!r.finalizado_em || !r.conferente) continue;
    if (isoDia(new Date(r.finalizado_em)) !== dataRef) continue;
    prodMap.set(r.conferente, (prodMap.get(r.conferente) ?? 0) + 1);
  }
  const produtividade = [...prodMap.entries()]
    .map(([conferente, qtd]) => ({ conferente, qtd }))
    .sort((a, b) => b.qtd - a.qtd);

  const resumo: ResultadoProcessamento = {
    data_ref: dataRef,
    esperados: esperadosDoDia,
    realizados: realizadosDoDia,
    novas_pendencias: novasPendencias,
    pendencias_antigas: pendenciasAntigas,
    pendencias_resolvidas: pendenciasResolvidas,
    saldo_acumulado: saldo ?? 0,
    produtividade,
  };

  const { error: errResumo } = await supabase
    .from("resumo_diario")
    .upsert({ ...resumo, processado_em: new Date().toISOString() }, { onConflict: "data_ref" });
  if (errResumo) throw errResumo;

  return resumo;
}

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

const dia = (v: string | null | undefined) => (v ? v.slice(0, 10) : null);

export type ResumoDia = {
  data_ref: string;
  esperados: number;
  realizados: number;
  novas_pendencias: number;
  pendencias_antigas: number;
  pendencias_resolvidas: number;
  saldo_acumulado: number;
  produtividade: { conferente: string; qtd: number }[];
  canhotos_esperados: number;
  canhotos_ok: number;
  canhotos_pendentes: number;
};

export type ResultadoProcessamento = ResumoDia & { dias: number };

async function emLotes<T>(itens: T[], tamanho: number, fn: (lote: T[]) => Promise<void>) {
  for (let i = 0; i < itens.length; i += tamanho) {
    await fn(itens.slice(i, i + tamanho));
  }
}

/** Cruza as NFs com carga contra a base de comprovantes de entrega. */
export async function processarComprovantes(
  notas: NotaComCarga[],
  baixas: BaixaComprovante[],
): Promise<void> {
  const { data: existentes, error: errEx } = await supabase
    .from("comprovantes_nf")
    .select("nf, status")
    .limit(100000);
  if (errEx) throw errEx;
  const jaExiste = new Set((existentes ?? []).map((e) => e.nf));

  const novos = notas
    .filter((n) => !jaExiste.has(n.nf))
    .map((n) => ({
      nf: n.nf,
      carga: n.carga,
      cliente: n.cliente,
      transportadora: n.transportadora,
      uf: n.uf,
      data_nf: n.data_nf,
      unidade: null as string | null,
      cliente_destino: null as string | null,
      finalizacao: null as string | null,
      status: "PENDENTE",
      // a detecção passa a ser a própria data de emissão da NF
      primeira_deteccao: n.data_nf,
      resolvido_em: null as string | null,
    }));

  if (novos.length) {
    await emLotes(novos, 500, async (lote) => {
      const { error } = await supabase.from("comprovantes_nf").upsert(lote, { onConflict: "nf" });
      if (error) throw error;
    });
  }

  const mapaBaixa = new Map(baixas.map((b) => [b.nf, b]));

  const { data: todos, error: errTodos } = await supabase
    .from("comprovantes_nf")
    .select("nf, status")
    .limit(100000);
  if (errTodos) throw errTodos;

  const atualizar = (todos ?? [])
    .filter((c) => c.status === "PENDENTE" && mapaBaixa.has(c.nf))
    .map((c) => mapaBaixa.get(c.nf)!);

  await emLotes(atualizar, 200, async (lote) => {
    for (const b of lote) {
      const { error } = await supabase
        .from("comprovantes_nf")
        .update({
          status: "OK",
          finalizacao: b.finalizacao,
          unidade: b.unidade,
          cliente_destino: b.cliente_destino,
          resolvido_em: dia(b.finalizacao) ?? isoDia(new Date()),
        })
        .eq("nf", b.nf);
      if (error) throw error;
    }
  });
}

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

export async function processarBases(
  esperados: Esperado[],
  realizados: Realizado[],
  notasComCarga: NotaComCarga[] = [],
  baixas: BaixaComprovante[] = [],
): Promise<ResultadoProcessamento> {
  const hoje = isoDia(new Date());
  const validos = realizados.filter(finalizado);

  // 1. Histórico de checklists realizados
  await emLotes(validos, 500, async (lote) => {
    const { error } = await supabase
      .from("checklists_realizados")
      .upsert(lote, { onConflict: "checklist_id" });
    if (error) throw error;
  });

  // 2. Estado anterior
  const { data: anteriores, error: errAnt } = await supabase
    .from("checklists_esperados")
    .select("chave");
  if (errAnt) throw errAnt;
  const jaExiste = new Set((anteriores ?? []).map((e) => e.chave));

  // 3. Novos esperados — o dia vem da data de emissão da NF
  const novosRegistros: LinhaEsperado[] = [];
  for (const e of esperados) {
    if (jaExiste.has(e.chave)) continue;
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
      primeira_deteccao: e.data_nf ?? hoje,
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

  // 4. Cruzamento pela chave numérica
  const { data: todosRealizados, error: errReal } = await supabase
    .from("checklists_realizados")
    .select("checklist_id, chave, conferente, finalizado_em")
    .not("chave", "is", null)
    .limit(50000);
  if (errReal) throw errReal;

  const porNumero = new Map<
    string,
    { checklist_id: string; conferente: string | null; finalizado_em: string | null }
  >();
  for (const r of todosRealizados ?? []) {
    if (!r.chave) continue;
    const atual = porNumero.get(r.chave);
    if (!atual || (r.finalizado_em ?? "") < (atual.finalizado_em ?? "")) {
      porNumero.set(r.chave, r);
    }
  }

  const { data: atuais, error: errAtual } = await supabase
    .from("checklists_esperados")
    .select("chave, data_nf, status");
  if (errAtual) throw errAtual;

  const atualizacoes = (atuais ?? [])
    .filter((e) => e.status === "PENDENTE" && porNumero.has(numeroDe(e.chave)))
    .map((e) => {
      const m = porNumero.get(numeroDe(e.chave))!;
      return { chave: e.chave, ...m };
    });

  await emLotes(atualizacoes, 300, async (lote) => {
    for (const u of lote) {
      const { error } = await supabase
        .from("checklists_esperados")
        .update({
          status: "REALIZADO",
          finalizado_em: u.finalizado_em,
          conferente: u.conferente,
          checklist_id: u.checklist_id,
          resolvido_em: dia(u.finalizado_em) ?? hoje,
          updated_at: new Date().toISOString(),
        })
        .eq("chave", u.chave);
      if (error) throw error;
    }
  });

  // 5. Comprovantes
  await processarComprovantes(notasComCarga, baixas);

  // 6. Recalcula o histórico diário a partir da data de emissão das NFs
  const dias = await recalcularHistorico();
  const ultimo = dias[dias.length - 1];
  if (!ultimo) throw new Error("Nenhuma data de emissão encontrada na base de notas fiscais");
  return { ...ultimo, dias: dias.length };
}

/** Reconstrói resumo_diario agrupando tudo pela data de emissão da NF. */
export async function recalcularHistorico(): Promise<ResumoDia[]> {
  const [{ data: esp, error: e1 }, { data: cps, error: e2 }, { data: reals, error: e3 }] =
    await Promise.all([
      supabase
        .from("checklists_esperados")
        .select("chave, data_nf, status, resolvido_em")
        .limit(100000),
      supabase.from("comprovantes_nf").select("nf, data_nf, status, resolvido_em").limit(100000),
      supabase
        .from("checklists_realizados")
        .select("checklist_id, conferente, finalizado_em")
        .limit(100000),
    ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;

  const datas = new Set<string>();
  for (const e of esp ?? []) if (e.data_nf) datas.add(e.data_nf);
  for (const c of cps ?? []) if (c.data_nf) datas.add(c.data_nf);
  const ordenadas = [...datas].sort();

  // produtividade por dia de finalização
  const prodPorDia = new Map<string, Map<string, number>>();
  for (const r of reals ?? []) {
    const d = dia(r.finalizado_em);
    if (!d || !r.conferente) continue;
    const m = prodPorDia.get(d) ?? new Map<string, number>();
    m.set(r.conferente, (m.get(r.conferente) ?? 0) + 1);
    prodPorDia.set(d, m);
  }

  let saldo = 0;
  const linhas: ResumoDia[] = [];

  for (const d of ordenadas) {
    const espDia = (esp ?? []).filter((e) => e.data_nf === d);
    const pendentesDia = espDia.filter((e) => e.status === "PENDENTE").length;
    const realizadosDia = espDia.length - pendentesDia;
    // pendências de dias anteriores que continuam abertas
    const antigas = (esp ?? []).filter(
      (e) => e.data_nf && e.data_nf < d && e.status === "PENDENTE",
    ).length;
    // resolvidas neste dia (independente da data de emissão)
    const resolvidas = (esp ?? []).filter(
      (e) => e.status === "REALIZADO" && dia(e.resolvido_em) === d,
    ).length;

    saldo = (esp ?? []).filter(
      (e) => e.data_nf && e.data_nf <= d && e.status === "PENDENTE",
    ).length;

    const cpDia = (cps ?? []).filter((c) => c.data_nf === d);
    const cpPend = cpDia.filter((c) => c.status === "PENDENTE").length;

    const prod = [...(prodPorDia.get(d) ?? new Map<string, number>()).entries()]
      .map(([conferente, qtd]) => ({ conferente, qtd }))
      .sort((a, b) => b.qtd - a.qtd);

    linhas.push({
      data_ref: d,
      esperados: espDia.length,
      realizados: realizadosDia,
      novas_pendencias: pendentesDia,
      pendencias_antigas: antigas,
      pendencias_resolvidas: resolvidas,
      saldo_acumulado: saldo,
      produtividade: prod,
      canhotos_esperados: cpDia.length,
      canhotos_ok: cpDia.length - cpPend,
      canhotos_pendentes: cpPend,
    });
  }

  await emLotes(linhas, 200, async (lote) => {
    const { error } = await supabase
      .from("resumo_diario")
      .upsert(
        lote.map((l) => ({ ...l, processado_em: new Date().toISOString() })),
        { onConflict: "data_ref" },
      );
    if (error) throw error;
  });

  return linhas;
}

// Núcleo de regras: detecção de colunas, normalização de chaves e cruzamento.

export type Row = Record<string, unknown>;

const norm = (s: string) =>
  s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function pick(headers: string[], patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const found = headers.find((h) => p.test(norm(h)));
    if (found) return found;
  }
  return null;
}

export type MapaNF = {
  nf: string | null;
  carga: string | null;
  data: string | null;
  hora: string | null;
  cliente: string | null;
  transportadora: string | null;
  uf: string | null;
};

export type MapaCK = {
  objeto: string | null;
  conferente: string | null;
  finalizado: string | null;
  criado: string | null;
  status: string | null;
  roteiro: string | null;
  unidade: string | null;
  id: string | null;
};

export function detectarNF(headers: string[]): MapaNF {
  return {
    nf: pick(headers, [/^num\.? ?docto/, /docto/, /documento/, /\bnf\b/, /nota/, /^num/]),
    carga: pick(headers, [/carga/, /romaneio/]),
    data: pick(headers, [/dt ?emissao/, /emissao/, /data/]),
    hora: pick(headers, [/^hora/]),
    cliente: pick(headers, [/cliente/, /destinat/]),
    transportadora: pick(headers, [/transp/]),
    uf: pick(headers, [/uf/, /estado/]),
  };
}

export function detectarCK(headers: string[]): MapaCK {
  return {
    objeto: pick(headers, [/objeto/, /placa/, /carga/, /documento/]),
    conferente: pick(headers, [/executor/, /conferente/, /respons/, /usuario/]),
    finalizado: pick(headers, [/finaliz/, /conclu/, /encerr/]),
    criado: pick(headers, [/criado/, /abert/, /inicio/]),
    status: pick(headers, [/status/, /situac/]),
    roteiro: pick(headers, [/roteiro/, /formul/, /checklist ?tipo/]),
    unidade: pick(headers, [/unidade/, /filial/]),
    id: pick(headers, [/^checklist$/, /^id$/, /codigo/]),
  };
}

/** Extrai o primeiro bloco numérico e remove zeros à esquerda. */
export function chaveNumero(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const txt = String(valor).trim();
  if (!txt) return null;
  const m = txt.match(/\d+/);
  if (!m) return null;
  const limpo = m[0].replace(/^0+/, "");
  return limpo || null;
}

/** Converte valores diversos (Date, serial Excel, texto pt-BR) em Date. */
export function paraData(valor: unknown): Date | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === "number") {
    const ms = Math.round((valor - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const txt = String(valor).trim();
  const m = txt.match(
    /(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[^\d]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (m) {
    return new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      Number(m[4] ?? 0),
      Number(m[5] ?? 0),
      Number(m[6] ?? 0),
    );
  }
  const iso = new Date(txt);
  return isNaN(iso.getTime()) ? null : iso;
}

export const isoDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fmtData = (v: string | Date | null | undefined) => {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v.length === 10 ? v + "T00:00:00" : v) : v;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
};

export const fmtDataHora = (v: string | Date | null | undefined) => {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

export type Esperado = {
  chave: string;
  tipo: "CARGA" | "NF";
  data_nf: string | null;
  nfs: string[];
  qtd_nf: number;
  cliente: string | null;
  transportadora: string | null;
  uf: string | null;
};

/** Agrupa as NFs em checklists esperados (1 por carga, 1 por NF sem carga). */
export function montarEsperados(rows: Row[], mapa: MapaNF): Esperado[] {
  const out = new Map<string, Esperado>();
  for (const r of rows) {
    const nf = mapa.nf ? chaveNumero(r[mapa.nf]) : null;
    const carga = mapa.carga ? chaveNumero(r[mapa.carga]) : null;
    if (!nf && !carga) continue;
    const tipo: "CARGA" | "NF" = carga ? "CARGA" : "NF";
    const chave = carga ?? nf!;
    const id = `${tipo}:${chave}`;
    const dt = mapa.data ? paraData(r[mapa.data]) : null;
    const atual = out.get(id);
    if (atual) {
      if (nf && !atual.nfs.includes(nf)) atual.nfs.push(nf);
      atual.qtd_nf = atual.nfs.length;
      if (dt && (!atual.data_nf || isoDia(dt) < atual.data_nf)) atual.data_nf = isoDia(dt);
    } else {
      out.set(id, {
        chave: id,
        tipo,
        data_nf: dt ? isoDia(dt) : null,
        nfs: nf ? [nf] : [],
        qtd_nf: nf ? 1 : 0,
        cliente: mapa.cliente ? (r[mapa.cliente] ?? null)?.toString() ?? null : null,
        transportadora: mapa.transportadora
          ? (r[mapa.transportadora] ?? null)?.toString() ?? null
          : null,
        uf: mapa.uf ? (r[mapa.uf] ?? null)?.toString() ?? null : null,
      });
    }
  }
  return [...out.values()];
}

export type Realizado = {
  checklist_id: string;
  objeto_raw: string | null;
  chave: string | null;
  unidade: string | null;
  roteiro: string | null;
  localidade: string | null;
  conferente: string | null;
  criado_em: string | null;
  finalizado_em: string | null;
  status: string | null;
};

export function montarRealizados(rows: Row[], mapa: MapaCK): Realizado[] {
  const out = new Map<string, Realizado>();
  rows.forEach((r, i) => {
    const objeto = mapa.objeto ? r[mapa.objeto] : null;
    const chave = chaveNumero(objeto);
    const fim = mapa.finalizado ? paraData(r[mapa.finalizado]) : null;
    const ini = mapa.criado ? paraData(r[mapa.criado]) : null;
    const id = String((mapa.id ? r[mapa.id] : null) ?? `${chave ?? "x"}-${i}`);
    out.set(id, {
      checklist_id: id,
      objeto_raw: objeto ? String(objeto) : null,
      chave,
      unidade: mapa.unidade ? String(r[mapa.unidade] ?? "") || null : null,
      roteiro: mapa.roteiro ? String(r[mapa.roteiro] ?? "") || null : null,
      localidade: null,
      conferente: mapa.conferente ? String(r[mapa.conferente] ?? "").trim() || null : null,
      criado_em: ini ? ini.toISOString() : null,
      finalizado_em: fim ? fim.toISOString() : null,
      status: mapa.status ? String(r[mapa.status] ?? "") || null : null,
    });
  });
  return [...out.values()];
}

export const finalizado = (r: Realizado) =>
  !!r.finalizado_em && /finaliz|conclu/i.test(r.status ?? "Execução finalizada");

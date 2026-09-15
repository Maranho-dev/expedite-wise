CREATE TABLE public.checklists_esperados (
  chave text PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('CARGA','NF')),
  data_nf date,
  nfs jsonb NOT NULL DEFAULT '[]'::jsonb,
  qtd_nf integer NOT NULL DEFAULT 0,
  cliente text,
  transportadora text,
  uf text,
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('REALIZADO','PENDENTE')),
  finalizado_em timestamptz,
  conferente text,
  checklist_id text,
  primeira_deteccao date NOT NULL DEFAULT current_date,
  resolvido_em date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklists_esperados TO anon, authenticated;
GRANT ALL ON public.checklists_esperados TO service_role;
ALTER TABLE public.checklists_esperados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acesso aberto esperados" ON public.checklists_esperados FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.checklists_realizados (
  checklist_id text PRIMARY KEY,
  objeto_raw text,
  chave text,
  unidade text,
  roteiro text,
  localidade text,
  conferente text,
  criado_em timestamptz,
  finalizado_em timestamptz,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_realizados_chave ON public.checklists_realizados (chave);
CREATE INDEX idx_realizados_fim ON public.checklists_realizados (finalizado_em);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklists_realizados TO anon, authenticated;
GRANT ALL ON public.checklists_realizados TO service_role;
ALTER TABLE public.checklists_realizados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acesso aberto realizados" ON public.checklists_realizados FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.resumo_diario (
  data_ref date PRIMARY KEY,
  esperados integer NOT NULL DEFAULT 0,
  realizados integer NOT NULL DEFAULT 0,
  novas_pendencias integer NOT NULL DEFAULT 0,
  pendencias_antigas integer NOT NULL DEFAULT 0,
  pendencias_resolvidas integer NOT NULL DEFAULT 0,
  saldo_acumulado integer NOT NULL DEFAULT 0,
  produtividade jsonb NOT NULL DEFAULT '[]'::jsonb,
  processado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resumo_diario TO anon, authenticated;
GRANT ALL ON public.resumo_diario TO service_role;
ALTER TABLE public.resumo_diario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acesso aberto resumo" ON public.resumo_diario FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
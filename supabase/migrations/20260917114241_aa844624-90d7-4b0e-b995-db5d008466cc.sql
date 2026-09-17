CREATE TABLE public.comprovantes_nf (
  nf text PRIMARY KEY,
  carga text,
  cliente text,
  transportadora text,
  uf text,
  data_nf date,
  unidade text,
  cliente_destino text,
  finalizacao timestamptz,
  status text NOT NULL DEFAULT 'PENDENTE',
  primeira_deteccao date NOT NULL DEFAULT CURRENT_DATE,
  resolvido_em date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comprovantes_nf TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comprovantes_nf TO authenticated;
GRANT ALL ON public.comprovantes_nf TO service_role;

ALTER TABLE public.comprovantes_nf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso aberto comprovantes" ON public.comprovantes_nf
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_comprovantes_nf_updated_at
BEFORE UPDATE ON public.comprovantes_nf
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.resumo_diario
  ADD COLUMN canhotos_esperados integer NOT NULL DEFAULT 0,
  ADD COLUMN canhotos_ok integer NOT NULL DEFAULT 0,
  ADD COLUMN canhotos_pendentes integer NOT NULL DEFAULT 0;
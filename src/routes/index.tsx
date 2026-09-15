import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, Kpi } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fmtData } from "@/lib/checklist-core";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel de Checklists de Expedição — Logística" },
      {
        name: "description",
        content:
          "Acompanhe diariamente os checklists esperados, realizados, pendentes e o saldo acumulado de pendências da expedição.",
      },
      { property: "og:title", content: "Painel de Checklists de Expedição" },
      {
        property: "og:description",
        content: "Checklists esperados, realizados, pendências e produtividade dos conferentes.",
      },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { data, isLoading } = useQuery({
    queryKey: ["painel"],
    queryFn: async () => {
      const [resumo, pendentes, total] = await Promise.all([
        supabase.from("resumo_diario").select("*").order("data_ref", { ascending: false }).limit(1),
        supabase
          .from("checklists_esperados")
          .select("chave", { count: "exact", head: true })
          .eq("status", "PENDENTE"),
        supabase.from("checklists_esperados").select("chave", { count: "exact", head: true }),
      ]);
      return {
        ultimo: resumo.data?.[0] ?? null,
        pendentes: pendentes.count ?? 0,
        total: total.count ?? 0,
      };
    },
  });

  if (isLoading) {
    return (
      <AppShell titulo="Painel do dia">
        <p className="text-sm text-muted-foreground">Carregando indicadores...</p>
      </AppShell>
    );
  }

  const u = data?.ultimo;

  if (!u) {
    return (
      <AppShell
        titulo="Painel do dia"
        descricao="Ainda não há nenhum dia processado."
      >
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Envie a base de notas fiscais e a base de checklists para gerar os indicadores.
          </p>
          <Button asChild className="mt-4">
            <Link to="/atualizar">Atualizar bases</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const aderencia = u.esperados ? Math.round((u.realizados / u.esperados) * 100) : 0;

  return (
    <AppShell
      titulo="Painel do dia"
      descricao={`Última atualização referente a ${fmtData(u.data_ref)}.`}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Checklists esperados" valor={u.esperados} detalhe="No dia de referência" />
        <Kpi rotulo="Realizados" valor={u.realizados} tom="success" detalhe={`${aderencia}% de aderência`} />
        <Kpi
          rotulo="Pendentes do dia"
          valor={u.esperados - u.realizados}
          tom="warning"
          detalhe="Esperados sem checklist"
        />
        <Kpi
          rotulo="Saldo acumulado"
          valor={u.saldo_acumulado}
          tom="destructive"
          detalhe="Pendências abertas no total"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Kpi rotulo="Novas pendências" valor={u.novas_pendencias} />
        <Kpi rotulo="Pendências antigas" valor={u.pendencias_antigas} />
        <Kpi rotulo="Pendências resolvidas" valor={u.pendencias_resolvidas} tom="success" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Produtividade do dia</h2>
          {Array.isArray(u.produtividade) && u.produtividade.length ? (
            <ul className="mt-3 space-y-2">
              {(u.produtividade as { conferente: string; qtd: number }[]).slice(0, 8).map((p) => (
                <li key={p.conferente} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-3">{p.conferente}</span>
                  <span className="tabular font-semibold">{p.qtd}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum checklist finalizado nessa data.
            </p>
          )}
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/produtividade">Ver análise completa</Link>
          </Button>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Base de controle</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {data?.total.toLocaleString("pt-BR")} checklists acompanhados desde o início, dos quais{" "}
            <strong className="text-foreground">{data?.pendentes.toLocaleString("pt-BR")}</strong>{" "}
            continuam em aberto.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/pendencias">Ver pendências</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

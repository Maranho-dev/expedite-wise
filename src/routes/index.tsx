import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, Kpi } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fmtData, isoDia } from "@/lib/checklist-core";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel de Checklists de Expedição — Logística" },
      {
        name: "description",
        content:
          "Acompanhe diariamente os checklists esperados, realizados, pendentes, comprovantes de entrega e o saldo acumulado de pendências da expedição.",
      },
      { property: "og:title", content: "Painel de Checklists de Expedição" },
      {
        property: "og:description",
        content: "Checklists esperados, realizados, pendências, canhotos e produtividade.",
      },
    ],
  }),
  component: Painel,
});

const ontem = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return isoDia(d);
};

function Painel() {
  const [dataSel, setDataSel] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["painel"],
    queryFn: async () => {
      const [resumos, pendentes, total, canhotosPend] = await Promise.all([
        supabase.from("resumo_diario").select("*").order("data_ref", { ascending: false }).limit(400),
        supabase
          .from("checklists_esperados")
          .select("chave", { count: "exact", head: true })
          .eq("status", "PENDENTE"),
        supabase.from("checklists_esperados").select("chave", { count: "exact", head: true }),
        supabase
          .from("comprovantes_nf")
          .select("nf", { count: "exact", head: true })
          .eq("status", "PENDENTE"),
      ]);
      return {
        resumos: resumos.data ?? [],
        pendentes: pendentes.count ?? 0,
        total: total.count ?? 0,
        canhotosPendentes: canhotosPend.count ?? 0,
      };
    },
  });

  const resumos = data?.resumos ?? [];

  const selecionado = useMemo(() => {
    if (!resumos.length) return null;
    if (dataSel) return resumos.find((r) => r.data_ref === dataSel) ?? null;
    return resumos.find((r) => r.data_ref === ontem()) ?? resumos[0]!;
  }, [resumos, dataSel]);

  if (isLoading) {
    return (
      <AppShell titulo="Painel do dia">
        <p className="text-sm text-muted-foreground">Carregando indicadores...</p>
      </AppShell>
    );
  }

  if (!resumos.length) {
    return (
      <AppShell titulo="Painel do dia" descricao="Ainda não há nenhum dia processado.">
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Envie a base de notas fiscais, a de checklists e a de comprovantes para gerar os
            indicadores.
          </p>
          <Button asChild className="mt-4">
            <Link to="/atualizar">Atualizar bases</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const dataAtiva = selecionado?.data_ref ?? dataSel ?? resumos[0]!.data_ref;

  const filtro = (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
      <div className="space-y-1.5">
        <Label htmlFor="dia">Data de referência</Label>
        <Input
          id="dia"
          type="date"
          className="w-44"
          value={dataAtiva}
          onChange={(e) => setDataSel(e.target.value)}
        />
      </div>
      <Button variant="outline" size="sm" onClick={() => setDataSel(ontem())}>
        Ontem (D-1)
      </Button>
      <Button variant="outline" size="sm" onClick={() => setDataSel(isoDia(new Date()))}>
        Hoje
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setDataSel(resumos[0]!.data_ref)}>
        Último processado ({fmtData(resumos[0]!.data_ref)})
      </Button>
    </div>
  );

  if (!selecionado) {
    return (
      <AppShell titulo="Painel do dia" descricao="Escolha uma data já processada.">
        {filtro}
        <div className="mt-5 rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Não há processamento registrado em {fmtData(dataAtiva)}. As datas disponíveis mais
          recentes são:{" "}
          {resumos
            .slice(0, 5)
            .map((r) => fmtData(r.data_ref))
            .join(", ")}
          .
        </div>
      </AppShell>
    );
  }

  const u = selecionado;
  const aderencia = u.esperados ? Math.round((u.realizados / u.esperados) * 100) : 0;

  return (
    <AppShell
      titulo="Painel do dia"
      descricao={`Indicadores referentes a ${fmtData(u.data_ref)}.`}
    >
      {filtro}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Checklists esperados" valor={u.esperados} detalhe="No dia de referência" />
        <Kpi
          rotulo="Realizados"
          valor={u.realizados}
          tom="success"
          detalhe={`${aderencia}% de aderência`}
        />
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

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Kpi rotulo="Notas com carga" valor={u.canhotos_esperados ?? 0} detalhe="Exigem canhoto" />
        <Kpi rotulo="Comprovantes OK" valor={u.canhotos_ok ?? 0} tom="success" />
        <Kpi
          rotulo="Canhotos pendentes"
          valor={u.canhotos_pendentes ?? 0}
          tom="destructive"
          detalhe="Saldo acumulado de canhotos"
        />
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
          <h2 className="font-semibold">Situação atual das bases</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {data?.total.toLocaleString("pt-BR")} checklists acompanhados desde o início, dos quais{" "}
            <strong className="text-foreground">{data?.pendentes.toLocaleString("pt-BR")}</strong>{" "}
            continuam em aberto, e{" "}
            <strong className="text-foreground">
              {data?.canhotosPendentes.toLocaleString("pt-BR")}
            </strong>{" "}
            comprovantes de entrega ainda não foram baixados.
          </p>
          <div className="mt-4 flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/pendencias">Ver pendências</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/canhotos">Ver canhotos</Link>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

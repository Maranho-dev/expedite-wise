import { Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Painel" },
  { to: "/pendencias", label: "Pendências" },
  { to: "/canhotos", label: "Canhotos" },
  { to: "/produtividade", label: "Produtividade" },
  { to: "/horarios", label: "Horários" },
  { to: "/historico", label: "Histórico" },
  { to: "/atualizar", label: "Atualizar bases" },
] as const;

export function AppShell({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ClipboardCheck className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">Checklists de Expedição</p>
              <p className="text-xs text-muted-foreground">Controle e acompanhamento — Logística</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-1">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground font-medium" }}
                activeOptions={{ exact: n.to === "/" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-7">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descricao ? <p className="mt-1 text-sm text-muted-foreground">{descricao}</p> : null}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}

export function Kpi({
  rotulo,
  valor,
  detalhe,
  tom = "default",
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: string;
  tom?: "default" | "success" | "warning" | "destructive" | "primary";
}) {
  const tons: Record<string, string> = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={`tabular mt-2 text-3xl font-semibold ${tons[tom]}`}>{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}

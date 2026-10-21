import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import interCss from "@fontsource-variable/inter/index.css?url";
import monoCss400 from "@fontsource/jetbrains-mono/latin-400.css?url";
import monoCss500 from "@fontsource/jetbrains-mono/latin-500.css?url";
import logoWebp from "../assets/helion-logo.webp";

const SITE = "https://usehelion.com.br";

const btn = "inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

function NotFoundComponent() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4" style={{ background: "#050505", color: "#F5F5F7" }}>
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold" style={{ color: "#F59E0B" }}>404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm" style={{ color: "#A1A1AA" }}>
          Este caminho ficou no breu. A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link to="/" className={btn} style={{ background: "#F59E0B", color: "#050505" }}>
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <main role="alert" className="flex min-h-screen items-center justify-center px-4" style={{ background: "#050505", color: "#F5F5F7" }}>
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">Ops, esta página não carregou</h1>
        <p className="mt-2 text-sm" style={{ color: "#A1A1AA" }}>
          Tivemos um problema do nosso lado. Tente de novo ou volte para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className={btn}
            style={{ background: "#F59E0B", color: "#050505" }}
          >
            Tentar de novo
          </button>
          <a href="/" className={btn} style={{ border: "1px solid #3f3f46", color: "#F5F5F7" }}>
            Voltar ao início
          </a>
        </div>
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HELION · Glossário de Tecnologia com IA" },
      { name: "description", content: "HELION — glossário interativo de tecnologia: explica jargões, siglas e prints de código em português, com IA." },
      { name: "theme-color", content: "#050505" },
      { property: "og:title", content: "HELION · Glossário de Tecnologia com IA" },
      { property: "og:description", content: "Traduzindo o técnico, iluminando o humano — explique qualquer termo, sigla ou print de código." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/` },
      { property: "og:image", content: `${SITE}/og.png` },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE}/og.png` },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: interCss },
      { rel: "stylesheet", href: monoCss400 },
      { rel: "stylesheet", href: monoCss500 },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "canonical", href: `${SITE}/` },
      { rel: "preload", as: "image", href: logoWebp, type: "image/webp" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}

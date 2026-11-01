import { HeadContent, Link, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { APP_NAME, Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import TanStackQueryDevtools from "@/integrations/tanstack-query/devtools";
import { viewerQuery } from "@/lib/queries";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
    const viewer = await context.queryClient.fetchQuery(viewerQuery);
    return { viewer };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#f6f7f9" },
      { title: `${APP_NAME} · Licitaciones públicas para tu empresa` },
      {
        name: "description",
        content:
          "Encuentra licitaciones públicas en España que encajan con tu empresa y recibe avisos automáticos.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%231f45c9'/><path d='M10 8h9l4 4v12H10z' fill='white'/></svg>",
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center px-6 text-center">
      <div className="max-w-sm space-y-4">
        <Link to="/" className="inline-block">
          <Logo />
        </Link>
        <p className="tabular text-5xl font-semibold tracking-tight">404</p>
        <h1 className="text-lg font-medium">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground">
          El enlace no existe o la licitación ya no está disponible.
        </p>
        <Button asChild>
          <Link to="/">Volver al inicio</Link>
        </Button>
      </div>
    </main>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="light" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster position="bottom-right" richColors closeButton />
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: "bottom-left" }}
            plugins={[
              { name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> },
              TanStackQueryDevtools,
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Toaster } from "sonner";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AuthProvider } from "@/lib/auth/provider";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Like New — سوق الأجهزة الطبية" },
      {
        name: "description",
        content: "Like New سوق إعلانات لكل أقسام الطب: بيع وإيجار وطلبات أجهزة ومستلزمات. السوق يبدأ فاضي.",
      },
      { name: "theme-color", content: "#0e6b57" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap",
      },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 8_000, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <html lang="ar" dir="rtl" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <QueryClientProvider client={client}>
          <AuthProvider>
            <Outlet />
          </AuthProvider>
          <Toaster position="top-center" />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

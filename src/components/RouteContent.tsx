import { Component, type ReactNode, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="app-layout-container min-h-screen flex items-center justify-center p-6">
          <div role="alert" className="max-w-md space-y-4">
            <h1 className="text-xl font-semibold">Não foi possível abrir esta página</h1>
            <p className="text-muted-foreground">Verifique sua conexão e tente novamente. Você também pode acessar outra página pelo menu.</p>
            <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground" onClick={() => window.location.reload()}>
              Tentar novamente
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

export function RouteContent({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation();
  const container = useRef<HTMLDivElement>(null);
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (!hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    // Keep the persistent menu out of the page's focus/scroll lifecycle.
    container.current?.focus({ preventScroll: true });
  }, [pathname, hash]);

  return (
    <div ref={container} tabIndex={-1} className="outline-none" aria-label="Conteúdo da página">
      <PageErrorBoundary key={pathname}>{children}</PageErrorBoundary>
    </div>
  );
}

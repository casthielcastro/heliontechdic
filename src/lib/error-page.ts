export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Algo deu errado · HELION</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #050505; color: #F5F5F7; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #A1A1AA; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #F59E0B; color: #050505; }
      .secondary { background: transparent; color: #F5F5F7; border-color: #3f3f46; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Ops, esta página não carregou</h1>
      <p>Tivemos um problema do nosso lado. Tente recarregar ou volte para o início.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar de novo</button>
        <a class="secondary" href="/">Voltar ao início</a>
      </div>
    </div>
  </body>
</html>`;
}

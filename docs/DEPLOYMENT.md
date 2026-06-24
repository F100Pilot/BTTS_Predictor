# Guia de Deploy — GitHub Pages

A aplicação é 100% estática, pelo que pode ser alojada gratuitamente no GitHub Pages.

## Opção A — Deploy automático (recomendado)

O repositório inclui o workflow [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), que faz lint, type-check, testes, build e publicação automaticamente.

### Passos

1. **Faça push** do projeto para um repositório GitHub (branch `main` ou `master`).
2. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada push para `main`/`master` dispara o deploy. O URL final será:
   ```
   https://<utilizador>.github.io/<repo>/
   ```

### Base path

O workflow define automaticamente `VITE_BASE=/<nome-do-repositório>/`. Não é necessário configurar nada manualmente.

> Se usar um **domínio personalizado** ou o repositório `<utilizador>.github.io`, defina `VITE_BASE=/` (adicione um ficheiro `.env` com `VITE_BASE=/` ou edite o workflow).

## Opção B — Deploy manual

```bash
# 1. Build com o base path correto
VITE_BASE=/<repo>/ npm run build

# 2. Publicar a pasta dist/ no branch gh-pages
npx gh-pages -d dist        # requer: npm i -D gh-pages
```

Depois, em **Settings → Pages**, selecione o branch `gh-pages` como origem.

## Verificação pós-deploy

- A app abre em `https://<utilizador>.github.io/<repo>/`.
- O routing usa **HashRouter** (`/#/...`), por isso o refresh em rotas profundas funciona sem 404.
- Existe um `404.html` de fallback adicional.
- Em **DevTools → Application → Manifest/Service Workers**, confirme que a PWA está registada e instalável.

## Performance

O build aplica code-splitting e as bibliotecas pesadas de exportação (xlsx, jsPDF) e gráficos são carregadas **on-demand**, mantendo o carregamento inicial leve (objetivo Lighthouse > 90).

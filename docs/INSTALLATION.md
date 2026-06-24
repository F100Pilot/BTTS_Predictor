# Guia de Instalação

## 1. Pré-requisitos

- **Node.js ≥ 20** (recomendado LTS) — verifique com `node --version`.
- **npm ≥ 10** (incluído no Node).
- **Git**.

## 2. Clonar e instalar

```bash
git clone <repo-url>
cd btts-analytics-pro
npm install
```

## 3. Ambiente de desenvolvimento

```bash
npm run dev
```

Abra `http://localhost:5173`. A app arranca com a fonte **Dados de Demonstração** — não precisa de chaves.

## 4. Configurar uma fonte real (opcional)

1. Registe-se numa API (ex.: [Football-Data.org](https://www.football-data.org/client/register)) e obtenha a chave gratuita.
2. Na app, vá a **Definições → Fonte de Dados**.
3. Selecione o fornecedor e cole a chave (guardada apenas no seu dispositivo).
4. Mantenha "Usar dados de demonstração quando a fonte falhar" ativo para resiliência.

> **Nota CORS:** algumas APIs não permitem chamadas diretas do browser. Nesse caso use a versão APK (Capacitor) ou um proxy. Ver `ARCHITECTURE.md` §9.2.

## 5. Variáveis de ambiente (opcional)

Crie um ficheiro `.env.local`:

```
# Caminho base ao servir num subdiretório (GitHub Pages)
VITE_BASE=/btts_predictor/
# Nível de log: debug | info | warn | error
VITE_LOG_LEVEL=info
```

## 6. Build de produção

```bash
npm run build
npm run preview   # pré-visualiza dist/
```

## 7. Qualidade

```bash
npm run typecheck
npm run lint
npm test
```

## Resolução de problemas

| Problema | Solução |
|---|---|
| Página em branco no GitHub Pages | Confirme `VITE_BASE=/<repo>/` no build. |
| Sem jogos no painel | Verifique a data selecionada; a fonte mock gera jogos para qualquer data. |
| Erros de CORS com API real | Use Capacitor (APK) ou um proxy; ver `ARCHITECTURE.md`. |
| Ícones PWA em falta | Corra `node scripts/generate-icons.mjs`. |

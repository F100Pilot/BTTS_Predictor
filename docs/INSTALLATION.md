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

Abra `http://localhost:5173`.

## 4. Configurar a fonte de dados (Flashscore via RapidAPI)

A app usa o **Flashscore (RapidAPI)** como fonte. É preciso uma chave RapidAPI e um Proxy CORS (o teu Cloudflare Worker).

1. Subscreve a API do **Flashscore no [RapidAPI](https://rapidapi.com/)** e copia a tua `x-rapidapi-key`.
2. Cria o **Proxy CORS** (Cloudflare Worker) — ver [`CORS-PROXY.md`](./CORS-PROXY.md). O mesmo Worker serve também a sincronização entre dispositivos.
3. Na app, vai a **Definições → Fonte de Dados** e preenche a **chave RapidAPI** e o **Proxy CORS** (guardados apenas no teu dispositivo).
4. Usa **"Testar ligação"** para confirmar (deve mostrar jogos do dia e a forma das equipas).

> **CORS:** o browser não pode chamar o RapidAPI diretamente (CORS + cabeçalho da chave); por isso o Proxy CORS é obrigatório. Ver `ARCHITECTURE.md` §9.2.

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
| Sem jogos no painel | Verifique a data selecionada, a chave RapidAPI e o Proxy CORS; use "Testar ligação" em Definições. |
| Erros de CORS com API real | Use Capacitor (APK) ou um proxy; ver `ARCHITECTURE.md`. |
| Ícones PWA em falta | Corra `node scripts/generate-icons.mjs`. |

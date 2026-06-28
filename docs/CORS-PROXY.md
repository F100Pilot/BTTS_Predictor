# Proxy CORS (Cloudflare Worker) para o RapidAPI/Flashscore

> **Nota (v0.2.37+):** a app usa o **Flashscore via RapidAPI** como única fonte. O
> browser não pode chamar o RapidAPI diretamente (sem CORS e a chave teria de ir
> no pedido), por isso é **obrigatório** um Proxy CORS. O Worker pronto a usar
> está em [`worker/`](../worker) (reencaminha os cabeçalhos `x-rapidapi-*` e expõe
> o endpoint `/sync` da sincronização) e faz deploy automático. O exemplo abaixo é
> ilustrativo/genérico — para o Worker real e completo, vê a pasta `worker/`.

Quando a app corre no browser, um pedido a uma API sem cabeçalhos CORS é
**bloqueado** — não é um bug da app, é uma política de segurança do browser. Um
Proxy CORS (o teu Worker) resolve isto.

Tens 3 formas de resolver. A recomendada é a opção A.

---

## Opção A — Cloudflare Worker gratuito (recomendado)

Um Worker é um mini-servidor gratuito que reencaminha o pedido e adiciona os cabeçalhos CORS.
A tua chave fica no **teu** Worker (não num terceiro).

### Passos
1. Cria conta grátis em https://dash.cloudflare.com → **Workers & Pages** → **Create Worker**.
2. Substitui o código por:

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors() });
    }

    // Reencaminha tudo para a Football-Data.org, mantendo path + query
    const target = 'https://api.football-data.org' + url.pathname + url.search;
    const upstream = await fetch(target, {
      headers: { 'X-Auth-Token': request.headers.get('X-Auth-Token') || '' },
    });

    const headers = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors())) headers.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'X-Auth-Token, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    // Expor o cabeçalho de quota para a app poder mostrar os pedidos restantes.
    'Access-Control-Expose-Headers': 'X-Requests-Available-Minute',
  };
}
```

> Se já tens o Worker criado, acrescenta a linha `Access-Control-Expose-Headers`
> acima para veres "Pedidos restantes" no painel. Sem ela, o browser esconde o
> cabeçalho de quota (no APK aparece sempre, pois não há CORS).

### Deploy automático (GitHub Actions)

Em vez de colar o código à mão, o worker pode ser atualizado automaticamente. O
código está em [`worker/`](../worker/) e o workflow
[`deploy-worker.yml`](../.github/workflows/deploy-worker.yml) faz o deploy
sempre que `worker/` mudar. Basta adicionar dois *secrets* no GitHub
(`CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`) — ver
[`worker/README.md`](../worker/README.md).

3. **Deploy**. Copia o URL do Worker (ex.: `https://btts-proxy.o-teu-nome.workers.dev`).
4. Na app: **Definições → Proxy CORS (opcional)** → cola esse URL.
5. Volta ao painel. Os jogos reais aparecem. ✅

> Segurança: a chave passa pelo teu Worker (na tua conta Cloudflare). Para restringir, podes
> validar no Worker o cabeçalho `Origin` e só aceitar o domínio do teu GitHub Pages.

---

## Opção B — Proxy público (teste rápido, não recomendado para uso contínuo)

Apenas para confirmar que o problema é mesmo o CORS:

Em **Definições → Proxy CORS**, cola:
```
https://corsproxy.io/?url={url}
```
O marcador `{url}` é substituído pelo endereço alvo (codificado). É lento, tem limites e a tua
chave passa por um terceiro — usa só para testar.

---

## Opção C — APK (Capacitor)

Dentro da app nativa **não há CORS de browser**, por isso a Football-Data.org funciona
diretamente, sem proxy. Ver [`docs/APK.md`](./APK.md).

---

## Importar do FootyStats por link (Calculadora)

A Calculadora pode buscar as estatísticas de uma equipa só com o link, em vez de copiar a página.
Para isso o proxy precisa do formato **marcador** `?url={url}` (o `{url}` é substituído pelo endereço
alvo). O Worker incluído em [`worker/`](../worker/) já suporta isto — além do football-data
(`/v4/...`), aceita `/?url=<alvo>` e busca a página com um *User-Agent* de browser, limitado a uma
lista de domínios (footystats.org, betexplorer.com, api.football-data.org).

Para ativar, em **Definições → Proxy CORS** usa o teu Worker no formato marcador:
```
https://btts-proxy.<o-teu-subdominio>.workers.dev/?url={url}
```
Assim **um único proxy** serve o football-data e o FootyStats/BetExplorer. Nota: alguns sites com
proteção anti-bot podem na mesma bloquear o pedido do Worker — nesse caso usa "Colar conteúdo".

## Notas

- O campo **Proxy CORS** aceita dois formatos:
  - **Prefixo de origem**: `https://o-meu-worker.workers.dev` (o caminho `/v4/...` é acrescentado).
  - **Marcador**: `https://qualquer-proxy/?url={url}` (o alvo codificado substitui `{url}`).
- O plano **gratuito** da Football-Data.org cobre um conjunto limitado de competições
  (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Primeira Liga, Champions League,
  Mundial, Euro, etc.) e tem limite de ~10 pedidos/minuto (a app já faz *rate limiting* e cache).
- Se um dia não houver jogos na data escolhida, a tabela aparece vazia — experimenta outra data.

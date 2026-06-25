# Resolver o CORS da Football-Data.org (e outras APIs)

A Football-Data.org **não envia cabeçalhos CORS**. Por isso, quando a app corre no browser
(GitHub Pages), o pedido direto a `https://api.football-data.org/...` é **bloqueado** e o
dashboard fica vazio. Isto **não** é um bug da app — é uma política de segurança do browser.

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
  };
}
```

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

## Notas

- O campo **Proxy CORS** aceita dois formatos:
  - **Prefixo de origem**: `https://o-meu-worker.workers.dev` (o caminho `/v4/...` é acrescentado).
  - **Marcador**: `https://qualquer-proxy/?url={url}` (o alvo codificado substitui `{url}`).
- O plano **gratuito** da Football-Data.org cobre um conjunto limitado de competições
  (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Primeira Liga, Champions League,
  Mundial, Euro, etc.) e tem limite de ~10 pedidos/minuto (a app já faz *rate limiting* e cache).
- Se um dia não houver jogos na data escolhida, a tabela aparece vazia — experimenta outra data.

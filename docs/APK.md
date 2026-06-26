# Guia de Conversão para APK (Android) / IPA (iOS) — Capacitor

A app já inclui [`capacitor.config.ts`](../capacitor.config.ts). Estes passos empacotam a PWA como aplicação nativa.

## Pré-requisitos

- **Android:** Android Studio + JDK 17.
- **iOS:** macOS + Xcode (apenas em Mac).
- Node.js ≥ 20.

## 1. Instalar o Capacitor

```bash
npm install @capacitor/core
npm install -D @capacitor/cli
# Plataformas (instale a(s) que precisar)
npm install @capacitor/android
npm install @capacitor/ios
```

> O `capacitor.config.ts` está pré-configurado:
> `appId: com.bttsanalytics.pro`, `appName: BTTS Analytics Pro`, `webDir: dist`.

## 2. Build da app web

```bash
# Para empacotamento nativo, use base path "/"
VITE_BASE=/ npm run build
```

## 3. Adicionar plataformas

```bash
npx cap add android
npx cap add ios       # apenas macOS
```

## 4. Sincronizar os assets web

Sempre que reconstruir a web:

```bash
VITE_BASE=/ npm run build
npx cap sync
```

## 5. Abrir e compilar

```bash
npx cap open android   # abre o Android Studio
npx cap open ios       # abre o Xcode
```

- **Android:** em Android Studio, *Build → Build Bundle(s)/APK(s) → Build APK(s)*. O APK fica em `android/app/build/outputs/apk/`.
- **iOS:** em Xcode, selecione um destino e *Product → Archive*.

## 6. Notas importantes

- **Service Worker:** o Capacitor serve a partir do sistema de ficheiros; o SW da PWA não é necessário no nativo, mas não interfere.
- **CORS:** dentro do invólucro nativo, as chamadas às APIs **não** estão sujeitas a CORS do browser — fontes como Football-Data.org passam a funcionar diretamente.
- **Ícones/Splash:** use `@capacitor/assets` para gerar ícones e splash a partir de uma imagem fonte:
  ```bash
  npm install -D @capacitor/assets
  npx capacitor-assets generate
  ```
- **Pastas nativas** (`/android`, `/ios`) estão no `.gitignore` por defeito; remova-as de lá se quiser versioná-las.

## Resolução de problemas

| Problema | Solução |
|---|---|
| Ecrã branco no arranque | Confirme `VITE_BASE=/` no build antes de `cap sync`. |
| Alterações não aparecem | Corra `npm run build && npx cap sync` novamente. |
| Erro `@capacitor/cli` não encontrado | Instale as dependências do passo 1. |

---

# APK pelo PWABuilder (TWA) — barra de endereço e conflitos

O [PWABuilder.com](https://www.pwabuilder.com) gera um APK no formato **TWA**
(Trusted Web Activity). É a via mais simples, mas tem dois pormenores típicos.

## A. Tirar a barra de endereço do browser

A TWA só esconde a barra do browser se a verificação **Digital Asset Links**
passar. Para isso o ficheiro `assetlinks.json` (vem no download do PWABuilder)
tem de estar na **raiz do domínio**, não no subcaminho da app:

```
✅ https://f100pilot.github.io/.well-known/assetlinks.json
❌ https://f100pilot.github.io/btts_predictor/.well-known/assetlinks.json
```

Como a app é servida em `/btts_predictor/`, a raiz `f100pilot.github.io/` é
servida por **outro** repositório. Passos:

1. Cria um repositório público chamado exatamente **`f100pilot.github.io`**.
2. Adiciona o ficheiro **`.well-known/assetlinks.json`** (usa o que veio no
   download do PWABuilder — já tem o `package_name` e o `sha256_cert_fingerprints`
   corretos para a tua chave).
3. Em *Settings → Pages*, ativa o GitHub Pages (branch `main`, pasta `/root`).
4. Confirma que abre em
   `https://f100pilot.github.io/.well-known/assetlinks.json`.
5. Reinstala o APK. Pode demorar alguns minutos / exigir reabrir a app para o
   Android revalidar.

> Se mudaste o **Package ID** no PWABuilder, gera um novo download — o
> `assetlinks.json` desse download passa a refletir o ID novo. Usa **esse**.

## B. "O pacote entra em conflito com um pacote existente"

Acontece quando já existe instalada uma app com o **mesmo Package ID** mas
assinada com uma **chave diferente**. Opções:

- **Reutilizar a chave:** no PWABuilder, em *Android → All settings → Signing
  key*, escolhe **"Use mine"** e carrega o `signing.keystore` do download
  original (guarda sempre este ficheiro!). Assim atualiza por cima.
- **Mudar o Package ID:** em *All settings → Package ID*, usa um ID novo
  (ex.: `io.github.f100pilot.bttspro`). Instala como app nova, sem conflito.
  ⚠️ Ao mudar o ID, o `assetlinks.json` da secção A tem de ser o do **novo**
  download (com o novo ID), senão a barra de endereço volta a aparecer.

Regras do Package ID: só minúsculas, números e pontos; cada secção começa por
letra; sem hífens nem espaços.

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

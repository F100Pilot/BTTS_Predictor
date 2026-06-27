/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.11.1';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'O aviso de "dados insuficientes" passa a mostrar quantos jogos de histórico a fonte devolveu para cada equipa (ex.: "Casa 1 jogo · Fora 0 jogos"), para perceberes logo a causa.',
  'Dica: seleções (Mundial/Euro) têm pouco histórico nas APIs → desliga "Só grandes competições" e testa um jogo de uma liga de clubes, ou usa a API-Football (histórico mais completo).',
  'Fontes de dados simplificadas: apenas Football-Data.org e API-Football (mais os dados de demonstração).',
];

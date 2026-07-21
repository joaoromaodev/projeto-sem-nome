/* O boneco: cinco camadas empilhadas, cada uma com sua cor.
 *
 * Ordem de empilhamento (de baixo pra cima):
 *
 *   1. pele      cabeça, braços e mãos
 *   2. pernas    calça ou saia
 *   3. sapatos
 *   4. torso     camisa — vem DEPOIS dos braços de propósito: assim o
 *                comprimento da manga é decisão da camisa, e manga curta,
 *                longa e regata saem sem precisar de arte de braço nova
 *   5. cabelo
 *
 * Movimento: pulo com sombra, não ciclo de caminhada. Num sprite pequeno o
 * movimento vertical lê melhor que troca de perna, e um ciclo de 4 quadros
 * por camada seriam 20 sprites em vez de 5.
 */

import { camada, LARG, ALT, ALT_CANVAS, MARGEM_TOPO } from "./sprites.js";

export { LARG, ALT, ALT_CANVAS, MARGEM_TOPO };

/* Ordem importa: é a ordem de desenho. */
export const CAMADAS = ["pele", "pernas", "sapatos", "torso", "cabelo"];

/* Quais camadas têm variantes de peça. A pele é a base, não tem escolha. */
export const COM_PECA = ["pernas", "sapatos", "torso", "cabelo"];

export const SUGESTOES = {
  pele:    ["#ffdbac", "#f0c8a0", "#d9a066", "#a9714b", "#8d5524", "#5c3317"],
  cabelo:  ["#1a1220", "#3d1f2e", "#7a1030", "#c81e5a", "#ff2e88", "#d8d0e0",
            "#38e8e0", "#5b3a8c", "#c8a415", "#7a3b10"],
  torso:   ["#16121e", "#2a1f3d", "#7a1030", "#c81e5a", "#ff2e88", "#38e8e0",
            "#1f5f5a", "#4a2a6a", "#8c7a20", "#e8e2f0"],
  pernas:  ["#12101a", "#23203a", "#2e2438", "#3a2a20", "#1c3038", "#4a1c2c"],
  sapatos: ["#12101a", "#2a2a32", "#4a3020", "#7a1030", "#38e8e0", "#e8e2f0"],
};

const COR_RE = /^#[0-9a-f]{6}$/i;

/* Preenchido pelo servidor: quais peças existem de fato em static/sprites/.
   Assim acrescentar uma peça é só soltar o arquivo lá, sem mexer em código. */
let MANIFESTO = { pele: [""], pernas: [], sapatos: [], torso: [], cabelo: [] };

export function definirManifesto(m) {
  MANIFESTO = { ...MANIFESTO, ...m };
}

export function pecasDe(nomeCamada) {
  return MANIFESTO[nomeCamada] || [];
}

export function avatarPadrao() {
  const primeira = (c) => (MANIFESTO[c] && MANIFESTO[c][0]) || "";
  return {
    pele: "#ffdbac",
    pernas: primeira("pernas"),   pernas_cor: "#23203a",
    sapatos: primeira("sapatos"), sapatos_cor: "#12101a",
    torso: primeira("torso"),     torso_cor: "#7a1030",
    cabelo: primeira("cabelo"),   cabelo_cor: "#1a1220",
  };
}

export function avatarAleatorio() {
  const p = (a) => a[Math.floor(Math.random() * a.length)];
  const peca = (c) => {
    const lista = MANIFESTO[c] || [];
    return lista.length ? p(lista) : "";
  };
  return {
    pele: p(SUGESTOES.pele),
    pernas: peca("pernas"),   pernas_cor: p(SUGESTOES.pernas),
    sapatos: peca("sapatos"), sapatos_cor: p(SUGESTOES.sapatos),
    torso: peca("torso"),     torso_cor: p(SUGESTOES.torso),
    cabelo: peca("cabelo"),   cabelo_cor: p(SUGESTOES.cabelo),
  };
}

/** Conserta o que vier torto em vez de quebrar a tela de todo mundo. */
export function normalizar(a) {
  const d = avatarPadrao();
  a = a || {};

  const cor = (v, padrao) => (COR_RE.test(v || "") ? String(v).toLowerCase() : padrao);
  const peca = (v, nomeCamada, padrao) => {
    const lista = MANIFESTO[nomeCamada] || [];
    return lista.includes(v) ? v : padrao;
  };

  return {
    pele: cor(a.pele, d.pele),
    pernas: peca(a.pernas, "pernas", d.pernas),
    pernas_cor: cor(a.pernas_cor, d.pernas_cor),
    sapatos: peca(a.sapatos, "sapatos", d.sapatos),
    sapatos_cor: cor(a.sapatos_cor, d.sapatos_cor),
    torso: peca(a.torso, "torso", d.torso),
    torso_cor: cor(a.torso_cor, d.torso_cor),
    cabelo: peca(a.cabelo, "cabelo", d.cabelo),
    cabelo_cor: cor(a.cabelo_cor, d.cabelo_cor),
  };
}

function arquivoDe(nomeCamada, av) {
  if (nomeCamada === "pele") return "pele.png";
  const peca = av[nomeCamada];
  return peca ? `${nomeCamada}-${peca}.png` : null;
}

function corDe(nomeCamada, av) {
  return nomeCamada === "pele" ? av.pele : av[`${nomeCamada}_cor`];
}

/**
 * Desenha o boneco.
 *
 * @param esc      escala inteira (2 = cada pixel do sprite vira 2x2 na tela)
 * @param andando  aplica o pulo
 * @param virado   espelha na horizontal
 * @param sombra   desenha a sombra do chão (encolhe no pulo)
 */
export function desenhar(ctx, avatar, opts = {}) {
  const { esc = 2, andando = false, virado = false, sombra = true } = opts;
  const av = normalizar(avatar);

  const L = LARG * esc;
  const A = ALT_CANVAS * esc;
  ctx.clearRect(0, 0, L, A);
  ctx.imageSmoothingEnabled = false;

  const salto = andando ? -2 * esc : 0;

  // A sombra fica no chão e encolhe quando o boneco sobe. É ela que faz o
  // pulo parecer intenção, e não falha de desenho.
  if (sombra) {
    const raio = (andando ? 7 : 9.5) * esc;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.34)";
    ctx.beginPath();
    ctx.ellipse(L / 2, A - 1.2 * esc, raio, 2.2 * esc, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  if (virado) { ctx.translate(L, 0); ctx.scale(-1, 1); }

  // Quem desenha uma vez só precisa saber se ficou faltando camada, senão
  // marca como pronto e o boneco fica incompleto pra sempre.
  let completo = true;

  for (const nome of CAMADAS) {
    const arquivo = arquivoDe(nome, av);
    if (!arquivo) continue;
    const cv = camada(arquivo, corDe(nome, av));
    if (!cv) { completo = false; continue; }   // ainda carregando
    ctx.drawImage(cv, 0, MARGEM_TOPO * esc + salto, L, ALT * esc);
  }

  ctx.restore();
  return completo;
}

/** Canvas já dimensionado e desenhado. */
export function canvasAvatar(avatar, esc = 2) {
  const cv = document.createElement("canvas");
  cv.width = LARG * esc;
  cv.height = ALT_CANVAS * esc;
  cv.style.imageRendering = "pixelated";
  desenhar(cv.getContext("2d"), avatar, { esc });
  return cv;
}

/* Personagem "base" novo: sprite pronto de 8 direções (não é paper-doll).
 *
 * Parado usa as 8 rotações estáticas (chars/<base>/<dir>.png). Andando usa o
 * ciclo de caminhada (chars/<base>/walk/<dir>/<i>.png), 9 quadros. Só as 5
 * direções do lado oeste foram geradas — leste, nordeste e sudeste saem
 * espelhando o oeste na horizontal.
 *
 * O sprite vem num canvas quadrado grande (masc 92, fem 88) com folga em
 * volta. Aqui a gente recorta a "janela" onde o boneco realmente está e
 * desenha no mesmo retângulo do avatar antigo (LARG × ALT_CANVAS), pra ele
 * conviver na mesma escala sem mexer no resto da sala.
 */

import { LARG, ALT, ALT_CANVAS, MARGEM_TOPO } from "./sprites.js";

export const NQUADROS = 9;

// janela de recorte [sx, sy, sw, sh] no sprite de origem: onde o corpo está.
const BASES = {
  masc: { win: [30, 20, 32, 52] },
  fem:  { win: [28, 19, 32, 50] },   // caminhada ainda não gerada
};

// direções cujo sprite sai espelhando o lado oeste
const ESPELHO = {
  "east": "west",
  "north-east": "north-west",
  "south-east": "south-west",
};

const TODAS = ["south", "south-east", "east", "north-east",
               "north", "north-west", "west", "south-west"];
const WALK = ["north", "north-west", "west", "south-west", "south"];

export function ehBase(base) {
  return !!BASES[base];
}

/* -------------------------------------------------- carga das imagens */

const promessa = new Map();   // url -> Promise<img|null>
const pronta = new Map();     // url -> img (só o que já carregou)

function carregar(url) {
  if (!promessa.has(url)) {
    promessa.set(url, new Promise((ok) => {
      const img = new Image();
      img.onload = () => { pronta.set(url, img); ok(img); };
      img.onerror = () => ok(null);   // sprite faltando não derruba a sala
      img.src = url;
    }));
  }
  return promessa.get(url);
}

/** Carrega tudo de uma base antes de a sala aparecer. */
export function preaquecerChar(base) {
  if (!BASES[base]) return Promise.resolve();
  const urls = [];
  for (const d of TODAS) urls.push(`/sprites/chars/${base}/${d}.png`);
  for (const d of WALK)
    for (let i = 0; i < NQUADROS; i++)
      urls.push(`/sprites/chars/${base}/walk/${d}/${i}.png`);
  return Promise.all(urls.map(carregar));
}

/* Resolve qual arquivo desenhar e se precisa espelhar. */
function fonte(base, dir, andando, frame) {
  let d = dir || "south";
  let espelha = false;
  if (andando && ESPELHO[d]) { d = ESPELHO[d]; espelha = true; }
  if (!andando) {
    // parado: as 8 rotações existem de verdade, sem espelho
    return { url: `/sprites/chars/${base}/${d}.png`, espelha: false };
  }
  const i = ((frame % NQUADROS) + NQUADROS) % NQUADROS;
  return { url: `/sprites/chars/${base}/walk/${d}/${i}.png`, espelha };
}

/**
 * Desenha o personagem base. Mesma assinatura de saída do avatar antigo:
 * devolve `false` se a imagem ainda não carregou (pra tentar no próximo quadro).
 *
 * @param dir      direção de 8 ("south", "north-east", ...)
 * @param andando  usa o ciclo de caminhada em vez da pose parada
 * @param frame    índice do quadro de caminhada
 */
export function desenharChar(ctx, base, opts = {}) {
  const cfg = BASES[base];
  if (!cfg) return true;
  const { esc = 2, dir = "south", andando = false, frame = 0, sombra = true } = opts;

  const L = LARG * esc;
  const A = ALT_CANVAS * esc;
  ctx.clearRect(0, 0, L, A);
  ctx.imageSmoothingEnabled = false;

  // sombra no chão (igual ao avatar antigo, pra assentar o boneco)
  if (sombra) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.34)";
    ctx.beginPath();
    ctx.ellipse(L / 2, A - 1.2 * esc, 8 * esc, 2.2 * esc, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const { url, espelha } = fonte(base, dir, andando, frame);
  const img = pronta.get(url);
  if (!img) { carregar(url); return false; }

  const [sx, sy, sw, sh] = cfg.win;
  ctx.save();
  if (espelha) { ctx.translate(L, 0); ctx.scale(-1, 1); }
  // recorta a janela do corpo e joga no retângulo todo (pés na base)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, L, A);
  ctx.restore();
  return true;
}

/** Direção de 8 a partir do movimento (dx pra direita, dy pra cima). */
export function direcaoDe(dx, dy) {
  const e = 1e-3;
  const ns = dy > e ? "north" : dy < -e ? "south" : "";
  const ew = dx > e ? "east" : dx < -e ? "west" : "";
  return [ns, ew].filter(Boolean).join("-");
}

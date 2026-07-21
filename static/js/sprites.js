/* Carrega, recolore e guarda em cache as camadas do boneco.
 *
 * A recoloração preserva a CLARIDADE de cada pixel e troca só o matiz. É
 * isso que faz a mesma arte servir pra qualquer cor: o sombreado que o
 * artista desenhou sobrevive à troca.
 *
 * Pixel muito escuro fica como está — senão o contorno preto viraria uma
 * versão escura da cor escolhida e o boneco perderia a definição.
 */

export const LARG = 32;
export const ALT = 48;

/* Folga no topo do canvas: o boneco sobe quando anda, e sem ela a cabeça
   seria desenhada fora e sumiria. */
export const MARGEM_TOPO = 3;
export const ALT_CANVAS = ALT + MARGEM_TOPO;

const LIMIAR_CONTORNO = 0.16;   // abaixo disso o pixel não é recolorido

const cacheImg = new Map();     // url -> Promise<HTMLImageElement|null>
const imgPronta = new Map();    // url -> HTMLImageElement (só o que já carregou)
const cachePintado = new Map(); // "arquivo|cor" -> HTMLCanvasElement

/* ------------------------------------------------------------- cor */

function hexParaRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbParaHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslParaRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const f = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < .5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(f(p, q, h + 1 / 3) * 255),
    Math.round(f(p, q, h) * 255),
    Math.round(f(p, q, h - 1 / 3) * 255),
  ];
}

/* ------------------------------------------------------------- imagens */

function carregar(url) {
  if (!cacheImg.has(url)) {
    cacheImg.set(url, new Promise((ok) => {
      const img = new Image();
      img.onload = () => { imgPronta.set(url, img); ok(img); };
      // Peça faltando não pode derrubar a sala inteira: devolve nulo e o
      // boneco só fica sem aquela camada.
      img.onerror = () => ok(null);
      img.src = url;
    }));
  }
  return cacheImg.get(url);
}

/** Recolore uma camada e devolve um canvas pronto. Resultado fica em cache
 *  porque isso é caro (percorre 1.536 pixels) e repetiria a cada quadro. */
function pintar(img, cor) {
  const cv = document.createElement("canvas");
  cv.width = LARG;
  cv.height = ALT;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  if (!cor) return cv;

  const [hAlvo, sAlvo] = rgbParaHsl(...hexParaRgb(cor));
  const dados = ctx.getImageData(0, 0, LARG, ALT);
  const d = dados.data;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const [, , l] = rgbParaHsl(d[i], d[i + 1], d[i + 2]);
    if (l < LIMIAR_CONTORNO) continue;   // contorno fica preto
    const [r, g, b] = hslParaRgb(hAlvo, sAlvo, l);
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }

  ctx.putImageData(dados, 0, 0);
  return cv;
}

/** Camada pronta pra desenhar. Devolve null enquanto a imagem carrega.
 *
 *  Se a imagem já está carregada, pinta AGORA em vez de agendar. Sem isso,
 *  a primeira chamada devolvia null mesmo com tudo pré-aquecido, e quem
 *  desenha uma vez só (a sala marca a pessoa como limpa) ficava com o
 *  boneco invisível pra sempre.
 */
export function camada(arquivo, cor) {
  const chave = `${arquivo}|${cor || ""}`;
  const pronto = cachePintado.get(chave);
  if (pronto) return pronto;

  const url = `/sprites/${arquivo}`;
  const img = imgPronta.get(url);
  if (img) {
    const cv = pintar(img, cor);
    cachePintado.set(chave, cv);
    return cv;
  }

  // ainda não carregou: agenda e devolve null neste quadro
  carregar(url).then((carregada) => {
    if (carregada) cachePintado.set(chave, pintar(carregada, cor));
  });
  return null;
}

/** Deixa tudo carregado antes de a sala aparecer, pra ninguém ver o boneco
 *  se montando peça por peça. */
export async function preaquecer(manifesto) {
  const arquivos = [];
  for (const [camadaNome, pecas] of Object.entries(manifesto)) {
    for (const peca of pecas) {
      arquivos.push(peca ? `${camadaNome}-${peca}.png` : `${camadaNome}.png`);
    }
  }
  await Promise.all(arquivos.map((a) => carregar(`/sprites/${a}`)));
}

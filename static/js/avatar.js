/* Bonequinho pixelado, desenhado por código.
 *
 * Dois modos:
 *
 *   pecas   — boneco padrão. Você escolhe o cabelo e as cores (livres).
 *   desenho — você desenhou o seu. `arte` são 112 dígitos hex, cada um
 *             apontando pra `paleta`; '0' é transparente.
 *
 * O sprite é 8x14. Pequeno de propósito: nesse tamanho uma sala cheia
 * continua legível, e desenhar o seu não vira trabalho de meio dia.
 */

export const LARG = 8;
export const ALT = 14;
export const PALETA_MAX = 15;

/* Uma linha de folga no topo do canvas.
 *
 * Quando o boneco anda ele sobe 1 pixel. Sem essa folga, a linha 0 — que é
 * justamente o topo da cabeça — era desenhada fora do canvas e sumia. */
export const MARGEM_TOPO = 1;
export const ALT_CANVAS = ALT + MARGEM_TOPO;

const OUT = "#2b1a12";
const EYE = "#ffffff";

/* K=contorno S=pele W=olho B=camisa P=parte de baixo .=vazio */

const CABECA = [
  "..KKKK..",
  ".KSSSSK.",
  "KSSSSSSK",
  "KSSSSSSK",
  "KSWSSWSK",
  "KSSSSSSK",
  ".KSSSSK.",
];

/* Silhueta do tronco (linhas 7 a 10) */
const TORSOS = [
  [".KBBBBK.", "KBBBBBBK", "SBBBBBBS", "KBBBBBBK"],   // médio
  [".KBBBBK.", ".KBBBBK.", "SKBBBBKS", ".KBBBBK."],   // esguio
  ["KKBBBBKK", "KBBBBBBK", "SBBBBBBS", "KBBBBBBK"],   // largo
];

/* Parte de baixo (linhas 11 a 13), parada e no passo */
const BAIXOS = [
  { // calça
    parado: [".KPPPPK.", ".KPP.PPK", ".KK..KK."],
    passo:  [".KPPPPK.", ".KPPPPK.", "KK....KK"],
  },
  { // saia
    parado: [".KPPPPK.", "KPPPPPPK", ".KS..SK."],
    passo:  [".KPPPPK.", "KPPPPPPK", "KS....SK"],
  },
  { // vestido — a saia segue a cor da camisa
    parado: [".KBBBBK.", "KBBBBBBK", ".KS..SK."],
    passo:  [".KBBBBK.", "KBBBBBBK", "KS....SK"],
  },
];

export const CORPO_NOMES = ["médio", "esguio", "largo"];
export const BAIXO_NOMES = ["calça", "saia", "vestido"];

const CABELOS = [
  ["..HHHH..", ".HHHHHH.", ".H....H."],                            // curto
  ["..HHHH..", ".HHHHHH.", "HHH..HHH", "HH....HH", "H......H", "H......H"], // comprido
  ["...HH...", "..HHHH..", "..H..H.."],                            // moicano
  ["..HHHH..", ".HHHHHH.", ".HHHHHH.", ".H....H."],                // franjão
  ["...HH...", "..HHHH..", ".HHHHHH.", ".H....H."],                // coque
  ["..KKKK..", ".K....K."],                                        // careca
];

export const CABELO_NOMES =
  ["curto", "comprido", "moicano", "franjão", "coque", "careca"];

/* Cores de atalho — clicar é mais rápido que abrir o seletor.
   Não são mais limite nenhum: qualquer cor vale. */
export const SUGESTOES = {
  skin:   ["#ffdbac", "#f0c8a0", "#d9a066", "#a9714b", "#8d5524", "#5c3317"],
  hair_c: ["#2b1a12", "#5a3a1a", "#7a3b10", "#c8a415", "#e8d8a0", "#a01818",
           "#3a3a8c", "#158a5a", "#8c2f8c", "#dddddd"],
  shirt:  ["#c02020", "#2050c0", "#20a050", "#d0a000", "#802090", "#e07020",
           "#20a0a0", "#303030", "#f0f0f0", "#c85090"],
  pants:  ["#303860", "#4a4a4a", "#6b4a2a", "#204020", "#701820", "#1a1a1a"],
};

const COR_RE = /^#[0-9a-f]{6}$/i;
const cor = (v, padrao) => (COR_RE.test(v || "") ? String(v).toLowerCase() : padrao);

export function avatarPadrao() {
  return {
    modo: "pecas", hair: 0, corpo: 0, baixo: 0,
    skin: "#ffdbac", hair_c: "#2b1a12", shirt: "#c02020", pants: "#303860",
    arte: null, paleta: null,
  };
}

export function avatarAleatorio() {
  const p = (a) => a[Math.floor(Math.random() * a.length)];
  const n = (max) => Math.floor(Math.random() * max);
  return {
    modo: "pecas",
    hair: n(CABELOS.length),
    corpo: n(TORSOS.length),
    baixo: n(BAIXOS.length),
    skin: p(SUGESTOES.skin),
    hair_c: p(SUGESTOES.hair_c),
    shirt: p(SUGESTOES.shirt),
    pants: p(SUGESTOES.pants),
    arte: null, paleta: null,
  };
}

/* Combinações prontas. Não travam nada: são só um ponto de partida, e
 * qualquer peça continua livre pra trocar depois. */
export const PRESETS = {
  masculino: { corpo: 2, baixo: 0, hair: 0 },
  feminino:  { corpo: 1, baixo: 1, hair: 1 },
};

/** Conserta o que vier torto em vez de quebrar a tela de todo mundo. */
export function normalizar(a) {
  const d = avatarPadrao();
  a = a || {};

  const idx = (v, max) =>
    Number.isFinite(+v) ? ((Math.floor(+v) % max) + max) % max : 0;

  const av = {
    modo: a.modo === "desenho" ? "desenho" : "pecas",
    hair: idx(a.hair, CABELOS.length),
    corpo: idx(a.corpo, TORSOS.length),
    baixo: idx(a.baixo, BAIXOS.length),
    skin: cor(a.skin, d.skin),
    hair_c: cor(a.hair_c, d.hair_c),
    shirt: cor(a.shirt, d.shirt),
    pants: cor(a.pants, d.pants),
    arte: null,
    paleta: null,
  };

  const arteOk = typeof a.arte === "string"
    && a.arte.length === LARG * ALT
    && /^[0-9a-f]+$/i.test(a.arte);
  const paletaOk = Array.isArray(a.paleta)
    && a.paleta.length <= PALETA_MAX
    && a.paleta.every((c) => COR_RE.test(c));

  if (arteOk && paletaOk) {
    av.arte = a.arte.toLowerCase();
    av.paleta = a.paleta.map((c) => c.toLowerCase());
  } else {
    // arte quebrada: cai no boneco padrão em vez de sumir com a pessoa
    av.modo = "pecas";
  }

  return av;
}

/* ------------------------------------------------------------- grade */

/** Devolve LARG*ALT cores (ou null = transparente). */
export function grade(av, andando = false) {
  av = normalizar(av);

  if (av.modo === "desenho") {
    const g = [];
    for (let y = 0; y < ALT; y++) {
      const linha = [];
      for (let x = 0; x < LARG; x++) {
        const i = parseInt(av.arte[y * LARG + x], 16);
        linha.push(i === 0 ? null : (av.paleta[i - 1] || null));
      }
      g.push(linha);
    }
    return g;
  }

  const mapa = {
    K: OUT, W: EYE,
    S: av.skin, B: av.shirt, P: av.pants, H: av.hair_c,
  };

  const baixo = BAIXOS[av.baixo];
  const linhas = [
    ...CABECA,
    ...TORSOS[av.corpo],
    ...(andando ? baixo.passo : baixo.parado),
  ];

  const g = linhas.map((l) => l.split("").map((c) => (c === "." ? null : mapa[c])));

  CABELOS[av.hair].forEach((linha, y) => {
    if (y >= ALT) return;
    linha.split("").forEach((c, x) => {
      if (c === ".") return;
      g[y][x] = c === "K" ? OUT : mapa.H;
    });
  });

  return g;
}

/** Pega o boneco atual e devolve {arte, paleta} — o ponto de partida do
 *  editor pixel a pixel. É o "template padrão" pra começar a desenhar. */
export function paraArte(av) {
  const g = grade(av, false);
  const paleta = [];
  const idx = new Map();
  let arte = "";

  for (let y = 0; y < ALT; y++) {
    for (let x = 0; x < LARG; x++) {
      const c = g[y][x];
      if (!c) { arte += "0"; continue; }
      if (!idx.has(c)) {
        if (paleta.length >= PALETA_MAX) { arte += "0"; continue; }
        paleta.push(c);
        idx.set(c, paleta.length);
      }
      arte += idx.get(c).toString(16);
    }
  }
  return { arte, paleta };
}

/** Caminho inverso: grade de cores -> {arte, paleta} compactos. */
export function daGrade(g) {
  const paleta = [];
  const idx = new Map();
  let arte = "";

  for (let y = 0; y < ALT; y++) {
    for (let x = 0; x < LARG; x++) {
      const c = g[y] && g[y][x];
      if (!c) { arte += "0"; continue; }
      if (!idx.has(c)) {
        if (paleta.length >= PALETA_MAX) { arte += "0"; continue; }
        paleta.push(c);
        idx.set(c, paleta.length);
      }
      arte += idx.get(c).toString(16);
    }
  }
  return { arte, paleta };
}

/* ------------------------------------------------------------- desenho */

export function desenhar(ctx, av, { px = 4, andando = false, virado = false } = {}) {
  const a = normalizar(av);
  const g = grade(a, andando);

  ctx.clearRect(0, 0, LARG * px, ALT_CANVAS * px);
  ctx.save();
  if (virado) { ctx.translate(LARG * px, 0); ctx.scale(-1, 1); }

  // No modo desenho não dá pra mexer as pernas (não sei onde elas estão,
  // ou se existem). Um pulinho de 1 pixel lê como andar do mesmo jeito.
  const salto = (a.modo === "desenho" && andando) ? -px : 0;

  // O sprite começa MARGEM_TOPO abaixo do topo do canvas, e é essa folga
  // que o salto ocupa. Sem ela, a cabeça era cortada ao andar.
  const base = MARGEM_TOPO * px;

  for (let y = 0; y < ALT; y++) {
    for (let x = 0; x < LARG; x++) {
      const c = g[y][x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * px, base + y * px + salto, px, px);
    }
  }
  ctx.restore();
}

/** Canvas já no tamanho certo (com a folga do topo) e desenhado. */
export function canvasAvatar(av, px = 4) {
  const cv = document.createElement("canvas");
  cv.width = LARG * px;
  cv.height = ALT_CANVAS * px;
  cv.style.imageRendering = "pixelated";
  desenhar(cv.getContext("2d"), av, { px });
  return cv;
}

/* Cenário fixo das salas temáticas.
 *
 * Móvel é decoração: um <img> posto no #chao em coordenadas de % (as mesmas
 * do boneco e do controle remoto), com profundidade pelo zIndex derivado do
 * y — assim quem está na frente (y menor) cobre o que está atrás, e o boneco
 * se intercala com os móveis pela mesma regra.
 *
 * Nada disso passa pelo servidor: o cenário é igual pra todo mundo e não muda,
 * então é só desenhar no cliente quando a sala for a certa.
 */

const OBJ = "/sprites/objetos/";

// nomes curtos -> arquivo em static/sprites/objetos/
const S = {
  desk:      "long-office-desk-front-view-horizontal",
  monSul:    "monitor/south",     // telas viradas pra quem olha (estação sul)
  monNorte:  "monitor/north",     // de costas (estação norte, pessoa olha pro sul)
  pc:        "small-black-mini-office-pc-computer-box",
  kbd:       "keyboard-mouse-black",                        // mouse preto (padrão)
  kbdRosa:   "black-computer-keyboard-with-a-pink-mous",    // mouse rosa (só mesa 2)
  pad:       "large-pink-rectangular-mousepad",
  cubo:      "colorful-rubik-s-cube",
  canet:     "black-pen-holder-cup-full-of-pens",
  note:      "blue-and-purple-laptop-notebook-open",
  garrafa:   "small-plastic-water-bottle",
  uno:       "small-pile-of-colorful-uno-playing-cards",
  bebedouro: "blue-water-cooler-dispenser-back-view-wi",
  gav:       "mobile-pedestal-drawer-unit-front-view",
  cadBack:   "office-chair-back-view-seen-from-behind",
  cadFront:  "office-chair-front-view-dark-blue-seat",
  janete:    "cadeira-janete",
  edilse:    "cadeira-edilse",
};

/* Monta a lista de móveis do escritório.
 *
 * A ilha é horizontal e de mão dupla (a divisória já vem desenhada no
 * segmento de mesa). No lado SUL sentam 5 pessoas, todas com estação de
 * trabalho (monitores + mini PC); a 3ª é a janete (casaquinho vermelho) e a
 * 4ª a edilse (blazer preto). No lado NORTE só há 2 estações de trabalho (as
 * da direita) — o resto são cadeiras vazias, sem PC nem monitor.
 *
 * Colunas x compartilhadas pelos dois lados; a mesa é desenhada uma vez por
 * coluna (a metade norte e a sul dividem o mesmo tampo).
 */
/* Camadas de profundidade (zIndex). O y sozinho não sabe distinguir "em
 * cima da mesa" de "atrás da mesa", então cada tipo de móvel entra numa
 * faixa fixa. Dentro de "sobre a mesa", o y ainda desempata (o que está
 * mais atrás fica atrás). */
const Z = {
  cadeiraNorte: 300,   // atrás de tudo
  equipNorte:   340,   // sobre a metade norte, atrás do tampo
  gaveteiro:    390,   // enfiada embaixo da mesa (o tampo cobre o topo)
  mesa:         400,
  sobreMesa:    500,   // monitores/teclado/miudezas do sul, sobre o tampo
  frente:       700,   // cadeiras do sul e objetos soltos, na frente
};

function escritorio() {
  const m = [];
  const add = (s, x, y, w, z) => m.push({ s, x, y, w, z });
  // sobre a mesa: y desempata dentro da faixa (mais ao norte = mais atrás)
  const zTopo = (y) => Z.sobreMesa + (60 - y);

  const cols = [24, 36, 48, 60, 72];       // 5 colunas da ilha

  // bebedouro no canto inferior esquerdo
  add(S.bebedouro, 9, 15, 9, Z.frente);

  // tampo da ilha (segmentos se sobrepõem de leve pra virar uma bancada só)
  cols.forEach((x) => add(S.desk, x, 50, 13, Z.mesa));

  // ---- lado SUL: 5 estações (pessoa de costas pra nós, olhando a mesa) ----
  const cadeiraSul = { 2: S.janete, 3: S.edilse };  // 3ª e 4ª
  cols.forEach((x, i) => {
    add(S.monSul, x, 54, 11, zTopo(54));                   // monitores (telas pra nós)
    add(S.pc, i === 3 ? x + 5 : x - 4, 56, 5, zTopo(56));  // mini PC (edilse: à direita)
    add(i === 1 ? S.kbdRosa : S.kbd, x, 49, 7, zTopo(49)); // mesa 2 = rosa; resto preto
    add(S.gav, x - 7, 45, 6, Z.gaveteiro);                 // gaveteiro enfiado sob a mesa
    add(cadeiraSul[i] || S.cadBack, x, 37, 9, Z.frente);   // cadeira (janete/edilse próprias)
  });

  // ---- lado NORTE: 2 estações (direita) + cadeiras vazias no resto ----
  const equipadasNorte = [3, 4];               // só as 2 colunas da direita
  cols.forEach((x, i) => {
    add(S.cadFront, x, 64, 9, Z.cadeiraNorte);  // cadeira (de frente pra nós)
    if (equipadasNorte.includes(i)) {
      add(S.monNorte, x, 58, 11, Z.equipNorte); // monitores da metade norte (de costas)
      add(S.pc, x - 4, 61, 5, Z.equipNorte);
      add(S.kbd, x, 56, 7, Z.equipNorte);       // mouse preto
    }
  });

  // ---- miudezas sobre as mesas do sul (todas na faixa "sobre a mesa") ----
  add(S.cubo, cols[0] + 4, 52, 4, zTopo(52));   // mesa 1
  add(S.canet, cols[1] - 5, 52, 3.5, zTopo(52));// mesa 2: porta-canetas
  add(S.pad, cols[1], 50, 7, zTopo(51));        // mesa 2: mousepad rosa (sob o teclado)
  add(S.cubo, cols[1] + 4, 52, 4, zTopo(52));   // mesa 2
  add(S.cubo, cols[2] - 4, 52, 4, zTopo(52));   // mesa 3
  add(S.note, cols[2] + 4, 51, 6, zTopo(51));   // mesa 3: notebook azul/roxo
  add(S.uno, 54, 52, 4, zTopo(52));             // UNO entre a 3ª e a 4ª mesa
  add(S.garrafa, cols[3] + 4, 52, 3, zTopo(52));// mesa 4: garrafinha

  return m;
}

/* Sala cinema: fileiras de sofás voltadas pro telão.
 *
 * O telão não é desenhado aqui — ele é o próprio player de vídeo (o mesmo
 * "jukebox" das outras salas), que o CSS da classe `.cinema` reveste de
 * moldura e faz aparecer grande na parede em vez de ficar escondido. Aqui
 * só entram os sofás, que dão à sala a cara de sala de cinema.
 *
 * As fileiras vão da mais funda (perto do telão, y maior, sofás menores e
 * mais juntos) à da frente (y menor, maiores e mais espalhados) — a
 * perspectiva de um auditório num chão plano. Sem zIndex explícito de
 * propósito: caindo na regra dos bonecos (quem está mais à frente cobre),
 * uma pessoa se intercala com os sofás como se sentasse entre eles.
 */
function cinema() {
  const m = [];
  const sofa = (x, y, w) => m.push({ s: "/moveis/sofa", x, y, w });

  // fundo -> frente. Cada fileira mais baixa é um pouco maior e mais aberta.
  [34, 50, 66].forEach((x) => sofa(x, 40, 12));      // fileira do fundo
  [28, 50, 72].forEach((x) => sofa(x, 27, 14));      // fileira do meio
  [22, 50, 78].forEach((x) => sofa(x, 12, 16));      // fileira da frente

  return m;
}

const SALAS = { escritorio, cinema };

/** Desenha o cenário da sala no #chao, se houver um pra ela. Idempotente:
 *  limpa o que já tinha antes de redesenhar. */
export function montarCenario(chao, codigo) {
  // tira cenário anterior e marca a sala (o CSS troca o piso pela classe)
  chao.querySelectorAll(".movel").forEach((e) => e.remove());
  chao.classList.remove("escritorio");

  const fn = SALAS[codigo];
  if (!fn) return;

  chao.classList.add(codigo);
  for (const it of fn()) {
    const img = document.createElement("img");
    img.className = "movel";
    // `s` que começa com "/" é caminho a partir de /static (ex.: o sofá vive
    // em /moveis, não em /sprites/objetos como o resto).
    img.src = (it.s[0] === "/" ? it.s : OBJ + it.s) + ".png";
    img.style.left = it.x + "%";
    img.style.bottom = it.y + "%";
    img.style.width = it.w + "%";
    if (it.flip) img.style.transform = "translateX(-50%) scaleX(-1)";
    // móvel usa a camada explícita; sem ela, cai na regra dos bonecos
    // (quem está na frente, y menor, cobre). Bonecos vivem perto de z~1000-y*10.
    img.style.zIndex = String(it.z != null ? it.z : Math.round(1000 - it.y * 10));
    chao.appendChild(img);
  }
}

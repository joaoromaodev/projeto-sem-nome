/* A sala: conexão, quem está dentro, o boneco andando e o chat.
 *
 * Regra que vale pra tudo aqui: o meu boneco anda na hora, sem esperar o
 * servidor. Mandar a posição e só desenhar quando ela voltasse deixaria o
 * movimento borrachudo em qualquer internet menos que ótima. O servidor
 * serve pra contar aos outros onde eu estou, não pra me dizer onde eu estou.
 */

import { desenhar, canvasAvatar, LARG, ALT_CANVAS, normalizar,
         definirManifesto } from "./avatar.js";
import { preaquecer } from "./sprites.js";
import { preaquecerChar, direcaoDe, NQUADROS } from "./personagem.js";
import { api } from "./api.js";
import { montarPainel } from "./editor.js";
import { montarCenario } from "./cenario.js";
import * as video from "./video.js";

const $ = (s) => document.querySelector(s);
const chao = $("#chao");

const PX = 2;                    // escala do sprite na sala (32x48 vira 64x96)
const VEL_X = 30;                // % da largura por segundo
const VEL_Y = 20;                // o chão é raso, então anda mais devagar em profundidade
const ENVIO_MS = 90;             // de quanto em quanto tempo aviso minha posição
const LIM = { x0: 3, x1: 97, y0: 4, y1: 92 };
const BALAO_MS = 5200;
// Quanto o balão de "digitando" sobrevive sem notícia nova. Tem que ser
// maior que o intervalo de reaviso de quem digita (DIGITANDO_REENVIO_MS),
// senão ele pisca entre um reaviso e o outro.
const DIGITANDO_SOME_MS = 5000;

const codigo = decodeURIComponent(location.pathname.replace("/sala/", ""));

// Quem você é vem da conta. Se a sessão caiu, o servidor devolve 401 e a
// gente manda pro login em vez de deixar a tela quebrada.
let conta;
try {
  conta = await api.eu();
} catch {
  location.href = "/entrar";
  throw new Error("sem sessão");
}

// O catálogo de peças vem do servidor (ele lê a pasta de sprites). Sem isso
// o normalizar() não sabe quais peças são válidas e zeraria todo mundo.
const manifesto = await api.pecas();
definirManifesto(manifesto);
// Carrega os sprites antes de a sala aparecer, senão dá pra ver o boneco
// se montando peça por peça.
await Promise.all([preaquecer(manifesto), preaquecerChar("masc")]);

const perfil = { nick: conta.nick, avatar: normalizar(conta.avatar) };

document.title = codigo + " — sala";
$("#titulo").textContent = "■ sala :: " + codigo;

/* ------------------------------------------------------------ estado */

const gente = new Map();   // uid -> pessoa
// O código de verdade é o slug que o servidor devolve no "bemvindo": digitar
// "Quinta à Noite" cai em "quinta-a-noite", e é esse que vale pra comparar.
let codigoReal = codigo;
let meuUid = null;
let ws = null;
let tentativas = 0;
let ultimoEnvio = 0;
let saindo = false;

const teclas = new Set();
let alvo = null;           // destino do clique, ou null

function novaPessoa(dados, souEu) {
  const el = document.createElement("div");
  el.className = "pessoa" + (souEu ? " eu" : "");

  const cv = document.createElement("canvas");
  cv.width = LARG * PX;
  cv.height = ALT_CANVAS * PX;

  const nome = document.createElement("div");
  nome.className = "nome";
  nome.textContent = dados.nick;

  el.append(cv, nome);
  chao.appendChild(el);

  const p = {
    uid: dados.uid,
    nick: dados.nick,
    avatar: normalizar(dados.avatar),
    pos: { ...dados.pos },
    destino: { ...dados.pos },   // pra onde está indo (remotos interpolam até aqui)
    el, cv, ctx: cv.getContext("2d"), nomeEl: nome,
    balao: null, balaoAte: 0,
    pensando: null, pensandoAte: 0,
    virado: false, andando: false, dir: "south", frame: 0, tQuadro: 0,
    sujo: true,
  };
  gente.set(p.uid, p);
  posicionar(p);
  return p;
}

function tirarPessoa(uid) {
  const p = gente.get(uid);
  if (!p) return;
  p.el.remove();
  gente.delete(uid);
  // quem saiu no meio de uma frase não pode continuar "digitando..."
  pintarQuemDigita();
}

function posicionar(p) {
  p.el.style.left = p.pos.x + "%";
  p.el.style.bottom = p.pos.y + "%";
  // quem está mais à frente (y menor) fica por cima
  p.el.style.zIndex = String(Math.round(1000 - p.pos.y * 10));
}

function falar(p, texto) {
  if (!p.balao) {
    p.balao = document.createElement("div");
    p.balao.className = "balao";
    p.el.appendChild(p.balao);
  }
  p.balao.textContent = texto;
  p.balao.style.display = "";
  p.balaoAte = performance.now() + BALAO_MS;
  // Falou: não está mais digitando. Os dois balões moram no mesmo lugar
  // sobre a cabeça, e deixar os pontinhos ali por baixo da fala seria dois
  // balões empilhados.
  mostrarDigitando(p, false);
}

/* A linha "fulano está digitando..." embaixo do chat.

   Sai do MESMO estado que controla os balões (`pensandoAte` de cada
   pessoa) em vez de ter contagem própria. Duas fontes de verdade pra
   mesma coisa acabam discordando — o balão sumindo e a linha ficando, ou
   o contrário. Aqui, se o balão apareceu, a linha aparece junto. */
function pintarQuemDigita() {
  const nomes = [...gente.values()]
    .filter((p) => p.pensandoAte && p.uid !== meuUid)
    .map((p) => p.nick);

  let txt = "";
  if (nomes.length === 1) txt = `${nomes[0]} está digitando...`;
  else if (nomes.length === 2) txt = `${nomes[0]} e ${nomes[1]} estão digitando...`;
  else if (nomes.length > 2) txt = `${nomes.length} pessoas estão digitando...`;

  $("#quemDigita").textContent = txt;
}

/** Os três pontinhos sobre a cabeça de quem está escrevendo. */
function mostrarDigitando(p, ligado) {
  if (!ligado) {
    if (p.pensando) p.pensando.style.display = "none";
    p.pensandoAte = 0;
    pintarQuemDigita();
    return;
  }
  if (!p.pensando) {
    p.pensando = document.createElement("div");
    p.pensando.className = "balao digitando";
    p.pensando.append(
      document.createElement("i"),
      document.createElement("i"),
      document.createElement("i"),
    );
    p.el.appendChild(p.pensando);
  }
  p.pensando.style.display = "";
  // Prazo de validade: se a pessoa fechar a aba no meio da frase, o aviso
  // de "parei" nunca chega e o balão ficaria pendurado pra sempre.
  p.pensandoAte = performance.now() + DIGITANDO_SOME_MS;
  pintarQuemDigita();
}

/* ------------------------------------------------------------ desenho */

function laco(agora) {
  const dt = Math.min((agora - (laco.t || agora)) / 1000, 0.1);
  laco.t = agora;

  const eu = gente.get(meuUid);
  if (eu) andarLocal(eu, dt);

  for (const p of gente.values()) {
    if (p !== eu) seguirDestino(p, dt);

    if (p.andando) {
      p.tQuadro += dt;
      if (p.tQuadro > 0.12) { p.tQuadro = 0; p.frame = (p.frame + 1) % NQUADROS; p.sujo = true; }
    } else if (p.frame !== 0) {
      p.frame = 0; p.sujo = true;
    }

    if (p.sujo) {
      // Só considera pronto se todas as camadas entraram. Se alguma ainda
      // estava carregando, tenta de novo no próximo quadro.
      const completo = desenhar(p.ctx, p.avatar, {
        esc: PX,
        passo: p.frame % 2 === 1,   // pulo do paper-doll clássico
        andando: p.andando,          // caminhada do personagem base
        dir: p.dir,
        frame: p.frame,
        virado: p.virado,
      });
      p.sujo = !completo;
    }

    if (p.balao && p.balaoAte && agora > p.balaoAte) {
      p.balao.style.display = "none";
      p.balaoAte = 0;
    }

    if (p.pensando && p.pensandoAte && agora > p.pensandoAte) {
      p.pensando.style.display = "none";
      p.pensandoAte = 0;
      pintarQuemDigita();
    }
  }

  if (eu) mandarPosicao(agora, eu);
  requestAnimationFrame(laco);
}

function andarLocal(eu, dt) {
  let dx = 0, dy = 0;

  if (teclas.has("esq")) dx -= 1;
  if (teclas.has("dir")) dx += 1;
  if (teclas.has("cima")) dy += 1;
  if (teclas.has("baixo")) dy -= 1;

  if (dx || dy) alvo = null;   // tecla cancela o clique

  if (alvo) {
    const ax = alvo.x - eu.pos.x, ay = alvo.y - eu.pos.y;
    if (Math.abs(ax) < 0.6 && Math.abs(ay) < 0.6) {
      alvo = null;
    } else {
      dx = Math.abs(ax) < 0.6 ? 0 : Math.sign(ax);
      dy = Math.abs(ay) < 0.6 ? 0 : Math.sign(ay);
    }
  }

  if (!dx && !dy) {
    if (eu.andando) { eu.andando = false; eu.sujo = true; mandarPosicao(0, eu, true); }
    return;
  }

  // diagonal não pode ser mais rápida que reto
  const norma = dx && dy ? Math.SQRT1_2 : 1;
  eu.pos.x = clamp(eu.pos.x + dx * VEL_X * dt * norma, LIM.x0, LIM.x1);
  eu.pos.y = clamp(eu.pos.y + dy * VEL_Y * dt * norma, LIM.y0, LIM.y1);

  if (dx) eu.virado = dx < 0;
  eu.dir = direcaoDe(dx, dy);
  eu.andando = true;
  eu.sujo = true;
  posicionar(eu);
}

function seguirDestino(p, dt) {
  const dx = p.destino.x - p.pos.x;
  const dy = p.destino.y - p.pos.y;
  const perto = Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3;

  if (perto) {
    if (p.andando) { p.andando = false; p.sujo = true; }
    return;
  }

  // Anda na mesma velocidade do dono. Se ficou muito pra trás (aba em
  // segundo plano, internet travou), teleporta em vez de arrastar.
  if (Math.hypot(dx, dy) > 30) {
    p.pos = { ...p.destino };
  } else {
    const px = Math.sign(dx) * Math.min(Math.abs(dx), VEL_X * dt);
    const py = Math.sign(dy) * Math.min(Math.abs(dy), VEL_Y * dt);
    p.pos.x += px;
    p.pos.y += py;
    if (Math.abs(dx) > 0.3) p.virado = dx < 0;
  }

  p.dir = direcaoDe(dx, dy);
  p.andando = true;
  p.sujo = true;
  posicionar(p);
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function mandarPosicao(agora, eu, forcar = false) {
  if (!conectado()) return;
  const t = forcar ? Infinity : agora;
  if (t - ultimoEnvio < ENVIO_MS) return;
  ultimoEnvio = performance.now();
  enviar({ type: "move", pos: { x: +eu.pos.x.toFixed(2), y: +eu.pos.y.toFixed(2) } });
}

/* ------------------------------------------------------------ entrada */

const MAPA = {
  ArrowLeft: "esq", ArrowRight: "dir", ArrowUp: "cima", ArrowDown: "baixo",
  a: "esq", d: "dir", w: "cima", s: "baixo",
  A: "esq", D: "dir", W: "cima", S: "baixo",
};

addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  const k = MAPA[e.key];
  if (!k) return;
  teclas.add(k);
  e.preventDefault();
});

addEventListener("keyup", (e) => {
  const k = MAPA[e.key];
  if (k) teclas.delete(k);
});

// perdeu o foco da janela: solta tudo, senão o boneco sai andando sozinho
addEventListener("blur", () => teclas.clear());

chao.addEventListener("click", (e) => {
  // Clicar na jukebox é mexer no som (ou liberar o áudio), não mandar o
  // boneco atravessar a sala até ela.
  if (e.target.closest("#jukebox")) return;

  const r = chao.getBoundingClientRect();
  alvo = {
    x: clamp(((e.clientX - r.left) / r.width) * 100, LIM.x0, LIM.x1),
    y: clamp(((r.bottom - e.clientY) / r.height) * 100, LIM.y0, LIM.y1),
  };
});

/* ------------------------------------------------------- decoração
 *
 * O móvel tinha posição fixa no CSS. Agora é estado da sala: vem do
 * servidor, vale pra todo mundo e fica gravado — que é o que separa
 * "cenário" de "decoração".
 *
 * Arrastar só funciona no **modo decorar**, ligado por um botão. Fora
 * dele o clique na jukebox é play/pause, não arrasto: se o móvel pudesse
 * ser empurrado a qualquer momento, mexer no som viraria mover a mobília
 * por acidente.
 *
 * Hoje só existe um móvel decorável (a jukebox). A lista continua sendo
 * lista de propósito — o dia em que entrar um segundo, nada aqui muda.
 */

const MOVEIS = ["jukebox"];
let moveis = { jukebox: { x: 50, y: 52 } };
let decorando = false;

function posicionarMovel(qual) {
  const el = $("#" + qual);
  const p = moveis[qual];
  if (!el || !p) return;
  el.style.left = p.x + "%";
  el.style.bottom = p.y + "%";
  // Mesma regra de profundidade dos bonecos e do controle: quem está mais
  // pra baixo na tela cobre quem está atrás. Sem isto, mover a TV pra
  // frente do sofá não mudaria quem tapa quem.
  el.style.zIndex = String(Math.round(1000 - p.y * 10));
}

function pintarMoveis() {
  for (const q of MOVEIS) posicionarMovel(q);
}

function modoDecorar(ligado) {
  decorando = ligado;
  chao.classList.toggle("decorando", ligado);
  $("#decorar").textContent = ligado ? "pronto" : "decorar";
  if (ligado) sistema("modo decorar: arraste a jukebox pra onde quiser");
}

$("#decorar").onclick = () => modoDecorar(!decorando);

// Qual móvel está sendo arrastado, e por qual dedo/ponteiro. É um estado
// explícito de propósito: dava pra perguntar `el.hasPointerCapture(...)`,
// mas aí "estou arrastando?" passaria a depender de a captura ter dado
// certo — e se ela falhar, o arrasto morre em silêncio, sem erro nenhum.
// A captura vira o que ela é de fato: um reforço pra o ponteiro não
// escapar pro elemento de baixo no meio do movimento.
let arrasto = null;

for (const qual of MOVEIS) {
  const el = $("#" + qual);

  el.addEventListener("pointerdown", (e) => {
    if (!decorando) return;
    e.preventDefault();
    e.stopPropagation();          // senão o clique também manda o boneco andar
    arrasto = { qual, ponteiro: e.pointerId };
    el.classList.add("pegando");
    try { el.setPointerCapture(e.pointerId); } catch { /* reforço, não requisito */ }
  });

  el.addEventListener("pointermove", (e) => {
    if (!arrasto || arrasto.qual !== qual || arrasto.ponteiro !== e.pointerId) return;
    const r = chao.getBoundingClientRect();
    moveis[qual] = {
      x: clamp(((e.clientX - r.left) / r.width) * 100, 0, 100),
      y: clamp(((r.bottom - e.clientY) / r.height) * 100, 0, 100),
    };
    // Move na hora, sem esperar o servidor: é o mesmo motivo do movimento
    // do boneco ser previsto no cliente. Móvel que só anda depois da ida
    // e volta arrasta borrachudo.
    posicionarMovel(qual);
  });

  const largar = (e) => {
    if (!arrasto || arrasto.qual !== qual || arrasto.ponteiro !== e.pointerId) return;
    arrasto = null;
    el.classList.remove("pegando");
    try { el.releasePointerCapture(e.pointerId); } catch { /* já solto */ }
    // Só no fim do arrasto. Mandar a cada pixel encheria o socket de
    // mensagens pra desenhar a mesma coisa.
    enviar({ type: "movel", qual, pos: moveis[qual] });
  };
  el.addEventListener("pointerup", largar);
  el.addEventListener("pointercancel", largar);
}

/* ------------------------------------------------------------ chat */

const log = $("#chatlog");

function linha(html, classe = "") {
  const grudado = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  const p = document.createElement("p");
  if (classe) p.className = classe;
  p.innerHTML = html;
  log.appendChild(p);
  while (log.children.length > 250) log.firstChild.remove();
  if (grudado) log.scrollTop = log.scrollHeight;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function corDoNick(nick) {
  let h = 0;
  for (const c of nick) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 30%)`;
}

function sistema(txt) { linha("» " + esc(txt), "sis"); }

function enviarChat() {
  const el = $("#dizer");
  const txt = el.value.trim();
  if (!txt) return;
  if (!conectado()) return sistema("sem conexão — tenta de novo em instantes");
  enviar({ type: "chat", text: txt });
  el.value = "";
  avisarDigitando(false);
}

$("#enviar").onclick = enviarChat;
$("#dizer").addEventListener("keydown", (e) => { if (e.key === "Enter") enviarChat(); });

/* ------------------------------------------------- "está digitando"

   Mandamos só um liga/desliga, nunca o texto: o que a pessoa escreveu e
   apagou antes de mandar é dela.

   Enquanto ela digita, reavisamos de tempos em tempos em vez de mandar a
   cada tecla — uma mensagem por caractere seria trocar rajada de rede por
   um enfeite. Do outro lado o balão sobrevive um pouco mais que esse
   intervalo, senão ele piscaria entre um reaviso e outro. */
const DIGITANDO_REENVIO_MS = 2000;

let digitandoDesde = 0;

function avisarDigitando(ligado) {
  /* O balão sobre a SUA cabeça é desenhado aqui, na hora, sem passar pelo
     servidor. Aqui você enxerga o seu boneco — vê-lo pensando enquanto
     você escreve é retorno que um chat comum não teria onde dar.

     Local e não pela rede por dois motivos: aparece no primeiro toque de
     tecla em vez de depois da ida e volta, e continua certo mesmo com a
     conexão caída. O servidor segue mandando o aviso só pros outros — não
     faz sentido ele ecoar de volta uma coisa que já sabemos.

     A linha do chat NÃO ganha você junto: "você está digitando..." é
     ruído. Ela já filtra o próprio uid em `pintarQuemDigita`. */
  const eu = gente.get(meuUid);
  if (eu) mostrarDigitando(eu, ligado);

  if (!conectado()) return;
  const agora = performance.now();
  if (ligado) {
    if (agora - digitandoDesde < DIGITANDO_REENVIO_MS) return;
    digitandoDesde = agora;
  } else {
    if (!digitandoDesde) return;   // já estava parado; não precisa avisar
    digitandoDesde = 0;
  }
  enviar({ type: "digitando", ligado });
}

$("#dizer").addEventListener("input", () => {
  avisarDigitando($("#dizer").value.trim().length > 0);
});
// Saiu do campo: parou. Sem isto, quem clica fora com texto escrito fica
// "digitando" pros outros até o balão expirar sozinho.
$("#dizer").addEventListener("blur", () => avisarDigitando(false));

/* ------------------------------------------------------------ buzina

   TEMPORÁRIO — combinado que sai depois. Existe porque o uso real é
   deixar a aba escondida ouvindo música: sem barulho, o chat só é lido
   quando alguém lembra de olhar.

   Faz duas coisas de propósito. O som chama quem está de fone; o título
   piscando chama quem está com o som desligado e só vê a barra de abas.
   Só o som não bastaria. */

let audio = null;

/* O navegador cria o contexto de áudio suspenso até a pessoa interagir com
   a página. Isso morde exatamente o caso de uso: quem deixou a aba aberta
   sem clicar em nada é justamente quem mais precisa ouvir a buzina. Então
   destravamos no primeiro gesto, qualquer um, e não na hora do barulho —
   na hora do barulho já é tarde. */
function destravarAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch {
    // navegador sem WebAudio: resta o título piscando
  }
}
for (const gesto of ["pointerdown", "keydown"]) {
  addEventListener(gesto, destravarAudio, { once: true });
}

/* Numa rajada as buzinas chegam quase juntas. Dez cornetas de 0,75s
   soando sobrepostas somam amplitude, estouram na saída e viram ruído
   sujo em vez de dez toques. Este piso separa os disparos o bastante pra
   cada um ser ouvido como um toque. */
const BUZINA_MIN_MS = 220;
let ultimaBuzinaTocada = 0;

/* Barramento de saída com limitador.

   Uma corneta sozinha já foi calibrada pra não estourar, mas ela dura
   0,75s e numa rajada três ou quatro se sobrepõem — as amplitudes somam e
   o estouro volta. Baixar o ganho a ponto de aguentar quatro deixaria uma
   sozinha fraca demais, que é o caso comum.

   O compressor resolve os dois: deixa a buzina única com o volume que ela
   merece e segura o pico quando várias se empilham. */
let saida = null;

function barramento() {
  if (!saida) {
    saida = audio.createDynamicsCompressor();
    saida.threshold.value = -8;
    saida.knee.value = 6;
    saida.ratio.value = 12;
    saida.attack.value = 0.003;
    saida.release.value = 0.25;
    saida.connect(audio.destination);
  }
  return saida;
}

function tocarBuzina() {
  destravarAudio();
  if (!audio) return;

  const agora = performance.now();
  if (agora - ultimaBuzinaTocada < BUZINA_MIN_MS) return;
  ultimaBuzinaTocada = agora;

  /* Contexto suspenso não anda o relógio: `currentTime` fica parado.
     Se montarmos o som agora, agendamos tudo num instante que já terá
     passado quando ele voltar — e aí não sai barulho nenhum, sem erro
     nenhum no console. Por isso esperamos o resume antes de tocar. */
  if (audio.state === "suspended") {
    audio.resume().then(soar).catch(() => {});
  } else {
    soar();
  }
}

function soar() {
  try {
    const t0 = audio.currentTime;
    const DUR = 0.75;

    /* Corneta, não bipe. O que faz soar como corneta e não como
       sintetizador são três coisas juntas:

       1. Duas vozes numa quarta justa (Mib e Láb). É o intervalo das
          cornetas e buzinas de caminhão de duas bocas — sozinha, uma nota
          só soa como despertador.
       2. Cada voz sai dobrada e desafinada por alguns hertz. As duas
          cópias entram e saem de fase e produzem aquele batimento áspero
          que dá o "corpo" do instrumento. Sem isso o som fica liso e
          eletrônico demais.
       3. Um passa-baixa que abre rápido no ataque e fecha no fim, imitando
          a boca do instrumento respondendo ao sopro. É isso que dá o
          "uáá" em vez de um tom chapado. */

    const filtro = audio.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.Q.value = 6;
    filtro.frequency.setValueAtTime(500, t0);
    filtro.frequency.exponentialRampToValueAtTime(3800, t0 + 0.09);
    filtro.frequency.setValueAtTime(3800, t0 + DUR - 0.18);
    filtro.frequency.exponentialRampToValueAtTime(900, t0 + DUR);

    const mestre = audio.createGain();
    // 0.16 medido: com 0.3 o pico passava de 1.6 e estourava na saída (55
    // amostras ceifadas), que é exatamente o chiado que faz um sintetizado
    // soar barato. Aqui o pico fica em 0.87.
    mestre.gain.setValueAtTime(0, t0);
    mestre.gain.linearRampToValueAtTime(0.16, t0 + 0.035);
    mestre.gain.setValueAtTime(0.16, t0 + DUR - 0.1);
    mestre.gain.linearRampToValueAtTime(0, t0 + DUR);

    filtro.connect(mestre).connect(barramento());

    for (const base of [311.1, 415.3]) {          // Mib4 e Láb4
      for (const desafino of [-3.5, 3.5]) {
        const osc = audio.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(base * 0.94, t0);
        // a nota "firma" logo no começo, como sopro pegando pressão
        osc.frequency.linearRampToValueAtTime(base + desafino, t0 + 0.06);
        osc.connect(filtro);
        osc.start(t0);
        osc.stop(t0 + DUR);
      }
    }
  } catch {
    // sem áudio disponível: o título piscando ainda avisa
  }
}

let piscando = null;

function chamarAtencao() {
  if (piscando) return;
  const original = document.title;
  let liga = false;
  const parar = () => {
    clearInterval(piscando);
    piscando = null;
    document.title = original;
    removeEventListener("focus", parar);
    document.removeEventListener("visibilitychange", aoVer);
  };
  const aoVer = () => { if (document.visibilityState === "visible") parar(); };

  piscando = setInterval(() => {
    document.title = (liga = !liga) ? "🔔 CHAMARAM NA SALA!" : original;
  }, 700);

  addEventListener("focus", parar);
  document.addEventListener("visibilitychange", aoVer);
  // Rede de segurança: se ninguém olhar, não fica piscando pra sempre.
  setTimeout(() => { if (piscando) parar(); }, 25000);
}

// Sem travar o botão: floodar é permitido de propósito, e é o servidor
// que segura o teto (10 numa janela de 40s). Quando ele barrar, a
// mensagem dele diz quantos segundos faltam.
$("#buzina").onclick = () => {
  if (!conectado()) return sistema("sem conexão — tenta de novo em instantes");
  enviar({ type: "buzina" });
};

/* `saindo` avisa o laço de reconexão que a queda do socket foi de propósito
   — sem isso ele tentaria reconectar durante a navegação. */
function sairPara(destino) {
  saindo = true;
  location.href = destino;
}

/* --------------------------------------------------- o que a sala lembra
 *
 * A sala agora tem passado: o servidor guarda no banco quanto já tocou
 * ali, o que rolou e quem frequenta. Isso vira três linhas no chat na
 * hora que você entra, e não um painel — sala que abre com um relatório
 * do lado vira ferramenta, e a tese aqui é que ela seja um lugar. No
 * chat, o passado chega como alguém te contando.
 *
 * Nada disso aparece em sala nova: a sala sem história fica calada em
 * vez de anunciar três zeros.
 */
function contarPassado(sala, quantosOnline, meuNick) {
  if (!sala) return;

  // O contador começa de onde a sala parou, não de zero: senão a primeira
  // música da noite anunciaria "1 já tocou nesta sala" num lugar que tem
  // trezentas.
  musicasOuvidas = sala.musicas || 0;

  if (sala.musicas) {
    sistema(sala.musicas === 1
      ? "1 música já tocou aqui"
      : `${sala.musicas} músicas já tocaram aqui`);
  }

  const ultimo = (sala.historico || [])[0];
  if (ultimo) {
    sistema(`a última foi "${ultimo.titulo || ultimo.video}"` +
            (ultimo.por ? `, que ${ultimo.por} colocou` : ""));
  }

  // Só quando você está sozinho. Com gente online a lista de nomes já
  // está na tela, e repetir quem frequenta seria dizer o que se vê.
  if (quantosOnline <= 1) {
    // Você entra na lista de membros no mesmo instante em que abre a
    // sala — sem tirar o seu nome, a sala te informaria que você costuma
    // aparecer por aqui.
    const outros = (sala.membros || [])
      .map((m) => m.nick)
      .filter((n) => n && n !== meuNick)
      .slice(0, 5);
    if (outros.length) {
      sistema(`costumam aparecer por aqui: ${outros.join(", ")}`);
    }
  }
}

/* ------------------------------------------------------------ vídeo */

let musicasOuvidas = 0;
let playerMontado = false;
let ultimoEstado = null;

/* O player só é construído quando a sala precisa dele. Montar sempre
   carregaria o iframe do YouTube em toda sala vazia, de graça. */
async function garantirPlayer() {
  if (playerMontado) return;
  playerMontado = true;
  await video.montarPlayer($("#player"), {
    enviar: (msg) => enviar(msg),
    carregando: () => estadoVideo("carregando..."),
    erro: (txt) => sistema(txt),
  });
}

function estadoVideo(txt) {
  $("#estadovideo").textContent = txt;
  $("#estadovideo").title = txt;
  acenderJukebox();
  pintarLiberar();
}

/* A jukebox acende quando tem som rolando de verdade.
 *
 * Sai do mesmo `ultimoEstado` que a linha de texto em vez de ter um
 * liga/desliga próprio — duas fontes de verdade pra "está tocando?"
 * acabam discordando, e aí o móvel fica aceso com a sala em silêncio.
 * Mesma regra que já vale pro balão e a linha de "está digitando".
 *
 * Isso importa mais do que parece agora que não existe tela: o aceso é o
 * ÚNICO sinal no chão de que a sala está tocando alguma coisa. */
function acenderJukebox() {
  const aceso = !!(ultimoEstado && ultimoEstado.id
                   && ultimoEstado.tocando && video.estaLiberado());
  $("#jukebox").classList.toggle("tocando", aceso);
}

/* O aviso de "clique pra soltar o som" também sai do estado, não de quem
   lembrou de escondê-lo.
   Antes ele era ligado e desligado na mão, e havia DOIS caminhos que
   liberam o áudio: o clique no aviso e colar um link (colar já é gesto do
   usuário, então pedir clique de novo seria pedir duas vezes). Só o
   primeiro escondia o aviso — então quem colava um link com o aviso na
   tela ficava com ele pendurado pra sempre, por cima da jukebox, com o
   som já tocando por trás. Derivando dá uma resposta só. */
function pintarLiberar() {
  const precisa = !!(ultimoEstado && ultimoEstado.id) && !video.estaLiberado();
  $("#liberar").hidden = !precisa;
}

/* Reescreve a linha do vídeo com o que sabemos agora. Existe separado
   porque o título chega depois do vídeo começar: quando ele cair, é isto
   que troca o id pelo nome sem mexer no player. */
function pintarAgora() {
  if (!ultimoEstado || !ultimoEstado.id) return;
  if (!video.estaLiberado()) return;   // a tela de clique manda na linha
  const nome = rotulo(ultimoEstado.id);
  estadoVideo(`${nome} — ${ultimoEstado.tocando ? "tocando" : "pausado"}`);
}

async function mostrarVideo(est) {
  if (!est || !est.id) return;
  ultimoEstado = est;
  // A estrela é do vídeo que está tocando, então acompanha a troca. Fica
  // antes do `await`: depois dele, a tela de "clique pra entrar" pode
  // devolver o controle antes de a estrela ter sido repintada.
  pintarBotaoFavoritar();
  await garantirPlayer();

  // Sem o gesto do usuário o navegador barra o áudio. A tela de clique é
  // requisito do navegador, não escolha de design.
  if (!video.estaLiberado()) {
    estadoVideo("clique na jukebox pra ouvir");   // já pinta o aviso
    return;
  }
  video.aplicar(est);
  pintarAgora();
}

$("#liberar").onclick = async () => {
  await garantirPlayer();
  video.liberarAudio();
  pintarLiberar();
  if (ultimoEstado) video.aplicar(ultimoEstado);
  estadoVideo("entrou");
};

function porVideo() {
  const v = $("#link").value.trim();
  if (!v) return $("#link").focus();
  if (!conectado()) return sistema("sem conexão — tenta de novo em instantes");
  // Pôr na fila é livre pra todo mundo, mesmo sem o controle: é a parte
  // coletiva. O controle serve pra ninguém brigar pelo play/pause, não
  // pra decidir o que a sala assiste.
  enviar({ type: "fila_por", video: v });
  $("#link").value = "";
  // Quem cola o link está interagindo com a página: o gesto de autoplay
  // já vale, então não faz sentido pedir clique de novo pra essa pessoa.
  garantirPlayer().then(() => { video.liberarAudio(); pintarLiberar(); });
}

$("#poriVideo").onclick = porVideo;
$("#link").addEventListener("keydown", (e) => { if (e.key === "Enter") porVideo(); });

/* ------------------------------------------- controle remoto e fila */

let controleDe = "";           // uid de quem está com ele ("" = no chão)
let controlePos = { x: 50, y: 80 };
let filaAtual = [];
// id do vídeo -> título, resolvido pelo servidor. Chega depois do vídeo,
// então tudo que mostra vídeo tem que aguentar não ter título ainda e
// cair no id — que é o que a sala mostrava antes disto existir.
const titulos = {};
const rotulo = (id) => titulos[id] || id;
let elControleChao = null;

const euMando = () => controleDe && controleDe === meuUid;

/** O controle deixa de estar onde estava e vai pro lugar novo. */
function pintarControle() {
  // tira de onde quer que esteja agora
  if (elControleChao) { elControleChao.remove(); elControleChao = null; }
  for (const p of gente.values()) {
    const m = p.el.querySelector(".controle.mao");
    if (m) m.remove();
  }

  if (controleDe) {
    const dono = gente.get(controleDe);
    if (dono) {
      const c = document.createElement("div");
      c.className = "controle mao";
      c.title = "está com o controle remoto";
      dono.el.appendChild(c);
    }
  } else {
    // caído no chão, clicável
    const c = document.createElement("div");
    c.className = "controle chao";
    c.title = "clique pra pegar o controle remoto";
    c.style.left = controlePos.x + "%";
    c.style.bottom = controlePos.y + "%";
    // mesma regra de profundidade dos bonecos: quem está na frente cobre
    c.style.zIndex = String(Math.round(1000 - controlePos.y * 10));
    c.onclick = (e) => {
      e.stopPropagation();          // senão o clique também anda o boneco
      enviar({ type: "controle_pegar" });
    };
    chao.appendChild(c);
    elControleChao = c;
  }

  pintarBotoes();
}

function pintarBotoes() {
  const meu = euMando();
  for (const id of ["btVoltar", "btPlay", "btAvancar", "btPular"]) {
    $("#" + id).disabled = !meu;
  }
  // O escudo tapa o iframe de quem não manda.
  $("#escudo").hidden = meu;
  $("#pegarControle").textContent = meu ? "devolver" : "pegar";
  $("#pegarControle").hidden = !!controleDe && !meu;

  if (!controleDe) {
    $("#quemManda").textContent = "controle remoto no chão";
  } else if (meu) {
    $("#quemManda").textContent = "você está com o controle";
  } else {
    const d = gente.get(controleDe);
    $("#quemManda").textContent = `${d ? d.nick : "alguém"} está com o controle`;
  }
}

$("#pegarControle").onclick = () => {
  enviar({ type: euMando() ? "controle_soltar" : "controle_pegar" });
};

$("#btPlay").onclick = () => {
  enviar({
    type: video.estaTocando() ? "video_pause" : "video_play",
    pos: video.posicaoAtual(),
  });
};
$("#btVoltar").onclick  = () => enviar({ type: "video_seek", pos: video.posicaoRelativa(-10) });
$("#btAvancar").onclick = () => enviar({ type: "video_seek", pos: video.posicaoRelativa(10) });
$("#btPular").onclick   = () => enviar({ type: "video_pular" });

/* ------------------------------------------------------------ volume

   Ajuste de cada um: não vai pro servidor e não exige o controle remoto.
   Play, pause e seek mudam o que a sala inteira vê; volume só mexe no
   ouvido de quem mexeu.

   Fica guardado no navegador porque a alternativa é a pessoa reajustar
   toda vez que entra — e quem baixou o volume por estar no escritório vai
   querer ele baixo na próxima também. */
const VOLUME_CHAVE = "volume";

function lerVolumeGuardado() {
  const v = Number(localStorage.getItem(VOLUME_CHAVE));
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 100;
}

let volumeAntesDoMudo = 100;

function pintarVolume(v) {
  $("#volume").value = String(v);
  $("#volumeNum").textContent = v;
  $("#mudo").textContent = v === 0 ? "🔇" : v < 50 ? "🔉" : "🔊";
  $("#mudo").title = v === 0 ? "voltar o som" : "mudo";
}

function porVolume(v, guardar = true) {
  const vol = video.porVolume(v);
  pintarVolume(vol);
  if (guardar) {
    try { localStorage.setItem(VOLUME_CHAVE, String(vol)); } catch { /* modo privado */ }
  }
  return vol;
}

$("#volume").addEventListener("input", (e) => {
  const v = Number(e.target.value);
  if (v > 0) volumeAntesDoMudo = v;
  porVolume(v);
});

$("#mudo").onclick = () => {
  if (video.volumeAtual() === 0) {
    // volta pro que era antes; se a pessoa tinha deixado em 0 e saiu,
    // 100 é melhor que continuar mudo sem entender por quê
    porVolume(volumeAntesDoMudo || 100);
  } else {
    volumeAntesDoMudo = video.volumeAtual();
    porVolume(0);
  }
};

// aplica o que estava guardado assim que a página abre
porVolume(lerVolumeGuardado(), false);

/* Gancho de depuração no console: `sala.video()` mostra o que o player
   está fazendo de verdade — posição, estado, taxa e volume. A sincronia é
   a parte difícil deste projeto e é toda invisível; sem isto, investigar
   dessincronia vira adivinhação. Só lê, não muda nada. */
window.sala = { video: () => video.diagnostico() };

/* A fila fica escondida atrás de um botão. Aberta o tempo todo ela comia
   altura da barra mesmo vazia, que é o estado mais comum da sala. */
$("#verFila").onclick = (e) => {
  e.stopPropagation();
  $("#filaPop").hidden = !$("#filaPop").hidden;
};
// clicar fora fecha. Os três popovers da barra fecham juntos: abrir um
// com outro aberto empilharia caixa sobre caixa no mesmo canto.
document.addEventListener("click", (e) => {
  if (!e.target.closest(".filaCaixa")) {
    $("#filaPop").hidden = true;
    $("#favPop").hidden = true;
  }
  if (!e.target.closest("#quantos")) $("#membrosPop").hidden = true;
});

function pintarFila() {
  const alvo = $("#fila");
  alvo.textContent = "";
  $("#filaVazia").hidden = filaAtual.length > 0;
  $("#verFila").textContent = `fila (${filaAtual.length})`;

  filaAtual.forEach((id, i) => {
    const el = document.createElement("div");
    const qual = document.createElement("span");
    qual.className = "qual";
    qual.textContent = `${i + 1}. ${rotulo(id)}`;
    qual.title = rotulo(id);
    const x = document.createElement("span");
    x.className = "tirar";
    x.textContent = "✕";
    x.title = "tirar da fila";
    x.onclick = () => enviar({ type: "fila_tirar", video: id });
    el.append(qual, x);
    alvo.appendChild(el);
  });
}

/* ------------------------------------------------------- favoritos
 *
 * O repertório da sala: o que o grupo marcou pra repetir. É da **sala**,
 * não de quem clicou — duas pessoas marcando a mesma música é uma linha
 * só. Favorito por pessoa seria playlist pessoal, e playlist pessoal não
 * é o que faz um grupo ter repertório.
 *
 * Clicar num favorito põe na fila. É o único jeito de ele servir pra
 * alguma coisa: lista que só se olha é enfeite.
 */

let favoritosAtual = [];

const estaFavoritado = (id) => favoritosAtual.some((f) => f.video === id);

function pintarFavoritos() {
  const alvo = $("#favoritos");
  alvo.textContent = "";
  $("#favVazio").hidden = favoritosAtual.length > 0;
  $("#verFavoritos").textContent = `★ ${favoritosAtual.length}`;

  for (const f of favoritosAtual) {
    const el = document.createElement("div");
    const qual = document.createElement("span");
    qual.className = "qual";
    qual.textContent = f.titulo || f.video;
    qual.title = `pôr "${f.titulo || f.video}" na fila` +
                 (f.por ? ` · guardado por ${f.por}` : "");
    qual.onclick = () => {
      enviar({ type: "fila_por", video: f.video });
      $("#favPop").hidden = true;
    };
    const x = document.createElement("span");
    x.className = "tirar";
    x.textContent = "✕";
    x.title = "tirar dos favoritos da sala";
    x.onclick = () => enviar({ type: "favoritar", video: f.video, ligado: false });
    el.append(qual, x);
    alvo.appendChild(el);
  }
  pintarBotaoFavoritar();
}

/* A estrela do que está tocando agora. Sem vídeo não há o que guardar,
   então ela fica desligada em vez de sumir — botão que some muda o
   layout da barra toda vez que a sala fica sem vídeo. */
function pintarBotaoFavoritar() {
  const id = ultimoEstado && ultimoEstado.id;
  const bt = $("#favoritar");
  bt.disabled = !id;
  const marcado = !!id && estaFavoritado(id);
  bt.classList.toggle("marcado", marcado);
  bt.textContent = marcado ? "★" : "☆";
  bt.title = !id
    ? "nada tocando pra guardar"
    : (marcado ? "tirar dos favoritos da sala"
               : "guardar essa nos favoritos da sala");
}

$("#favoritar").onclick = () => {
  const id = ultimoEstado && ultimoEstado.id;
  if (!id) return;
  enviar({ type: "favoritar", video: id, ligado: !estaFavoritado(id) });
};

$("#verFavoritos").onclick = (e) => {
  e.stopPropagation();
  $("#favPop").hidden = !$("#favPop").hidden;
};

/* ---------------------------------------------------- quem frequenta
 *
 * Os frequentadores da sala, com o boneco de cada um. Quem não está
 * agora aparece **apagadinho** em vez de sumir: numa sala vazia, ver os
 * bonecos de quem costuma vir é o que faz o lugar parecer de alguém.
 * Some de vez e a sala vazia vira tela em branco.
 */

let membrosAtual = [];

function pintarMembros() {
  const alvo = $("#membros");
  alvo.textContent = "";

  // Quem está online agora é sabido pelo apelido, que é o que a lista de
  // membros carrega — o uid da conexão não vale aqui, porque a mesma
  // conta abre duas abas com uids diferentes.
  const online = new Set([...gente.values()].map((p) => p.nick));

  for (const m of membrosAtual) {
    const el = document.createElement("div");
    const aqui = online.has(m.nick);
    el.className = "membro" + (aqui ? "" : " fora");

    el.appendChild(canvasAvatar(normalizar(m.avatar), 1));

    const quem = document.createElement("span");
    quem.className = "quem3";
    quem.textContent = m.nick;
    el.appendChild(quem);

    if (aqui) {
      const ag = document.createElement("span");
      ag.className = "agora";
      ag.textContent = "aqui";
      el.appendChild(ag);
    }
    alvo.appendChild(el);
  }
}

$("#quantos").onclick = (e) => {
  e.stopPropagation();
  const pop = $("#membrosPop");
  // Repinta na abertura: quem está online muda o tempo todo, e uma lista
  // pintada uma vez mostraria "aqui" pra quem já saiu.
  if (pop.hidden) pintarMembros();
  pop.hidden = !pop.hidden;
};

/* ---------------------------------------------------------- tranca
 *
 * Convite, não lista de permissões: o dono tranca, copia o link e manda.
 * Quem abre o link vira membro e entra. Entre amigos, administrar uma
 * lista de quem pode entrar é burocracia que ninguém mantém.
 */

let souDono = false;
let salaPrivada = false;

function pintarTranca() {
  const bt = $("#tranca");
  bt.hidden = !souDono;
  bt.textContent = salaPrivada ? "🔒 trancada" : "🔓 aberta";
  bt.classList.toggle("fechada", salaPrivada);
  bt.title = salaPrivada
    ? "só entra quem tem o convite — clique pra abrir a sala"
    : "clique pra trancar: só entra quem receber o link";
}

$("#tranca").onclick = async () => {
  const querFechar = !salaPrivada;
  let r;
  try {
    r = await fetch(`/api/sala/${encodeURIComponent(codigoReal)}/tranca`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privada: querFechar }),
    }).then(async (resp) => {
      const d = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error((d && d.detail) || "não deu pra mudar");
      return d;
    });
  } catch (e) {
    return sistema(e.message);
  }

  salaPrivada = r.privada;
  pintarTranca();

  if (!salaPrivada) {
    return sistema("a sala está aberta de novo — o convite antigo não vale mais");
  }
  // O link é a única coisa que o dono precisa fazer com isso, então ele
  // vai direto pra área de transferência. Se o navegador recusar (sem
  // permissão, sem HTTPS), o link ainda aparece no chat pra copiar na
  // mão — falhar em silêncio deixaria o dono sem o convite.
  try {
    await navigator.clipboard.writeText(r.link);
    sistema("sala trancada — o link de convite está na sua área de transferência");
  } catch {
    sistema("sala trancada — o convite é: " + esc(r.link));
  }
};

$("#sair").onclick = () => sairPara("/");
$("#trocar").onclick = () => sairPara("/");
$("#irLobby").onclick = () => {
  if (codigoReal === "lobby") return sistema("você já está no lobby");
  sairPara("/sala/lobby");
};

/* ------------------------------------------------------------ editor */

const painel = $("#painel");
let editorPronto = false;

/* Avisa a sala da mudança. Vai com folga porque o usuário fica clicando nas
   setinhas: sem isso, cada clique viraria uma mensagem. */
let avisoPendente = null;
function avisarMudanca() {
  // Não salvo nada aqui: quem grava no banco é o servidor, ao receber a
  // mensagem abaixo. Uma fonte da verdade só.
  clearTimeout(avisoPendente);
  avisoPendente = setTimeout(() => {
    const eu = gente.get(meuUid);
    if (!eu) return;

    const novoAvatar = normalizar(perfil.avatar);
    if (JSON.stringify(novoAvatar) !== JSON.stringify(eu.avatar)) {
      eu.avatar = novoAvatar;
      eu.sujo = true;
      enviar({ type: "avatar", avatar: novoAvatar });
    }

    const nick = perfil.nick.trim();
    if (nick && nick !== eu.nick) {
      eu.nick = nick;
      eu.nomeEl.textContent = nick;
      enviar({ type: "nick", nick });
    }
    pintarLista();
  }, 250);
}

function abrirEditor() {
  if (!editorPronto) {
    montarPainel($("#editor"), perfil, avisarMudanca, { esc: 2, comNick: true });
    editorPronto = true;
  }
  painel.hidden = false;
}

$("#editar").onclick = () => { painel.hidden ? abrirEditor() : (painel.hidden = true); };
$("#fechar-painel").onclick = () => { painel.hidden = true; };

// clique no painel não pode virar ordem de andar até lá
painel.addEventListener("click", (e) => e.stopPropagation());

/* ------------------------------------------------------------ roster */

/* Era uma janela listando nome por nome. Virou uma cabecinha e um número:
   quem está na sala já aparece no chão, com boneco e apelido embaixo — a
   lista repetia essa informação ocupando uma janela inteira da coluna.

   A cabeça é o avatar de quem está olhando, recortado por CSS (a caixa
   tem 20×16 e o canvas entra deslocado). Serve de ícone e de brinde: você
   se reconhece ali. */
function pintarLista() {
  const caixa = $("#quantos .cabeca");
  const eu = gente.get(meuUid);
  if (eu) {
    caixa.textContent = "";
    const cv = document.createElement("canvas");
    cv.width = LARG; cv.height = ALT_CANVAS;
    desenhar(cv.getContext("2d"), eu.avatar, { esc: 1, sombra: false });
    caixa.appendChild(cv);
  }
  $("#contagem").textContent = gente.size;
  $("#quantos").title =
    gente.size === 1 ? "só você por aqui" : `${gente.size} na sala`;
}

/* ------------------------------------------------------------ conexão */

function conectado() { return ws && ws.readyState === WebSocket.OPEN; }

function enviar(obj) {
  if (conectado()) ws.send(JSON.stringify(obj));
}

function status(txt, ok) {
  const el = $("#status");
  el.textContent = txt;
  el.className = ok ? "on" : "off";
}

function conectar() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws/${encodeURIComponent(codigo)}`);

  ws.onopen = () => {
    tentativas = 0;
    status("conectado", true);
    // Não mando "join": o servidor já sabe quem eu sou pelo cookie.
  };

  ws.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    receber(m);
  };

  ws.onclose = (e) => {
    if (saindo) return;

    // 4001 = servidor não reconheceu a sessão. Reconectar não resolve.
    if (e.code === 4001) {
      saindo = true;
      location.href = "/entrar";
      return;
    }

    status("reconectando...", false);
    // limpa a sala: quando voltar, o servidor manda o elenco atual de novo
    for (const uid of [...gente.keys()]) tirarPessoa(uid);
    meuUid = null;
    pintarLista();

    tentativas++;
    const espera = Math.min(1000 * 2 ** (tentativas - 1), 15000);
    setTimeout(conectar, espera);
  };

  ws.onerror = () => { /* o onclose já cuida */ };
}

function receber(m) {
  switch (m.type) {
    case "bemvindo": {
      meuUid = m.eu.uid;
      for (const u of m.gente) {
        if (!gente.has(u.uid)) novaPessoa(u, u.uid === meuUid);
      }
      if (!gente.has(meuUid)) novaPessoa(m.eu, true);
      codigoReal = m.sala.code;
      document.title = codigoReal + " — sala";
      $("#titulo").textContent = "■ sala :: " + codigoReal;
      montarCenario(chao, codigoReal);
      sistema(`você entrou em "${codigoReal}"`);
      contarPassado(m.sala, m.gente.length, m.eu.nick);
      pintarLista();
      // Os títulos entram antes de qualquer coisa que mostre vídeo, senão
      // a primeira pintura sai com os ids.
      Object.assign(titulos, m.titulos || {});
      // Quem chega no meio do filme já entra no ponto certo.
      if (m.video && m.video.id) mostrarVideo(m.video);
      if (m.controle) {
        controleDe = m.controle.de;
        controlePos = m.controle.pos || controlePos;
      }
      filaAtual = m.fila || [];

      // O que a sala guardou e como ela está arrumada. Tudo vem do banco,
      // então uma sala que já existia abre exatamente como foi deixada.
      favoritosAtual = m.sala.favoritos || [];
      membrosAtual = m.sala.membros || [];
      if (m.sala.moveis) moveis = m.sala.moveis;
      souDono = !!m.sala.sou_dono;
      salaPrivada = !!m.sala.privada;

      pintarControle();
      pintarFila();
      pintarFavoritos();
      pintarMoveis();
      pintarTranca();
      if (salaPrivada) {
        sistema(souDono
          ? "esta sala está trancada — só entra quem tem o seu convite"
          : "esta sala é trancada; você entrou porque foi convidado");
      }
      break;
    }

    case "entrou":
      if (!gente.has(m.user.uid)) novaPessoa(m.user, false);
      sistema(`${m.user.nick} entrou`);
      pintarLista();
      // Quem chega agora passa a frequentar a sala. Sem isto, alguém que
      // entrou depois de mim apareceria no chão mas não em "quem
      // frequenta" — a lista só é mandada uma vez, no bemvindo.
      if (!membrosAtual.some((x) => x.nick === m.user.nick)) {
        membrosAtual.unshift({ nick: m.user.nick, avatar: m.user.avatar });
      }
      break;

    case "saiu":
      tirarPessoa(m.uid);
      sistema(`${m.nick} saiu`);
      pintarLista();
      break;

    case "chat": {
      const p = gente.get(m.uid);
      if (p) falar(p, m.text);
      linha(`<b style="color:${corDoNick(m.nick)}">${esc(m.nick)}:</b> ${esc(m.text)}`);
      break;
    }

    case "moveu": {
      const p = gente.get(m.uid);
      if (p) p.destino = { x: m.pos.x, y: m.pos.y };
      break;
    }

    case "video_trocou":
      if (!m.id) {
        sistema("a fila acabou");
        estadoVideo("");
        // Sem vídeo não há o que guardar: a estrela desliga em vez de
        // sumir, senão a barra muda de largura toda vez que a fila seca.
        ultimoEstado = null;
        pintarBotaoFavoritar();
      } else {
        if (m.daFila) sistema("entrou o próximo da fila");
        else if (m.por) sistema(`${m.por} colocou um vídeo`);
        mostrarVideo(m);
      }
      break;

    case "controle": {
      const antes = controleDe;
      controleDe = m.de;
      if (m.pos) controlePos = m.pos;
      pintarControle();
      if (m.caiu) {
        sistema(`${m.caiu} saiu e largou o controle`);
      } else if (m.de && m.de !== antes) {
        sistema(m.de === meuUid
          ? "você pegou o controle remoto"
          : `${m.nick} pegou o controle remoto`);
      } else if (!m.de && antes) {
        sistema("o controle voltou pro chão");
      }
      break;
    }

    case "fila":
      filaAtual = m.fila || [];
      pintarFila();
      if (m.novo && m.por) sistema(`${m.por} pôs um vídeo na fila`);
      break;

    // Os títulos chegam soltos, depois do vídeo. Só repintamos rótulo —
    // nada aqui toca no player, senão um texto atrasado dessincronizaria
    // a sala, que é o problema que o projeto inteiro tenta evitar.
    case "titulos":
      Object.assign(titulos, m.titulos || {});
      pintarFila();
      pintarAgora();
      // Os favoritos guardam o título junto, e ele pode ter chegado
      // vazio: sem repintar aqui, a lista fica mostrando o id cru até
      // alguém recarregar a página.
      for (const f of favoritosAtual) {
        if (!f.titulo && titulos[f.video]) f.titulo = titulos[f.video];
      }
      pintarFavoritos();
      break;

    case "favoritos":
      favoritosAtual = m.favoritos || [];
      pintarFavoritos();
      if (m.por) {
        sistema(m.novo
          ? `${m.por} guardou "${rotulo(m.novo)}" nos favoritos da sala`
          : `${m.por} tirou um vídeo dos favoritos`);
      }
      break;

    case "movel":
      // Chega só de quem arrastou (o servidor não ecoa pra ele): quem
      // mexeu já viu o móvel sob o dedo, e ecoar faria dar um pulinho.
      if (moveis[m.qual]) {
        moveis[m.qual] = m.pos;
        posicionarMovel(m.qual);
      }
      break;

    case "video_estado":
      if (typeof m.musicas === "number") {
        musicasOuvidas = m.musicas;
        sistema(musicasOuvidas === 1
          ? "acabou — foi a primeira desta sala"
          : `acabou — ${musicasOuvidas} já tocaram nesta sala`);
      }
      mostrarVideo(m);
      break;

    case "digitando": {
      const p = gente.get(m.uid);
      if (p) mostrarDigitando(p, m.ligado);
      break;
    }

    case "buzina":
      tocarBuzina();
      chamarAtencao();
      linha(`<b>📣 ${esc(m.nick)} buzinou!</b>`, "sis");
      // Só avisa quando está acabando. Dizer o saldo a cada buzina
      // encheria o chat justamente na hora da rajada.
      if (typeof m.restam === "number" && m.restam > 0 && m.restam <= 3) {
        sistema(`resta${m.restam > 1 ? "m" : ""} ${m.restam} buzina${m.restam > 1 ? "s" : ""} pra sala`);
      }
      break;

    case "sistema":
      sistema(m.texto);
      break;

    case "trocou_avatar": {
      const p = gente.get(m.uid);
      if (p) { p.avatar = normalizar(m.avatar); p.sujo = true; pintarLista(); }
      break;
    }

    case "trocou_nick": {
      const p = gente.get(m.uid);
      if (!p) break;
      p.nick = m.nick;
      p.nomeEl.textContent = m.nick;
      if (m.uid !== meuUid) sistema(`${m.antigo} agora é ${m.nick}`);
      pintarLista();
      break;
    }

    case "aviso":
      // ex: tentou um apelido que já é de outra pessoa
      sistema(m.texto);
      break;

    case "erro":
      status(m.motivo, false);
      sistema("não deu pra entrar: " + m.motivo);
      saindo = true;
      break;
  }
}

conectar();
requestAnimationFrame(laco);

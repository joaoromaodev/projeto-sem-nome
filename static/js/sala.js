/* A sala: conexão, quem está dentro, o boneco andando e o chat.
 *
 * Regra que vale pra tudo aqui: o meu boneco anda na hora, sem esperar o
 * servidor. Mandar a posição e só desenhar quando ela voltasse deixaria o
 * movimento borrachudo em qualquer internet menos que ótima. O servidor
 * serve pra contar aos outros onde eu estou, não pra me dizer onde eu estou.
 */

import { desenhar, LARG, ALT_CANVAS, normalizar, definirManifesto } from "./avatar.js";
import { preaquecer } from "./sprites.js";
import { api } from "./api.js";
import { montarPainel } from "./editor.js";

const $ = (s) => document.querySelector(s);
const chao = $("#chao");

const PX = 2;                    // escala do sprite na sala (32x48 vira 64x96)
const VEL_X = 30;                // % da largura por segundo
const VEL_Y = 20;                // o chão é raso, então anda mais devagar em profundidade
const ENVIO_MS = 90;             // de quanto em quanto tempo aviso minha posição
const LIM = { x0: 3, x1: 97, y0: 4, y1: 92 };
const BALAO_MS = 5200;

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
await preaquecer(manifesto);

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
    virado: false, andando: false, quadro: 0, tQuadro: 0,
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
      if (p.tQuadro > 0.14) { p.tQuadro = 0; p.quadro ^= 1; p.sujo = true; }
    } else if (p.quadro !== 0) {
      p.quadro = 0; p.sujo = true;
    }

    if (p.sujo) {
      // Só considera pronto se todas as camadas entraram. Se alguma ainda
      // estava carregando, tenta de novo no próximo quadro.
      const completo = desenhar(p.ctx, p.avatar,
        { esc: PX, andando: p.quadro === 1, virado: p.virado });
      p.sujo = !completo;
    }

    if (p.balao && p.balaoAte && agora > p.balaoAte) {
      p.balao.style.display = "none";
      p.balaoAte = 0;
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
  const r = chao.getBoundingClientRect();
  alvo = {
    x: clamp(((e.clientX - r.left) / r.width) * 100, LIM.x0, LIM.x1),
    y: clamp(((r.bottom - e.clientY) / r.height) * 100, LIM.y0, LIM.y1),
  };
});

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
}

$("#enviar").onclick = enviarChat;
$("#dizer").addEventListener("keydown", (e) => { if (e.key === "Enter") enviarChat(); });

/* `saindo` avisa o laço de reconexão que a queda do socket foi de propósito
   — sem isso ele tentaria reconectar durante a navegação. */
function sairPara(destino) {
  saindo = true;
  location.href = destino;
}

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

function pintarLista() {
  const lista = $("#lista");
  lista.innerHTML = "";
  for (const p of gente.values()) {
    const div = document.createElement("div");
    const cv = document.createElement("canvas");
    cv.width = LARG; cv.height = ALT_CANVAS;
    desenhar(cv.getContext("2d"), p.avatar, { esc: 1, sombra: false });
    const nome = document.createElement("span");
    nome.textContent = p.nick + (p.uid === meuUid ? " (você)" : "");
    if (p.uid === meuUid) nome.style.fontWeight = "bold";
    div.append(cv, nome);
    lista.appendChild(div);
  }
  $("#contagem").textContent =
    gente.size === 1 ? "só você por aqui" : gente.size + " na sala";
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
      sistema(`você entrou em "${codigoReal}"`);
      pintarLista();
      break;
    }

    case "entrou":
      if (!gente.has(m.user.uid)) novaPessoa(m.user, false);
      sistema(`${m.user.nick} entrou`);
      pintarLista();
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

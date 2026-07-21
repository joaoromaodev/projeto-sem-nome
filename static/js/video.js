/* O player de vídeo da sala.
 *
 * Regra que organiza tudo aqui: **o servidor é a fonte da verdade**. Este
 * módulo nunca trata o próprio player como referência. Ele manda a intenção
 * ("dei play em tal ponto") e, quando o servidor responde, corrige a si
 * mesmo — inclusive quando a mudança foi ele quem pediu.
 *
 * As três armadilhas que este arquivo existe pra resolver:
 *
 *   1. Loop de eco. A dá play -> servidor avisa B -> o player de B dispara
 *      onStateChange -> B manda "play" pro servidor -> servidor avisa A ->
 *      infinito. Resolvido com uma janela de silêncio (`remotoAte`) em vez
 *      de um booleano: os eventos do YouTube chegam depois da chamada que
 *      os causou, então um flag ligado/desligado na hora não pega todos.
 *
 *   2. Deriva. Latência faz cada um ficar num ponto diferente. Correção em
 *      dois níveis — playbackRate pra desvio pequeno, seekTo só pro grande.
 *      É o playbackRate que separa "funciona" de "funciona bem": sem ele o
 *      vídeo fica dando pulinhos o tempo todo.
 *
 *   3. Autoplay bloqueado. Navegador não deixa tocar áudio sem interação do
 *      usuário. A tela de "clique pra entrar" não é enfeite, é requisito.
 */

/* Abaixo disso, deixa quieto: perseguir décimo de segundo faria o vídeo
   tremer sem ninguém perceber diferença. */
const IGNORA_S = 0.5;
/* Entre IGNORA_S e este valor, corrige acelerando ou freando de leve.
   Acima, não tem jeito suave: pula. */
const SUAVE_S = 2.0;
/* 5% pra cada lado. Mais que isso e a voz sai com o tom alterado. */
const RAPIDO = 1.05, LENTO = 0.95;
/* Quanto tempo ignorar os eventos do player depois de mexer nele por ordem
   da rede. Cobre a ida e volta do evento do iframe. */
const SILENCIO_MS = 900;

/* Os códigos do YouTube. Vale distinguir porque a saída é diferente pra
   cada um: "não existe" é erro de quem colou o link, mas 101/150 é
   restrição do dono do vídeo e acontece bastante com clipe musical — a
   pessoa precisa saber que não adianta tentar de novo, tem que abrir no
   YouTube ou escolher outro. */
export function explicarErro(codigo) {
  switch (codigo) {
    case 2:   return "esse link tá com algo errado";
    case 5:   return "esse vídeo não roda no player embutido";
    case 100: return "vídeo não encontrado — pode ter sido apagado ou ser privado";
    case 101:
    case 150: return "o dono desse vídeo não deixa tocar fora do YouTube — escolhe outro";
    default:  return "não consegui tocar esse vídeo";
  }
}

let player = null;
let pronto = false;
let liberado = false;      // o usuário já deu o gesto que o autoplay exige?
let remotoAte = 0;         // performance.now() até quando calar os eventos locais
let pendente = null;       // estado que chegou antes de o player existir
let ao = {};               // callbacks de fora
let idAtual = "";

/* Carrega a API do YouTube uma vez só. */
let carregando = null;
function carregarAPI() {
  if (carregando) return carregando;
  carregando = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve();
    window.onYouTubeIframeAPIReady = resolve;
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return carregando;
}

/** Executa algo no player marcando como "veio da rede", pra o onStateChange
 *  que isso vai disparar não virar mensagem de volta pro servidor. */
function remoto(fn) {
  remotoAte = performance.now() + SILENCIO_MS;
  try { fn(); } catch { /* player ainda engatinhando */ }
}

function veioDaRede() {
  return performance.now() < remotoAte;
}

export async function montarPlayer(alvo, callbacks) {
  ao = callbacks || {};
  await carregarAPI();

  return new Promise((resolve) => {
    player = new YT.Player(alvo, {
      width: "100%", height: "100%",
      playerVars: {
        // controls: 0 porque quem manda no vídeo é quem está com o
        // controle remoto da sala. Deixar os controles nativos do YouTube
        // daria a qualquer um um play/pause que passa por cima disso.
        controls: 0, rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1,
        // origin fecha o iframe pro nosso domínio
        origin: location.origin,
      },
      events: {
        onReady: () => {
          pronto = true;
          if (pendente) { aplicar(pendente); pendente = null; }
          resolve(player);
        },
        onStateChange: (e) => {
          // Mudança que nós mesmos causamos por ordem da rede não volta.
          if (veioDaRede()) return;
          const pos = seguro(() => player.getCurrentTime(), 0);

          if (e.data === YT.PlayerState.PLAYING) {
            ao.enviar && ao.enviar({ type: "video_play", pos });
          } else if (e.data === YT.PlayerState.PAUSED) {
            ao.enviar && ao.enviar({ type: "video_pause", pos });
          } else if (e.data === YT.PlayerState.ENDED) {
            ao.enviar && ao.enviar({ type: "video_fim" });
          } else if (e.data === YT.PlayerState.BUFFERING) {
            // Decisão de produto já tomada: a sala segue em frente e só
            // avisa. Esperar todos travaria a sala no mais lento.
            ao.carregando && ao.carregando();
          }
        },
        onError: (e) => {
          ao.erro && ao.erro(explicarErro(e && e.data));
        },
      },
    });
  });
}

function seguro(fn, padrao) {
  try { const v = fn(); return (v === undefined || v === null) ? padrao : v; }
  catch { return padrao; }
}

/** O usuário clicou: agora o navegador deixa tocar com som. */
export function liberarAudio() {
  liberado = true;
  if (pendente) { aplicar(pendente); pendente = null; }
}

export function estaLiberado() { return liberado; }

/**
 * Aplica o estado que o servidor afirmou.
 *
 * @param est  {id, tocando, pos}
 */
export function aplicar(est) {
  if (!est || !est.id) return;
  if (!pronto) { pendente = est; return; }

  // Sem o gesto do usuário, tocar seria bloqueado pelo navegador e o
  // player ficaria num estado meio-termo. Guarda e espera o clique.
  if (!liberado) { pendente = est; return; }

  if (est.id !== idAtual) {
    idAtual = est.id;
    remoto(() => player.loadVideoById(est.id, est.pos));
    if (!est.tocando) remoto(() => player.pauseVideo());
    return;
  }

  const estado = seguro(() => player.getPlayerState(), -1);
  const tocandoAqui = estado === YT.PlayerState.PLAYING ||
                      estado === YT.PlayerState.BUFFERING;

  if (!est.tocando) {
    // Pausado: posição é exata, sem correção suave que faça sentido.
    remoto(() => {
      player.pauseVideo();
      if (Math.abs(seguro(() => player.getCurrentTime(), 0) - est.pos) > 0.3) {
        player.seekTo(est.pos, true);
      }
    });
    return;
  }

  if (!tocandoAqui) remoto(() => player.playVideo());

  corrigirDeriva(est.pos);
}

/**
 * Decide o que fazer, dado onde estou e onde deveria estar.
 *
 * Função pura de propósito: é a regra mais delicada do projeto inteiro e
 * precisa ser testável sem depender de o iframe do YouTube responder.
 *
 * @returns {{acao: "nada"|"taxa"|"pular", taxa?: number, pos?: number, desvio: number}}
 */
export function decidirCorrecao(aqui, alvo) {
  const desvio = aqui - alvo;          // positivo = estou adiantado
  const abs = Math.abs(desvio);

  if (abs < IGNORA_S) return { acao: "nada", taxa: 1, desvio };
  if (abs < SUAVE_S) {
    // Acelera se ficou pra trás, freia se adiantou. Ninguém percebe 5%,
    // e o vídeo não pula.
    return { acao: "taxa", taxa: desvio > 0 ? LENTO : RAPIDO, desvio };
  }
  return { acao: "pular", taxa: 1, pos: alvo, desvio };
}

/** O coração da sincronia: onde eu estou contra onde eu deveria estar. */
function corrigirDeriva(alvo) {
  const aqui = seguro(() => player.getCurrentTime(), null);
  if (aqui === null) return null;

  const d = decidirCorrecao(aqui, alvo);
  remoto(() => {
    player.setPlaybackRate(d.taxa);
    if (d.acao === "pular") player.seekTo(d.pos, true);
  });
  return d;
}

/* ------------------------------------------------------------ comandos
   Usados por quem está com o controle remoto. Nenhum deles mexe no player
   direto: todos só devolvem o número que a sala precisa mandar pro
   servidor. Quem move o player é sempre a resposta do servidor — inclusive
   pra quem apertou o botão. É isso que garante que os quatro assistam o
   mesmo instante em vez de cada um obedecer ao próprio clique. */

export function posicaoAtual() {
  return seguro(() => player.getCurrentTime(), 0);
}

export function estaTocando() {
  const e = seguro(() => player.getPlayerState(), -1);
  return e === YT.PlayerState.PLAYING || e === YT.PlayerState.BUFFERING;
}

export function duracao() {
  return seguro(() => player.getDuration(), 0);
}

/** Posição depois de pular `delta` segundos, presa nos limites do vídeo. */
export function posicaoRelativa(delta) {
  const d = duracao();
  const alvo = posicaoAtual() + delta;
  if (alvo < 0) return 0;
  return d > 0 && alvo > d ? d : alvo;
}

/** Só pra teste e diagnóstico. */
export function diagnostico() {
  return {
    pronto, liberado, idAtual,
    pos: seguro(() => player && player.getCurrentTime(), null),
    estado: seguro(() => player && player.getPlayerState(), null),
    taxa: seguro(() => player && player.getPlaybackRate(), null),
  };
}

/* Exposto pra o teste automatizado conseguir exercitar a lógica de deriva
   sem depender do iframe do YouTube responder. */
export const _interno = { corrigirDeriva, IGNORA_S, SUAVE_S, RAPIDO, LENTO };

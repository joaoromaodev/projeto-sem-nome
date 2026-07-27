/* Compartilhamento de tela da sala, via WebRTC.
 *
 * A ideia em uma frase: **o vídeo vai direto de um navegador pro outro**. O
 * servidor não vê um frame — ele só carrega os bilhetes que os dois lados
 * trocam pra montar a conexão (oferta, resposta, candidatos de rede). Esses
 * bilhetes andam pelo mesmo WebSocket da sala, como `tela_sinal`.
 *
 * Papéis:
 *   - FONTE: quem clicou "compartilhar". Tem o stream e abre UMA conexão com
 *     cada espectador (uma malha em estrela saindo dela).
 *   - ESPECTADOR: quem assiste. Tem uma conexão só, com a fonte.
 *
 * Quem faz a oferta é sempre a fonte, porque é ela que tem as trilhas de
 * mídia pra anunciar. O espectador só avisa "quero" e espera a oferta.
 *
 * STUN só, sem TURN: o STUN público do Google resolve a maioria das redes
 * domésticas (descobre o IP público e fura o NAT). Em redes mais fechadas
 * (NAT simétrico dos dois lados) a conexão não fecha — aí precisaria de um
 * servidor TURN, que é a evolução natural se isso incomodar na prática.
 */

const ICE = [{ urls: "stun:stun.l.google.com:19302" }];

let enviar = null;    // manda mensagem pelo ws
let aoStream = null;  // mostra(stream) / limpa(null) o telão
let aoMudar = null;   // avisa o sala.js que o estado mudou (repintar botão)

let meuStream = null;    // se EU compartilho, o stream local (a tela capturada)
let fonteUid = "";       // uid de quem compartilha agora (eu ou outro), ou ""
let euCompartilho = false;

/* As conexões abertas. Se sou fonte, uma por espectador (chave = uid do
 * espectador). Se sou espectador, uma só (chave = uid da fonte). */
const conns = new Map();

export function montar({ envia, mostra, mudou }) {
  enviar = envia;
  aoStream = mostra;
  aoMudar = mudou || (() => {});
}

/* --------------------------------------------------------------- estado */

export function euSouFonte() { return euCompartilho; }
export function temTransmissao() { return !!fonteUid || euCompartilho; }

/* ------------------------------------------------------- conexão (comum) */

function novaConn(comUid) {
  const c = new RTCPeerConnection({ iceServers: ICE });
  // Cada candidato de rede que o navegador descobre vira um bilhete pro
  // outro lado. Sem trocar isso, os dois sabem a mídia mas não o caminho.
  c.onicecandidate = (e) => {
    if (e.candidate) {
      sinalizar(comUid, { t: "ice", c: e.candidate });
    }
  };
  c.onconnectionstatechange = () => {
    if (["failed", "closed", "disconnected"].includes(c.connectionState)) {
      const morta = conns.get(comUid);
      if (morta) { try { morta.close(); } catch { /* já fechou */ } }
      conns.delete(comUid);
    }
  };
  conns.set(comUid, c);
  return c;
}

function sinalizar(paraUid, dados) {
  enviar && enviar({ type: "tela_sinal", para: paraUid, dados });
}

function fecharTudo() {
  for (const c of conns.values()) { try { c.close(); } catch { /* idem */ } }
  conns.clear();
}

/* -------------------------------------------------------------- eu, fonte */

/** Começo a compartilhar. Pede a tela ao navegador (isto abre o seletor
 *  nativo "qual janela/aba?") e avisa a sala. Devolve o stream, ou lança se
 *  o usuário cancelar o seletor. */
export async function comecar() {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,   // aba com som: o Chrome captura se a pessoa marcar
  });
  meuStream = stream;
  euCompartilho = true;
  fonteUid = "";   // sou a fonte; não sou espectador de ninguém
  // Quando a pessoa aperta "parar de compartilhar" na barrinha do próprio
  // navegador, a trilha termina — e aí a gente encerra do nosso lado também.
  stream.getVideoTracks()[0].addEventListener("ended", () => parar());
  enviar && enviar({ type: "tela_iniciar" });
  aoStream && aoStream(stream);   // eu me vejo (preview local)
  aoMudar();
  return stream;
}

/** Paro de compartilhar. */
export function parar() {
  if (!euCompartilho) return;
  euCompartilho = false;
  if (meuStream) {
    meuStream.getTracks().forEach((t) => t.stop());
    meuStream = null;
  }
  fecharTudo();
  enviar && enviar({ type: "tela_parar" });
  aoStream && aoStream(null);
  aoMudar();
}

/* Um espectador pediu o stream: monto a conexão com ele e mando a oferta. */
async function atenderEspectador(espUid) {
  if (!euCompartilho || !meuStream) return;
  const c = novaConn(espUid);
  for (const t of meuStream.getTracks()) c.addTrack(t, meuStream);
  const oferta = await c.createOffer();
  await c.setLocalDescription(oferta);
  sinalizar(espUid, { t: "oferta", sdp: c.localDescription });
}

async function receberResposta(espUid, sdp) {
  const c = conns.get(espUid);
  if (c) { try { await c.setRemoteDescription(sdp); } catch { /* tarde */ } }
}

/* --------------------------------------------------------- eu, espectador */

/** A fonte fez a oferta: respondo e, quando a mídia chegar, mostro no telão. */
async function receberOferta(fonte, sdp) {
  fonteUid = fonte;
  const c = novaConn(fonte);
  c.ontrack = (e) => { aoStream && aoStream(e.streams[0]); };
  await c.setRemoteDescription(sdp);
  const resp = await c.createAnswer();
  await c.setLocalDescription(resp);
  sinalizar(fonte, { t: "resposta", sdp: c.localDescription });
}

async function receberIce(deUid, cand) {
  const c = conns.get(deUid);
  if (c) { try { await c.addIceCandidate(cand); } catch { /* ignora */ } }
}

/* --------------------------------------------- ganchos vindos do sala.js
   Chamados quando o WebSocket entrega as mensagens de tela. */

/** Alguém (`de`) começou a compartilhar. Peço o stream. Também é chamado ao
 *  ENTRAR numa sala que já tinha transmissão (pelo `bemvindo`). */
export function ligou(de) {
  if (!de || euCompartilho) return;   // se sou a fonte, não me aplica
  fonteUid = de;
  sinalizar(de, { t: "quero" });
  aoMudar();
}

/** A transmissão de `de` acabou (ele parou ou fechou a aba). */
export function desligou(de) {
  if (euCompartilho) return;
  if (de && de !== fonteUid) return;   // não era a que eu assistia
  fonteUid = "";
  fecharTudo();
  aoStream && aoStream(null);
  aoMudar();
}

/** Um bilhete de sinalização chegou de `de`. */
export async function sinal(de, dados) {
  switch (dados && dados.t) {
    case "quero":    return atenderEspectador(de);
    case "oferta":   return receberOferta(de, dados.sdp);
    case "resposta": return receberResposta(de, dados.sdp);
    case "ice":      return receberIce(de, dados.c);
  }
}

/** Chamado no `bemvindo`: se a sala já tinha alguém compartilhando, entro
 *  como espectador. */
export function aoEntrar(telaUid) {
  if (telaUid) ligou(telaUid);
}

/** Limpa tudo ao trocar de sala, sem mandar mensagem (a conexão vai fechar
 *  sozinha do outro lado quando o ws cair). */
export function zerar() {
  if (meuStream) { meuStream.getTracks().forEach((t) => t.stop()); meuStream = null; }
  fecharTudo();
  euCompartilho = false;
  fonteUid = "";
}

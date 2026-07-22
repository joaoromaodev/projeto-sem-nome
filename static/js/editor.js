/* Painel de montar o boneco. Duas abas:
 *
 *   Roupa        — escolhe as peças e as cores
 *   Guarda-roupa — salva combinações e veste de novo com um clique
 *
 * Fica num módulo porque é usado na tela inicial e dentro da sala.
 */

import {
  desenhar, normalizar, avatarAleatorio, pecasDe,
  LARG, ALT_CANVAS, SUGESTOES, COM_PECA, BASES,
} from "./avatar.js";
import { api } from "./api.js";

// nome amigável de cada personagem base
const NOME_BASE = { masc: "Masculino", fem: "Feminino" };

const ROTULOS = {
  pele: "Pele",
  cabelo: "Cabelo",
  torso: "Camisa",
  pernas: "Calça",
  sapatos: "Sapato",
};

/* Ordem na tela: de cima do corpo pra baixo, que é como se pensa em roupa. */
const ORDEM = ["cabelo", "torso", "pernas", "sapatos"];

/**
 * @param raiz     onde montar
 * @param perfil   {nick, avatar} — mexido no lugar
 * @param aoMudar  chamado a cada alteração
 * @param opts     { esc, comNick }
 */
export function montarPainel(raiz, perfil, aoMudar, opts = {}) {
  const esc = opts.esc ?? 3;
  const comNick = opts.comNick ?? false;

  raiz.innerHTML = `
    <div class="ed-abas">
      <button type="button" class="ed-aba ativa" data-aba="roupa">Roupa</button>
      <button type="button" class="ed-aba" data-aba="armario">Guarda-roupa</button>
    </div>

    <div class="ed-previa">
      <div class="ed-palco afundado"><canvas class="ed-cv"></canvas></div>
    </div>

    ${comNick ? `
    <div class="ed-campo">
      <label>Apelido</label>
      <input type="text" class="ed-nick" maxlength="16" autocomplete="off">
    </div>` : ""}

    <div class="ed-painel" data-painel="roupa">
      <div class="ed-base"></div>
      <div class="ed-roupa">
        <div class="ed-pecas"></div>
        <button type="button" class="ed-sortear">Sortear tudo</button>
      </div>
    </div>

    <div class="ed-painel esconde" data-painel="armario">
      <div class="ed-salvar">
        <input type="text" class="ed-nome-look" maxlength="24" placeholder="nome do look">
        <button type="button" class="ed-guardar">Guardar o atual</button>
      </div>
      <p class="ed-recado dim"></p>
      <div class="ed-armario"></div>
    </div>`;

  /* ---------------------------------------------------- prévia */

  const cv = raiz.querySelector(".ed-cv");
  cv.width = LARG * esc;
  cv.height = ALT_CANVAS * esc;
  cv.style.imageRendering = "pixelated";
  const ctx = cv.getContext("2d");

  let passo = false;
  function repintar() {
    // paper-doll usa `passo` (pulo); base mostra a pose parada de frente
    desenhar(ctx, perfil.avatar, { esc, passo, andando: false, dir: "south" });
    const av = normalizar(perfil.avatar);

    // reflete o personagem escolhido e esconde as roupas se for base nova
    raiz.querySelectorAll(".ed-base-bt").forEach((b) =>
      b.classList.toggle("ativa", b.dataset.base === av.base));
    const roupa = raiz.querySelector(".ed-roupa");
    if (roupa) roupa.classList.toggle("esconde", !!av.base);

    for (const c of ORDEM) {
      const alvo = raiz.querySelector(`[data-peca-nome="${c}"]`);
      if (alvo) alvo.textContent = av[c] || "nenhum";
    }
    for (const c of Object.keys(ROTULOS)) {
      const atual = c === "pele" ? av.pele : av[`${c}_cor`];
      const inp = raiz.querySelector(`[data-cor="${c}"]`);
      if (inp && inp.value !== atual) inp.value = atual;
      raiz.querySelectorAll(`[data-cor-de="${c}"]`).forEach((sw) =>
        sw.classList.toggle("ativo", sw.dataset.valor === atual));
    }
  }
  // O boneco fica pulando na prévia — mostra que ele é vivo, e deixa ver
  // como a roupa se comporta em movimento.
  const timer = setInterval(() => { passo = !passo; repintar(); }, 400);

  function mudou() { repintar(); aoMudar(); }

  /* ---------------------------------------------------- abas */

  let aba = "roupa";
  raiz.querySelector(".ed-abas").addEventListener("click", (e) => {
    const b = e.target.closest(".ed-aba");
    if (!b) return;
    aba = b.dataset.aba;
    raiz.querySelectorAll(".ed-aba").forEach((x) =>
      x.classList.toggle("ativa", x.dataset.aba === aba));
    raiz.querySelectorAll(".ed-painel").forEach((x) =>
      x.classList.toggle("esconde", x.dataset.painel !== aba));
    if (aba === "armario") carregarArmario();
  });

  /* ---------------------------------------------------- peças e cores */

  function blocoCor(chave) {
    return `
      <div class="ed-rot-cor">
        <span>${ROTULOS[chave]}</span>
        <input type="color" data-cor="${chave}">
      </div>
      <div class="ed-swatches">
        ${(SUGESTOES[chave] || []).map((c) =>
          `<button type="button" class="ed-sw" data-cor-de="${chave}"
                   data-valor="${c}" style="background:${c}"
                   title="${c}" aria-label="${ROTULOS[chave]} ${c}"></button>`).join("")}
      </div>`;
  }

  const caixaPecas = raiz.querySelector(".ed-pecas");
  caixaPecas.innerHTML = `
    <div class="ed-linha-cor">${blocoCor("pele")}</div>
    ` + ORDEM.map((c) => `
    <div class="ed-linha-cor">
      ${COM_PECA.includes(c) ? `
        <div class="seletor">
          <span class="rot">${ROTULOS[c]}</span>
          <button type="button" class="ed-peca" data-p="${c}" data-d="-1"
                  aria-label="${ROTULOS[c]} anterior">&lt;</button>
          <span class="val" data-peca-nome="${c}"></span>
          <button type="button" class="ed-peca" data-p="${c}" data-d="1"
                  aria-label="próximo ${ROTULOS[c]}">&gt;</button>
        </div>` : ""}
      ${blocoCor(c)}
    </div>`).join("");

  caixaPecas.addEventListener("click", (e) => {
    const peca = e.target.closest(".ed-peca");
    if (peca) {
      const c = peca.dataset.p;
      const lista = pecasDe(c);
      if (!lista.length) return;
      const atual = lista.indexOf(normalizar(perfil.avatar)[c]);
      const i = (atual + (+peca.dataset.d) + lista.length) % lista.length;
      perfil.avatar[c] = lista[i];
      return mudou();
    }
    const sw = e.target.closest(".ed-sw");
    if (sw) {
      const c = sw.dataset.corDe;
      perfil.avatar[c === "pele" ? "pele" : `${c}_cor`] = sw.dataset.valor;
      return mudou();
    }
  });

  caixaPecas.addEventListener("input", (e) => {
    const c = e.target.dataset.cor;
    if (!c) return;
    perfil.avatar[c === "pele" ? "pele" : `${c}_cor`] = e.target.value;
    mudou();
  });

  /* ---------------------------------------------------- personagem (base) */

  const caixaBase = raiz.querySelector(".ed-base");
  caixaBase.innerHTML = `
    <span class="ed-base-rot">Personagem</span>
    <button type="button" class="ed-base-bt" data-base="">Clássico</button>
    ${BASES.map((b) =>
      `<button type="button" class="ed-base-bt" data-base="${b}">${NOME_BASE[b] || b}</button>`).join("")}`;

  caixaBase.addEventListener("click", (e) => {
    const b = e.target.closest(".ed-base-bt");
    if (!b) return;
    perfil.avatar.base = b.dataset.base;   // "" = paper-doll clássico
    mudou();
  });

  raiz.querySelector(".ed-sortear").addEventListener("click", () => {
    Object.assign(perfil.avatar, avatarAleatorio());
    mudou();
  });

  /* ---------------------------------------------------- guarda-roupa */

  const armario = raiz.querySelector(".ed-armario");
  const recadoEl = raiz.querySelector(".ed-recado");
  let looks = null;

  function recado(txt, ruim = true) {
    recadoEl.textContent = txt;
    recadoEl.classList.toggle("ruim", ruim);
    if (txt) setTimeout(() => { recadoEl.textContent = ""; }, 3000);
  }

  async function carregarArmario(forcar = false) {
    if (looks && !forcar) return pintarArmario();
    armario.innerHTML = '<p class="dim">carregando…</p>';
    try {
      looks = (await api.verGuardaRoupa()).looks;
      pintarArmario();
    } catch (e) {
      armario.innerHTML = "";
      recado(e.message);
    }
  }

  function pintarArmario() {
    armario.innerHTML = "";
    if (!looks.length) {
      armario.innerHTML =
        '<p class="dim ed-vazio">Nada guardado ainda.<br>' +
        'Monte um boneco e clique em "Guardar o atual".</p>';
      return;
    }

    for (const look of looks) {
      const item = document.createElement("div");
      item.className = "ed-look";

      const mini = document.createElement("canvas");
      mini.width = LARG;
      mini.height = ALT_CANVAS;
      mini.style.imageRendering = "pixelated";
      desenhar(mini.getContext("2d"), look.avatar, { esc: 1, sombra: false });

      const nome = document.createElement("span");
      nome.className = "ed-look-nome";
      nome.textContent = look.nome;

      const vestir = document.createElement("button");
      vestir.type = "button";
      vestir.className = "ed-vestir";
      vestir.title = "usar este look";
      vestir.append(mini, nome);
      vestir.addEventListener("click", () => {
        Object.assign(perfil.avatar, normalizar(look.avatar));
        mudou();
      });

      const apagar = document.createElement("button");
      apagar.type = "button";
      apagar.className = "ed-apagar";
      apagar.textContent = "✕";
      apagar.title = "apagar do guarda-roupa";
      apagar.addEventListener("click", async () => {
        try {
          await api.apagarLook(look.id);
          looks = looks.filter((l) => l.id !== look.id);
          pintarArmario();
        } catch (e) { recado(e.message); }
      });

      item.append(vestir, apagar);
      armario.appendChild(item);
    }
  }

  raiz.querySelector(".ed-guardar").addEventListener("click", async () => {
    const campo = raiz.querySelector(".ed-nome-look");
    try {
      const r = await api.guardarLook(campo.value.trim(), perfil.avatar);
      looks = looks || [];
      looks.push({
        id: r.id,
        nome: campo.value.trim() || "sem nome",
        // cópia: senão o look guardado mudaria junto com o boneco atual
        avatar: JSON.parse(JSON.stringify(normalizar(perfil.avatar))),
      });
      campo.value = "";
      pintarArmario();
      recado("guardado!", false);
    } catch (e) { recado(e.message); }
  });

  /* ---------------------------------------------------- nick */

  const nickEl = raiz.querySelector(".ed-nick");
  if (nickEl) {
    nickEl.value = perfil.nick;
    nickEl.addEventListener("input", () => {
      perfil.nick = nickEl.value;
      aoMudar();
    });
  }

  repintar();
  return { repintar, parar: () => clearInterval(timer), nickEl };
}

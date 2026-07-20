/* Painel de montar o boneco. Duas abas:
 *
 *   Peças  — cabelo + cores livres. Caminho rápido.
 *   Pixel  — desenha o seu, partindo do boneco que já está montado.
 *
 * Fica num módulo porque é usado na tela inicial e dentro da sala.
 */

import {
  desenhar, grade, daGrade, normalizar, avatarAleatorio,
  LARG, ALT, ALT_CANVAS, PALETA_MAX, SUGESTOES,
  CABELO_NOMES, CORPO_NOMES, BAIXO_NOMES, PRESETS,
} from "./avatar.js";
import { api } from "./api.js";

const PECAS = [
  ["skin", "Pele"],
  ["hair_c", "Cor do cabelo"],
  ["shirt", "Camisa"],
  ["pants", "Calça"],
];

/**
 * @param raiz     onde montar
 * @param perfil   {nick, avatar} — mexido no lugar
 * @param aoMudar  chamado a cada alteração
 * @param opts     { px, comNick }
 */
export function montarPainel(raiz, perfil, aoMudar, opts = {}) {
  const px = opts.px ?? 8;
  const comNick = opts.comNick ?? false;

  raiz.innerHTML = `
    <div class="ed-abas">
      <button type="button" class="ed-aba ativa" data-aba="pecas">Peças</button>
      <button type="button" class="ed-aba" data-aba="pixel">Pixel</button>
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

    <!-- ---------------- aba peças ---------------- -->
    <div class="ed-painel" data-painel="pecas">
      <div class="ed-presets">
        <span class="dim">começar de:</span>
        <button type="button" class="ed-preset" data-preset="masculino">masculino</button>
        <button type="button" class="ed-preset" data-preset="feminino">feminino</button>
      </div>

      ${["corpo", "baixo", "hair"].map((k) => `
        <div class="seletor">
          <span class="rot">${{ corpo: "Corpo", baixo: "Roupa", hair: "Cabelo" }[k]}</span>
          <button type="button" class="ed-forma" data-p="${k}" data-d="-1">&lt;</button>
          <span class="val" data-forma="${k}"></span>
          <button type="button" class="ed-forma" data-p="${k}" data-d="1">&gt;</button>
        </div>`).join("")}

      <div class="ed-cores"></div>
      <button type="button" class="ed-sortear">Sortear tudo</button>
    </div>

    <!-- ---------------- aba pixel ---------------- -->
    <div class="ed-painel esconde" data-painel="pixel">
      <div class="ed-tela-wrap afundado"><canvas class="ed-tela"></canvas></div>

      <div class="ed-ferramentas">
        <label class="ed-cor-atual">
          <span class="ed-amostra"></span>
          <input type="color" class="ed-pincel" value="#c02020">
          <span>cor</span>
        </label>
        <button type="button" class="ed-borracha" title="apagar pixel">Borracha</button>
      </div>

      <div class="ed-usadas"></div>

      <div class="ed-acoes">
        <button type="button" class="ed-desfazer" disabled>Desfazer</button>
        <button type="button" class="ed-reiniciar">Recomeçar do padrão</button>
      </div>
      <p class="ed-aviso dim"></p>
    </div>

    <!-- ---------------- aba guarda-roupa ---------------- -->
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
  cv.width = LARG * px;
  cv.height = ALT_CANVAS * px;
  cv.style.imageRendering = "pixelated";
  const ctx = cv.getContext("2d");

  const NOMES = { corpo: CORPO_NOMES, baixo: BAIXO_NOMES, hair: CABELO_NOMES };

  let passo = false;
  function repintar() {
    desenhar(ctx, perfil.avatar, { px, andando: passo });
    const av = normalizar(perfil.avatar);
    for (const k of ["corpo", "baixo", "hair"]) {
      raiz.querySelector(`[data-forma="${k}"]`).textContent = NOMES[k][av[k]];
    }
    pintarCores();
    if (aba === "pixel") pintarTela();
  }
  const timer = setInterval(() => { passo = !passo; repintar(); }, 380);

  function mudou() { repintar(); aoMudar(); }

  /* ---------------------------------------------------- abas */

  let aba = "pecas";
  raiz.querySelector(".ed-abas").addEventListener("click", (e) => {
    const b = e.target.closest(".ed-aba");
    if (!b) return;
    aba = b.dataset.aba;
    raiz.querySelectorAll(".ed-aba").forEach((x) =>
      x.classList.toggle("ativa", x.dataset.aba === aba));
    raiz.querySelectorAll(".ed-painel").forEach((x) =>
      x.classList.toggle("esconde", x.dataset.painel !== aba));
    if (aba === "pixel") entrarNoPixel();
    if (aba === "armario") carregarArmario();
    repintar();
  });

  /* ---------------------------------------------------- aba peças */

  const cores = raiz.querySelector(".ed-cores");
  cores.innerHTML = PECAS.map(([k, rot]) => `
    <div class="ed-linha-cor">
      <div class="ed-rot-cor">
        <span>${rot}</span>
        <input type="color" data-cor="${k}">
      </div>
      <div class="ed-swatches">
        ${(SUGESTOES[k] || []).map((c) =>
          `<button type="button" class="ed-sw" data-cor-de="${k}" data-valor="${c}"
                   style="background:${c}" title="${c}"></button>`).join("")}
      </div>
    </div>`).join("");

  function pintarCores() {
    const av = normalizar(perfil.avatar);
    PECAS.forEach(([k]) => {
      const inp = cores.querySelector(`[data-cor="${k}"]`);
      if (inp && inp.value !== av[k]) inp.value = av[k];
      cores.querySelectorAll(`[data-cor-de="${k}"]`).forEach((sw) =>
        sw.classList.toggle("ativo", sw.dataset.valor === av[k]));
    });
  }

  cores.addEventListener("input", (e) => {
    const k = e.target.dataset.cor;
    if (!k) return;
    perfil.avatar[k] = e.target.value;
    perfil.avatar.modo = "pecas";   // mexeu nas peças, volta pro boneco padrão
    mudou();
  });

  cores.addEventListener("click", (e) => {
    const sw = e.target.closest(".ed-sw");
    if (!sw) return;
    perfil.avatar[sw.dataset.corDe] = sw.dataset.valor;
    perfil.avatar.modo = "pecas";
    mudou();
  });

  raiz.querySelector(".ed-painel[data-painel=pecas]").addEventListener("click", (e) => {
    const forma = e.target.closest(".ed-forma");
    if (forma) {
      const k = forma.dataset.p;
      const n = NOMES[k].length;
      perfil.avatar[k] = (normalizar(perfil.avatar)[k] + +forma.dataset.d + n) % n;
      perfil.avatar.modo = "pecas";
      return mudou();
    }

    const preset = e.target.closest(".ed-preset");
    if (preset) {
      // só um ponto de partida: mexe na forma e mantém as cores de quem já
      // escolheu as suas
      Object.assign(perfil.avatar, PRESETS[preset.dataset.preset]);
      perfil.avatar.modo = "pecas";
      return mudou();
    }
  });

  raiz.querySelector(".ed-sortear").addEventListener("click", () => {
    Object.assign(perfil.avatar, avatarAleatorio());
    mudou();
  });

  /* ---------------------------------------------------- aba pixel */

  const tela = raiz.querySelector(".ed-tela");
  const TPX = 16;                       // pixelão grande, pra dar pra clicar
  tela.width = LARG * TPX;
  tela.height = ALT * TPX;
  const tctx = tela.getContext("2d");

  let g = null;                          // grade de cores em edição
  const historico = [];
  let pintando = false;
  let borracha = false;

  function entrarNoPixel() {
    if (g) return;
    // parte do boneco que já está montado — o "template padrão"
    g = grade(perfil.avatar, false);
  }

  function pintarTela() {
    if (!g) return;
    tctx.clearRect(0, 0, tela.width, tela.height);

    // xadrez do fundo, pra enxergar o que é transparente
    for (let y = 0; y < ALT; y++) {
      for (let x = 0; x < LARG; x++) {
        tctx.fillStyle = (x + y) % 2 ? "#d8d8d8" : "#eeeeee";
        tctx.fillRect(x * TPX, y * TPX, TPX, TPX);
      }
    }
    for (let y = 0; y < ALT; y++) {
      for (let x = 0; x < LARG; x++) {
        if (!g[y][x]) continue;
        tctx.fillStyle = g[y][x];
        tctx.fillRect(x * TPX, y * TPX, TPX, TPX);
      }
    }
    tctx.strokeStyle = "rgba(0,0,0,.18)";
    tctx.lineWidth = 1;
    for (let x = 0; x <= LARG; x++) {
      tctx.beginPath(); tctx.moveTo(x * TPX + .5, 0); tctx.lineTo(x * TPX + .5, tela.height); tctx.stroke();
    }
    for (let y = 0; y <= ALT; y++) {
      tctx.beginPath(); tctx.moveTo(0, y * TPX + .5); tctx.lineTo(tela.width, y * TPX + .5); tctx.stroke();
    }

    pintarUsadas();
  }

  function pintarUsadas() {
    const usadas = [...new Set(g.flat().filter(Boolean))];
    const alvo = raiz.querySelector(".ed-usadas");
    const aviso = raiz.querySelector(".ed-aviso");

    alvo.innerHTML = `<span class="dim">cores no desenho (${usadas.length}/${PALETA_MAX}):</span>` +
      usadas.map((c) => `<button type="button" class="ed-sw" data-pegar="${c}"
                                 style="background:${c}" title="${c}"></button>`).join("");

    aviso.textContent = usadas.length >= PALETA_MAX
      ? `No limite de ${PALETA_MAX} cores. Pra usar uma nova, apague alguma antes.`
      : "";
  }

  raiz.querySelector(".ed-usadas").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pegar]");
    if (!b) return;
    raiz.querySelector(".ed-pincel").value = b.dataset.pegar;
    borracha = false;
    atualizarFerramentas();
  });

  function atualizarFerramentas() {
    raiz.querySelector(".ed-borracha").classList.toggle("ativo", borracha);
    raiz.querySelector(".ed-amostra").style.background =
      borracha ? "transparent" : raiz.querySelector(".ed-pincel").value;
    raiz.querySelector(".ed-amostra").classList.toggle("vazia", borracha);
  }

  raiz.querySelector(".ed-borracha").addEventListener("click", () => {
    borracha = !borracha;
    atualizarFerramentas();
  });
  raiz.querySelector(".ed-pincel").addEventListener("input", () => {
    borracha = false;
    atualizarFerramentas();
  });

  function pixelDoEvento(e) {
    const r = tela.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * LARG);
    const y = Math.floor(((e.clientY - r.top) / r.height) * ALT);
    if (x < 0 || y < 0 || x >= LARG || y >= ALT) return null;
    return { x, y };
  }

  function aplicar(p) {
    const nova = borracha ? null : raiz.querySelector(".ed-pincel").value.toLowerCase();
    if (g[p.y][p.x] === nova) return;

    // Se já estamos no limite de cores, só deixa usar uma que já existe.
    if (nova) {
      const usadas = new Set(g.flat().filter(Boolean));
      if (!usadas.has(nova) && usadas.size >= PALETA_MAX) return;
    }

    g[p.y][p.x] = nova;
    commit();
  }

  function commit() {
    const { arte, paleta } = daGrade(g);
    perfil.avatar.modo = "desenho";
    perfil.avatar.arte = arte;
    perfil.avatar.paleta = paleta;
    mudou();
  }

  function snapshot() {
    historico.push(g.map((l) => l.slice()));
    if (historico.length > 40) historico.shift();
    raiz.querySelector(".ed-desfazer").disabled = false;
  }

  tela.addEventListener("pointerdown", (e) => {
    entrarNoPixel();
    const p = pixelDoEvento(e);
    if (!p) return;
    snapshot();
    pintando = true;
    aplicar(p);
    // Depois de pintar, nunca antes: se a captura falhar, o traço já saiu.
    try { tela.setPointerCapture(e.pointerId); } catch { /* segue sem captura */ }
  });
  tela.addEventListener("pointermove", (e) => {
    if (!pintando) return;
    const p = pixelDoEvento(e);
    if (p) aplicar(p);
  });
  const soltar = () => { pintando = false; };
  tela.addEventListener("pointerup", soltar);
  tela.addEventListener("pointercancel", soltar);

  raiz.querySelector(".ed-desfazer").addEventListener("click", () => {
    const ant = historico.pop();
    if (!ant) return;
    g = ant;
    raiz.querySelector(".ed-desfazer").disabled = historico.length === 0;
    commit();
  });

  raiz.querySelector(".ed-reiniciar").addEventListener("click", () => {
    snapshot();
    perfil.avatar.modo = "pecas";
    perfil.avatar.arte = null;
    perfil.avatar.paleta = null;
    g = grade(perfil.avatar, false);
    commit();
  });

  /* ---------------------------------------------------- guarda-roupa */

  const armario = raiz.querySelector(".ed-armario");
  const recadoEl = raiz.querySelector(".ed-recado");
  let looks = null;   // null = ainda não buscou

  function recado(txt, ruim = true) {
    recadoEl.textContent = txt;
    recadoEl.classList.toggle("ruim", ruim);
    if (txt) setTimeout(() => { recadoEl.textContent = ""; }, 3000);
  }

  async function carregarArmario(forcar = false) {
    if (looks && !forcar) return pintarArmario();
    armario.innerHTML = '<p class="dim">carregando…</p>';
    try {
      const r = await api.verGuardaRoupa();
      looks = r.looks;
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

      const cv = document.createElement("canvas");
      const p = 3;
      cv.width = LARG * p;
      cv.height = ALT_CANVAS * p;
      cv.style.imageRendering = "pixelated";
      desenhar(cv.getContext("2d"), look.avatar, { px: p });

      const nome = document.createElement("span");
      nome.className = "ed-look-nome";
      nome.textContent = look.nome;

      const vestir = document.createElement("button");
      vestir.type = "button";
      vestir.className = "ed-vestir";
      vestir.title = "usar este look";
      vestir.append(cv, nome);
      vestir.addEventListener("click", () => {
        Object.assign(perfil.avatar, normalizar(look.avatar));
        g = null;              // o editor de pixel recarrega a partir do novo
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
        } catch (e) {
          recado(e.message);
        }
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
        // cópia: senão o look guardado muda junto quando você mexer no boneco
        avatar: JSON.parse(JSON.stringify(normalizar(perfil.avatar))),
      });
      campo.value = "";
      pintarArmario();
      recado("guardado!", false);
    } catch (e) {
      recado(e.message);
    }
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

  /* ---------------------------------------------------- pronto */

  atualizarFerramentas();
  repintar();

  return {
    repintar() { g = null; repintar(); },   // recarrega a tela do zero
    parar: () => clearInterval(timer),
    nickEl,
  };
}

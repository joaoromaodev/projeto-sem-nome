/* Conversa com o servidor.
 *
 * Substituiu o antigo perfil.js: o perfil não mora mais no navegador, mora
 * na conta. Quem diz quem você é é o cookie de sessão, que o JS daqui nem
 * consegue ler (httponly) — é de propósito.
 */

async function pedir(metodo, rota, corpo) {
  const r = await fetch(rota, {
    method: metodo,
    headers: corpo ? { "Content-Type": "application/json" } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  let dados = null;
  try { dados = await r.json(); } catch { /* resposta sem corpo */ }

  if (!r.ok) {
    const e = new Error((dados && dados.detail) || "deu ruim, tenta de novo");
    e.status = r.status;
    throw e;
  }
  return dados;
}

export const api = {
  cadastrar: (nick, senha, avatar) =>
    pedir("POST", "/api/cadastrar", { nick, senha, avatar }),
  entrar: (nick, senha) => pedir("POST", "/api/entrar", { nick, senha }),
  sair: () => pedir("POST", "/api/sair"),
  eu: () => pedir("GET", "/api/eu"),
  salvarAvatar: (avatar) => pedir("PUT", "/api/avatar", { avatar }),
  trocarNick: (nick) => pedir("POST", "/api/nick", { nick }),
  trocarSenha: (atual, nova) => pedir("POST", "/api/senha", { atual, nova }),

  // catálogo de peças; o servidor monta lendo a pasta static/sprites/
  pecas: () => pedir("GET", "/api/pecas"),

  // salas com gente agora, o lobby na frente
  salas: () => pedir("GET", "/api/salas"),

  // as salas que você frequenta — vêm do banco, então aparecem mesmo
  // vazias e mesmo depois de o servidor ter reiniciado
  minhasSalas: () => pedir("GET", "/api/minhas-salas"),

  verGuardaRoupa: () => pedir("GET", "/api/guarda-roupa"),
  guardarLook: (nome, avatar) => pedir("POST", "/api/guarda-roupa", { nome, avatar }),
  apagarLook: (id) => pedir("DELETE", `/api/guarda-roupa/${id}`),
};

/** Espera o usuário parar de mexer antes de gravar. Sem isso, cada clique
 *  numa setinha de cor viraria uma ida ao servidor. */
export function adiar(fn, ms = 400) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

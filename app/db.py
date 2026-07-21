"""Banco (SQLite) e tudo que envolve senha.

Duas regras que não se negociam aqui:

1. Senha nunca é guardada, nem em texto nem em hash simples. Vai por scrypt,
   que é lento de propósito: se o arquivo do banco vazar, quebrar as senhas
   por força bruta fica caro.
2. Comparação de segredo é sempre por `hmac.compare_digest`. Comparar com
   `==` vaza informação pelo tempo que a comparação demora.
"""

import hmac
import json
import os
import secrets
import sqlite3
import time
from hashlib import scrypt
from pathlib import Path
from typing import Optional

# Onde fica o banco. Em hospedagem, o disco que sobrevive a um redeploy
# costuma ser um volume montado noutro caminho — por isso vem de variável
# de ambiente. Sem ela, cai na pasta do projeto, que é o caso local.
DB = Path(os.environ.get("DB_PATH") or
          Path(__file__).resolve().parent.parent / "dados.sqlite3")

# Custo do scrypt. n=16384 leva uns 50-100ms por login numa máquina comum:
# imperceptível pra quem entra, caro pra quem tenta adivinhar.
N, R, P, DKLEN = 16384, 8, 1, 32

SENHA_MIN = 6
SESSAO_DIAS = 60

ESQUEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
    id         INTEGER PRIMARY KEY,
    nick       TEXT NOT NULL,
    nick_busca TEXT NOT NULL UNIQUE,   -- nick minúsculo, pra não ter dois "Duda"
    salt       BLOB NOT NULL,
    senha      BLOB NOT NULL,
    avatar     TEXT NOT NULL,           -- JSON
    criado_em  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sessoes (
    token     TEXT PRIMARY KEY,
    usuario   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_sessoes_usuario ON sessoes(usuario);

CREATE TABLE IF NOT EXISTS guarda_roupa (
    id        INTEGER PRIMARY KEY,
    usuario   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome      TEXT NOT NULL,
    avatar    TEXT NOT NULL,           -- JSON
    criado_em REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_guarda_usuario ON guarda_roupa(usuario);

-- A sala deixou de ser só um dict em memória. O que mora aqui é o que
-- precisa sobreviver ao restart: quem é o dono, quanto já tocou ali e
-- desde quando existe. Quem está dentro *agora* continua em memória --
-- presença não é passado, e guardá-la só criaria fantasma depois de um
-- crash.
CREATE TABLE IF NOT EXISTS salas (
    code            TEXT PRIMARY KEY,
    dono            INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    criada_em       REAL NOT NULL,
    vista_em        REAL NOT NULL,
    musicas_ouvidas INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sala_historico (
    id     INTEGER PRIMARY KEY,
    code   TEXT NOT NULL REFERENCES salas(code) ON DELETE CASCADE,
    video  TEXT NOT NULL,
    titulo TEXT NOT NULL DEFAULT '',
    por    TEXT NOT NULL DEFAULT '',
    quando REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_hist_sala ON sala_historico(code, quando DESC);

-- Quem frequenta a sala. É daqui que sai "suas salas" no lobby e a lista
-- de membros com o avatar apagadinho de quem está offline.
CREATE TABLE IF NOT EXISTS sala_membros (
    code     TEXT NOT NULL REFERENCES salas(code) ON DELETE CASCADE,
    usuario  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    visitas  INTEGER NOT NULL DEFAULT 0,
    vista_em REAL NOT NULL,
    PRIMARY KEY (code, usuario)
);

CREATE INDEX IF NOT EXISTS ix_membros_usuario ON sala_membros(usuario, vista_em DESC);
"""


def conectar() -> sqlite3.Connection:
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    return c


def iniciar() -> None:
    DB.parent.mkdir(parents=True, exist_ok=True)
    with conectar() as c:
        c.executescript(ESQUEMA)


# ------------------------------------------------------------------ senha

def _hash(senha: str, salt: bytes) -> bytes:
    return scrypt(senha.encode("utf-8"), salt=salt, n=N, r=R, p=P, dklen=DKLEN)


def _confere(senha: str, salt: bytes, esperado: bytes) -> bool:
    return hmac.compare_digest(_hash(senha, salt), esperado)


# ------------------------------------------------------------------ contas

class ErroConta(Exception):
    """Mensagem que pode ser mostrada pro usuário."""


def criar_usuario(nick: str, senha: str, avatar: dict) -> int:
    if len(senha) < SENHA_MIN:
        raise ErroConta(f"a senha precisa de pelo menos {SENHA_MIN} caracteres")

    salt = secrets.token_bytes(16)
    with conectar() as c:
        try:
            cur = c.execute(
                "INSERT INTO usuarios (nick, nick_busca, salt, senha, avatar, criado_em)"
                " VALUES (?,?,?,?,?,?)",
                (nick, nick.lower(), salt, _hash(senha, salt),
                 json.dumps(avatar), time.time()),
            )
        except sqlite3.IntegrityError:
            raise ErroConta("esse apelido já está em uso")
        return cur.lastrowid


def autenticar(nick: str, senha: str) -> Optional[dict]:
    """Devolve o usuário, ou None. Não diz se o erro foi o nick ou a senha —
    isso contaria a um curioso quais apelidos existem."""
    with conectar() as c:
        u = c.execute(
            "SELECT * FROM usuarios WHERE nick_busca = ?", (nick.lower(),)
        ).fetchone()

    if u is None:
        # Gasta o mesmo tempo de um login real, senão dá pra descobrir quais
        # apelidos existem só cronometrando a resposta.
        _hash(senha, b"x" * 16)
        return None

    if not _confere(senha, u["salt"], u["senha"]):
        return None

    return dict(u)


def buscar_usuario(uid: int) -> Optional[dict]:
    with conectar() as c:
        u = c.execute("SELECT * FROM usuarios WHERE id = ?", (uid,)).fetchone()
    return dict(u) if u else None


def salvar_avatar(uid: int, avatar: dict) -> None:
    with conectar() as c:
        c.execute("UPDATE usuarios SET avatar = ? WHERE id = ?",
                  (json.dumps(avatar), uid))


def trocar_nick(uid: int, nick: str) -> None:
    with conectar() as c:
        try:
            c.execute("UPDATE usuarios SET nick = ?, nick_busca = ? WHERE id = ?",
                      (nick, nick.lower(), uid))
        except sqlite3.IntegrityError:
            raise ErroConta("esse apelido já está em uso")


def trocar_senha(uid: int, atual: str, nova: str) -> None:
    u = buscar_usuario(uid)
    if not u or not _confere(atual, u["salt"], u["senha"]):
        raise ErroConta("senha atual incorreta")
    if len(nova) < SENHA_MIN:
        raise ErroConta(f"a senha precisa de pelo menos {SENHA_MIN} caracteres")

    salt = secrets.token_bytes(16)
    with conectar() as c:
        c.execute("UPDATE usuarios SET salt = ?, senha = ? WHERE id = ?",
                  (salt, _hash(nova, salt), uid))
        # trocar senha derruba as outras sessões
        c.execute("DELETE FROM sessoes WHERE usuario = ?", (uid,))


# ------------------------------------------------------------------ sessões

def abrir_sessao(uid: int) -> str:
    token = secrets.token_urlsafe(32)
    with conectar() as c:
        c.execute("INSERT INTO sessoes (token, usuario, criado_em) VALUES (?,?,?)",
                  (token, uid, time.time()))
    return token


def usuario_da_sessao(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    limite = time.time() - SESSAO_DIAS * 86400
    with conectar() as c:
        row = c.execute(
            "SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario"
            " WHERE s.token = ? AND s.criado_em > ?",
            (token, limite),
        ).fetchone()
    return dict(row) if row else None


def fechar_sessao(token: Optional[str]) -> None:
    if not token:
        return
    with conectar() as c:
        c.execute("DELETE FROM sessoes WHERE token = ?", (token,))


# ------------------------------------------------------------- guarda-roupa

LOOKS_MAX = 12
NOME_LOOK_MAX = 24


def listar_looks(uid: int) -> list[dict]:
    with conectar() as c:
        linhas = c.execute(
            "SELECT id, nome, avatar FROM guarda_roupa WHERE usuario = ?"
            " ORDER BY criado_em",
            (uid,),
        ).fetchall()
    return [{"id": l["id"], "nome": l["nome"], "avatar": json.loads(l["avatar"])}
            for l in linhas]


def salvar_look(uid: int, nome: str, avatar: dict) -> int:
    nome = " ".join(nome.split())[:NOME_LOOK_MAX] or "sem nome"
    with conectar() as c:
        (quantos,) = c.execute(
            "SELECT COUNT(*) FROM guarda_roupa WHERE usuario = ?", (uid,)
        ).fetchone()
        if quantos >= LOOKS_MAX:
            raise ErroConta(f"o guarda-roupa cabe {LOOKS_MAX} looks — apague um antes")
        cur = c.execute(
            "INSERT INTO guarda_roupa (usuario, nome, avatar, criado_em)"
            " VALUES (?,?,?,?)",
            (uid, nome, json.dumps(avatar), time.time()),
        )
        return cur.lastrowid


def apagar_look(uid: int, look_id: int) -> bool:
    """O `usuario` no WHERE não é enfeite: sem ele, qualquer um apagaria
    o look de qualquer outro só chutando o id."""
    with conectar() as c:
        cur = c.execute("DELETE FROM guarda_roupa WHERE id = ? AND usuario = ?",
                        (look_id, uid))
        return cur.rowcount > 0


# ------------------------------------------------------------------ salas
#
# Até aqui a sala vivia só num dict em memória: reiniciou o servidor,
# evaporou tudo junto — inclusive o contador de músicas e qualquer noção
# de quem frequentava o lugar. Isso derrubava a tese do projeto, que é a
# sala ser um *lugar fixo* e não um link descartável. Um lugar que perde
# a memória toda vez que a máquina do Fly dorme não é um lugar.

# Quantas linhas de histórico cada sala guarda. Sem teto, uma sala que
# roda música o dia inteiro cresce pra sempre num volume de 1GB. 200 é
# bem mais do que alguém rola na tela e ainda cabe folgado.
HISTORICO_MAX = 200

# Quantas salas o "suas salas" mostra. Acima disso deixa de ser atalho
# pras suas e vira outra lista de tudo.
MINHAS_MAX = 8


def sala_registrar(code: str, dono: Optional[int] = None) -> dict:
    """Garante a sala no banco e marca que ela foi vista agora.

    Quem chega primeiro numa sala que ainda não existe vira o dono. Isso
    não dá poder nenhum hoje — é o gancho de que a sala privada por
    convite precisa, e que só dá pra ter quando o dono sobrevive ao
    restart.
    """
    agora = time.time()
    with conectar() as c:
        c.execute(
            "INSERT INTO salas (code, dono, criada_em, vista_em) VALUES (?,?,?,?)"
            " ON CONFLICT(code) DO UPDATE SET vista_em = excluded.vista_em",
            (code, dono, agora, agora),
        )
        s = c.execute("SELECT * FROM salas WHERE code = ?", (code,)).fetchone()
    return dict(s)


def sala_contar_musica(code: str) -> int:
    """Sobe o contador da sala e devolve o total. Ver `Room.video_acabou`."""
    with conectar() as c:
        c.execute(
            "UPDATE salas SET musicas_ouvidas = musicas_ouvidas + 1 WHERE code = ?",
            (code,),
        )
        linha = c.execute(
            "SELECT musicas_ouvidas FROM salas WHERE code = ?", (code,)
        ).fetchone()
    return linha["musicas_ouvidas"] if linha else 0


def sala_anotar(code: str, video: str, titulo: str, por: str) -> None:
    """Registra que esse vídeo tocou aqui.

    Anotamos quando o vídeo *entra*, não quando acaba: metade das músicas
    é pulada antes do fim, e a pergunta que o histórico responde é "o que
    já rolou nessa sala", não "o que foi ouvido inteiro".
    """
    if not video:
        return
    with conectar() as c:
        c.execute(
            "INSERT INTO sala_historico (code, video, titulo, por, quando)"
            " VALUES (?,?,?,?,?)",
            (code, video, titulo, por, time.time()),
        )
        # Poda na mesma transação em vez de numa faxina periódica: assim
        # o teto vale sempre, e não só depois que o housekeeping rodar.
        c.execute(
            "DELETE FROM sala_historico WHERE code = ? AND id NOT IN ("
            "  SELECT id FROM sala_historico WHERE code = ?"
            "  ORDER BY quando DESC LIMIT ?)",
            (code, code, HISTORICO_MAX),
        )


def sala_titular(titulos_novos: dict[str, str]) -> None:
    """Preenche no histórico os títulos que só chegaram depois.

    O vídeo é anotado no instante em que entra, e nesse instante o oEmbed
    quase nunca respondeu ainda — anotar esperando o título repetiria o
    erro de deixar um rótulo segurar a sala. Então a linha nasce com o
    título vazio e é completada quando a busca volta.

    Só preenche o que está vazio: um título já gravado é o que a sala
    viu na época, e reescrever apagaria isso à toa.
    """
    pares = [(t, v) for v, t in titulos_novos.items() if v and t]
    if not pares:
        return
    with conectar() as c:
        c.executemany(
            "UPDATE sala_historico SET titulo = ? WHERE video = ? AND titulo = ''",
            pares,
        )


def sala_historico(code: str, limite: int = 30) -> list[dict]:
    with conectar() as c:
        linhas = c.execute(
            "SELECT video, titulo, por, quando FROM sala_historico"
            " WHERE code = ? ORDER BY quando DESC LIMIT ?",
            (code, min(limite, HISTORICO_MAX)),
        ).fetchall()
    return [dict(l) for l in linhas]


def sala_visitou(code: str, uid: int) -> None:
    """Marca que essa pessoa esteve aqui. É o que alimenta 'suas salas'."""
    with conectar() as c:
        c.execute(
            "INSERT INTO sala_membros (code, usuario, visitas, vista_em)"
            " VALUES (?,?,1,?)"
            " ON CONFLICT(code, usuario) DO UPDATE SET"
            "   visitas = visitas + 1, vista_em = excluded.vista_em",
            (code, uid, time.time()),
        )


def sala_membros(code: str, limite: int = 20) -> list[dict]:
    """Quem frequenta a sala, do mais recente pro mais antigo.

    Vai o avatar junto porque a tela desenha o boneco de cada um — quem
    está offline aparece apagadinho, que é o que dá a sensação de a sala
    ter gente mesmo quando está vazia.
    """
    with conectar() as c:
        linhas = c.execute(
            "SELECT u.id, u.nick, u.avatar, m.visitas, m.vista_em"
            " FROM sala_membros m JOIN usuarios u ON u.id = m.usuario"
            " WHERE m.code = ? ORDER BY m.vista_em DESC LIMIT ?",
            (code, limite),
        ).fetchall()
    return [
        {"id": l["id"], "nick": l["nick"], "avatar": json.loads(l["avatar"]),
         "visitas": l["visitas"], "vista_em": l["vista_em"]}
        for l in linhas
    ]


def minhas_salas(uid: int, limite: int = MINHAS_MAX) -> list[dict]:
    """As salas que essa pessoa frequenta, da mais recente pra trás.

    É o item da tese que premia o comportamento recorrente: quem volta
    encontra o lugar de volta, em vez de ter que lembrar o nome dele.
    """
    with conectar() as c:
        linhas = c.execute(
            "SELECT m.code, m.visitas, m.vista_em, s.musicas_ouvidas"
            " FROM sala_membros m JOIN salas s ON s.code = m.code"
            " WHERE m.usuario = ? ORDER BY m.vista_em DESC LIMIT ?",
            (uid, limite),
        ).fetchall()
    return [dict(l) for l in linhas]


def limpar_sessoes_velhas() -> None:
    limite = time.time() - SESSAO_DIAS * 86400
    with conectar() as c:
        c.execute("DELETE FROM sessoes WHERE criado_em < ?", (limite,))

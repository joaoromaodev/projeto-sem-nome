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


def limpar_sessoes_velhas() -> None:
    limite = time.time() - SESSAO_DIAS * 86400
    with conectar() as c:
        c.execute("DELETE FROM sessoes WHERE criado_em < ?", (limite,))

"""Formato das mensagens que trafegam no WebSocket.

Tudo que entra pelo socket passa por aqui antes de virar estado. Se um cliente
mandar lixo, o Pydantic derruba a mensagem em vez de deixar o servidor quebrar.

Convenção: `type` decide o formato de `payload`. Nunca mandar string solta.
"""

import re
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


NICK_MAX = 16
MSG_MAX = 300


LARG, ALT = 32, 48          # tamanho do sprite; tem que bater com o sprites.js
COR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
PECA_RE = re.compile(r"^[a-z0-9-]{0,24}$")


def _cor(v: str) -> str:
    if not isinstance(v, str) or not COR_RE.match(v):
        raise ValueError("cor precisa ser #rrggbb")
    return v.lower()


def _peca(v: str) -> str:
    """Só o formato. Se a peça existe de verdade é o cliente que resolve,
    olhando o manifesto — o servidor não tem por que saber o catálogo."""
    v = (v or "").strip().lower()
    if not PECA_RE.match(v):
        raise ValueError("nome de peça inválido")
    return v


class Avatar(BaseModel):
    """Aparência do bonequinho: cinco camadas, cada uma com peça e cor.

    A `pele` é a base e não tem variante — só cor. As outras quatro apontam
    pra um arquivo em static/sprites/ (ex.: torso="jaqueta" vira
    torso-jaqueta.png). Peça vazia significa "sem esta camada".

    Tudo isso cabe em ~150 bytes, então trocar de roupa no meio da sala não
    pesa na rede.
    """

    pele: str = "#ffdbac"

    pernas: str = ""
    pernas_cor: str = "#23203a"

    sapatos: str = ""
    sapatos_cor: str = "#12101a"

    torso: str = ""
    torso_cor: str = "#7a1030"

    cabelo: str = ""
    cabelo_cor: str = "#1a1220"

    _c = field_validator("pele", "pernas_cor", "sapatos_cor",
                         "torso_cor", "cabelo_cor")(_cor)
    _p = field_validator("pernas", "sapatos", "torso", "cabelo")(_peca)


class Pos(BaseModel):
    """Posição no chão da sala, em porcentagem (0-100).

    Percentual e não pixel: assim a sala funciona igual em qualquer tamanho
    de tela, sem o servidor precisar saber a resolução de ninguém.
    """

    x: float = Field(50, ge=0, le=100)
    y: float = Field(50, ge=0, le=100)


# ---------------------------------------------------------------- entrada

def limpar_nick(v: str) -> str:
    """Tira espaço sobrando e corta no tamanho. Vazio não passa."""
    v = " ".join(v.split())[:NICK_MAX]
    if not v:
        raise ValueError("nick vazio")
    return v


class ChatIn(BaseModel):
    type: Literal["chat"]
    text: str

    @field_validator("text")
    @classmethod
    def clean_text(cls, v: str) -> str:
        v = v.strip()[:MSG_MAX]
        if not v:
            raise ValueError("mensagem vazia")
        return v


class MoveIn(BaseModel):
    type: Literal["move"]
    pos: Pos


class AvatarIn(BaseModel):
    type: Literal["avatar"]
    avatar: Avatar


class NickIn(BaseModel):
    """Trocar de apelido no meio da sala — era metade da graça do MSN."""

    type: Literal["nick"]
    nick: str

    _n = field_validator("nick")(limpar_nick)


class PingIn(BaseModel):
    type: Literal["ping"]


IncomingT = ChatIn | MoveIn | AvatarIn | NickIn | PingIn


class Incoming(BaseModel):
    """Wrapper só pra o Pydantic escolher o modelo certo pelo campo `type`."""

    msg: IncomingT = Field(discriminator="type")


def parse(raw: dict) -> Optional[IncomingT]:
    """Devolve a mensagem tipada, ou None se vier torta.

    Erro aqui é rotina — cliente desatualizado, aba velha, alguém brincando
    no console. Não é motivo pra derrubar a conexão.
    """
    try:
        return Incoming(msg=raw).msg
    except Exception:
        return None


# ---------------------------------------------------------------- saída
# Só helpers de dict. Não vale a pena modelar a saída: ela é montada por nós,
# não recebida de fora, então não tem o que validar.

def ev(kind: str, **payload) -> dict:
    return {"type": kind, **payload}

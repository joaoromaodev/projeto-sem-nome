"""Formato das mensagens que trafegam no WebSocket.

Tudo que entra pelo socket passa por aqui antes de virar estado. Se um cliente
mandar lixo, o Pydantic derruba a mensagem em vez de deixar o servidor quebrar.

Convenção: `type` decide o formato de `payload`. Nunca mandar string solta.
"""

import re
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


NICK_MAX = 16
MSG_MAX = 300


LARG, ALT = 8, 14           # tamanho do sprite; tem que bater com o avatar.js
PALETA_MAX = 15             # 15 cores + o "vazio"; assim cada pixel cabe num dígito hex
COR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _cor(v: str) -> str:
    if not isinstance(v, str) or not COR_RE.match(v):
        raise ValueError("cor precisa ser #rrggbb")
    return v.lower()


class Avatar(BaseModel):
    """Aparência do bonequinho.

    Dois modos:

    - `pecas`   — o boneco padrão, com cores livres. É o caminho de quem só
                  quer escolher e entrar.
    - `desenho` — o usuário desenhou o dele. `arte` são LARG*ALT dígitos hex,
                  cada um apontando pra `paleta` ('0' = transparente).

    Mesmo no modo desenho as peças continuam preenchidas: se a arte vier
    quebrada, dá pra cair no boneco padrão em vez de sumir com a pessoa.
    """

    modo: Literal["pecas", "desenho"] = "pecas"

    # índices de forma; o cliente é quem sabe quantas opções existem de cada
    hair: int = Field(0, ge=0, le=20)      # estilo do cabelo
    corpo: int = Field(0, ge=0, le=20)     # silhueta do tronco
    baixo: int = Field(0, ge=0, le=20)     # calça, saia, vestido
    skin: str = "#ffdbac"
    hair_c: str = "#2b1a12"
    shirt: str = "#c02020"
    pants: str = "#303860"

    arte: Optional[str] = None
    paleta: Optional[list[str]] = None

    _c = field_validator("skin", "hair_c", "shirt", "pants")(_cor)

    @field_validator("paleta")
    @classmethod
    def _val_paleta(cls, v):
        if v is None:
            return None
        if len(v) > PALETA_MAX:
            raise ValueError("paleta grande demais")
        return [_cor(c) for c in v]

    @field_validator("arte")
    @classmethod
    def _val_arte(cls, v):
        if v is None:
            return None
        if len(v) != LARG * ALT:
            raise ValueError("tamanho de arte errado")
        if any(c not in "0123456789abcdef" for c in v.lower()):
            raise ValueError("arte tem caractere inválido")
        return v.lower()

    @model_validator(mode="after")
    def _coerente(self):
        # Modo desenho sem desenho vira o boneco padrão, em vez de erro.
        if self.modo == "desenho" and not (self.arte and self.paleta):
            self.modo = "pecas"
        if self.arte and self.paleta:
            maior = max((int(c, 16) for c in self.arte), default=0)
            if maior > len(self.paleta):
                raise ValueError("arte aponta pra cor que não existe na paleta")
        return self


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

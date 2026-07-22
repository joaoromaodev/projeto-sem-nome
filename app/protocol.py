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

# Id de vídeo do YouTube: 11 caracteres de um alfabeto fechado. Validar aqui
# importa porque esse id vai parar num iframe no navegador de todo mundo da
# sala — não é lugar pra aceitar string livre.
VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

# De onde dá pra tirar o id: o usuário cola a URL da barra de endereço, o
# link curto do botão compartilhar, ou o id pelado.
_URL_RES = [
    re.compile(r"(?:youtube\.com|youtube-nocookie\.com)/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})"),
    re.compile(r"youtu\.be/([A-Za-z0-9_-]{11})"),
    re.compile(r"(?:youtube\.com|youtube-nocookie\.com)/(?:embed|shorts|live|v)/([A-Za-z0-9_-]{11})"),
]

# Teto de posição: 24h em segundos. Não existe vídeo maior, e sem teto uma
# posição absurda faria o cliente ficar tentando alcançar um ponto que não
# chega nunca.
POS_MAX = 86400.0


def extrair_video_id(v: str) -> str:
    """Aceita id pelado ou qualquer formato de link do YouTube."""
    v = (v or "").strip()
    if VIDEO_ID_RE.match(v):
        return v
    for r in _URL_RES:
        m = r.search(v)
        if m:
            return m.group(1)
    raise ValueError("não reconheci esse link do YouTube")


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
    """Aparência do bonequinho.

    Dois modos, decididos por `base`:
      - base == ""      → paper-doll clássico: cinco camadas (pele + quatro
                          peças) com cor cada, montadas no cliente.
      - base != ""      → personagem pronto de 8 direções (ex.: "masc"),
                          servido em static/sprites/chars/. Nesse caso as
                          camadas abaixo são ignoradas no desenho, mas seguem
                          válidas pra quem voltar ao clássico.

    Quem valida se a `base` existe de fato é o cliente (olhando o catálogo),
    igual às peças — o servidor só garante o formato. Campo novo e opcional,
    então avatar antigo (sem `base`) continua válido: cai no clássico.

    Tudo isso cabe em ~150 bytes, então trocar no meio da sala não pesa na rede.
    """

    base: str = ""

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
    _b = field_validator("base")(_peca)   # mesmo formato de peça (só valida a forma)


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


class DigitandoIn(BaseModel):
    """"Fulano está digitando".

    Não carrega texto nenhum de propósito: mandar o que a pessoa está
    escrevendo antes de ela apertar enter seria vazar rascunho — inclusive
    o que ela apagou e decidiu não dizer.
    """

    type: Literal["digitando"]
    ligado: bool


class BuzinaIn(BaseModel):
    """Chama a atenção de quem está com a aba escondida.

    Existe porque o uso real é ficar de música no fundo, aba oculta: sem um
    barulho, o chat só é lido quando alguém lembra de olhar. É temporário —
    ver a nota em `main.py` sobre por que ele nasce com trava de tempo.
    """

    type: Literal["buzina"]


# ------------------------------------------------------------------ vídeo
# O servidor é a fonte da verdade da reprodução. O cliente nunca trata o
# próprio player como verdade: ele manda a intenção ("dei play em tal
# ponto") e depois corrige a si mesmo pelo que o servidor devolve.

class VideoPorIn(BaseModel):
    """Trocar o vídeo da sala. Aceita link ou id."""

    type: Literal["video_por"]
    video: str

    _v = field_validator("video")(extrair_video_id)


class VideoPlayIn(BaseModel):
    type: Literal["video_play"]
    pos: float = Field(0, ge=0, le=POS_MAX)


class VideoPauseIn(BaseModel):
    type: Literal["video_pause"]
    pos: float = Field(0, ge=0, le=POS_MAX)


class VideoSeekIn(BaseModel):
    type: Literal["video_seek"]
    pos: float = Field(0, ge=0, le=POS_MAX)


class FilaPorIn(BaseModel):
    """Pôr na fila. Não exige o controle — ver a nota em main.py."""

    type: Literal["fila_por"]
    video: str

    _v = field_validator("video")(extrair_video_id)


class FilaTirarIn(BaseModel):
    type: Literal["fila_tirar"]
    video: str

    _v = field_validator("video")(extrair_video_id)


class VideoPularIn(BaseModel):
    """Passar pro próximo da fila. Exige o controle."""

    type: Literal["video_pular"]


class ControlePegarIn(BaseModel):
    """Pegar o controle remoto do chão. Só pega quem chegar primeiro."""

    type: Literal["controle_pegar"]


class ControleSoltarIn(BaseModel):
    """Devolver o controle, pra outra pessoa poder pegar."""

    type: Literal["controle_soltar"]


class VideoFimIn(BaseModel):
    """O player avisou que o vídeo acabou.

    Vem de todo mundo ao mesmo tempo, então o servidor precisa ignorar as
    repetições — ver `Room.video_acabou`.
    """

    type: Literal["video_fim"]


IncomingT = (ChatIn | MoveIn | AvatarIn | NickIn | PingIn
             | DigitandoIn | BuzinaIn
             | VideoPorIn | VideoPlayIn | VideoPauseIn | VideoSeekIn
             | VideoFimIn | VideoPularIn
             | FilaPorIn | FilaTirarIn
             | ControlePegarIn | ControleSoltarIn)


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

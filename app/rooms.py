"""Salas e quem está dentro delas.

Estado mora em memória: reiniciou o servidor, esvaziou tudo. Pro MVP isso
basta — a sala persistente que o plano promete vem quando existir banco.
O que já é permanente aqui é o *código* da sala: ele é derivado do nome,
então "quinta-a-noite" sempre cai no mesmo lugar.
"""

import asyncio
import re
import time
from dataclasses import dataclass, field
from typing import Optional

from fastapi import WebSocket

from . import titulos
from .protocol import Avatar, Pos, ev


MAX_POR_SALA = 12

# O lobby é a sala oficial: quem entra sem destino cai aqui, então nunca deve
# estar vazia. Cabe mais gente que uma sala comum — 12 é medida de sala de
# amigos, e o lobby é praça. Acima de ~30 bonecos a tela vira sopa.
LOBBY = "lobby"
MAX_LOBBY = 30

# Quantos avatares a lista de salas manda por sala. É só pra dar cara à
# sala na lista; mandar os 30 do lobby seria payload à toa.
AMOSTRA = 6

SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(nome: str) -> str:
    """'Quinta à Noite!' -> 'quinta-a-noite'"""
    trocas = str.maketrans("áàâãäéèêëíìîïóòôõöúùûüç", "aaaaaeeeeiiiiooooouuuuc")
    s = nome.lower().translate(trocas)
    s = SLUG_RE.sub("-", s).strip("-")
    return s[:32] or "sala"


@dataclass
class Video:
    """O que está tocando na sala, do ponto de vista do servidor.

    Guardamos a posição de um instante conhecido (`pos` em `desde`) em vez
    de uma posição "atual": posição atual envelheceria entre o cálculo e a
    chegada da mensagem. Com o par (posição, instante) o cliente reconstrói
    onde deveria estar agora, por mais atrasada que a mensagem chegue.

    `desde` usa relógio monotônico de propósito — `time.time()` pode andar
    pra trás com ajuste de NTP e faria a posição saltar.
    """

    id: str = ""
    tocando: bool = False
    pos: float = 0.0
    desde: float = field(default_factory=time.monotonic)
    # Quem pediu o vídeo. Só pra mostrar no chat; não dá poder nenhum.
    por: str = ""

    def posicao_agora(self) -> float:
        if not self.id or not self.tocando:
            return self.pos
        return self.pos + (time.monotonic() - self.desde)

    def marcar(self, pos: float, tocando: bool) -> None:
        self.pos = max(0.0, pos)
        self.tocando = tocando
        self.desde = time.monotonic()

    def estado(self) -> dict:
        return {
            "id": self.id,
            "tocando": self.tocando,
            "pos": round(self.posicao_agora(), 3),
            "por": self.por,
        }


@dataclass
class User:
    uid: str          # identifica a conexão (a mesma conta pode abrir 2 abas)
    nick: str
    avatar: Avatar
    pos: Pos
    ws: WebSocket
    conta: int = 0    # id da conta no banco
    entrou_em: float = field(default_factory=time.time)

    def publico(self) -> dict:
        """O que os outros podem ver. Nunca inclui o WebSocket."""
        return {
            "uid": self.uid,
            "nick": self.nick,
            "avatar": self.avatar.model_dump(),
            "pos": self.pos.model_dump(),
        }


class Room:
    def __init__(self, code: str):
        self.code = code
        self.users: dict[str, User] = {}
        self.criada_em = time.time()
        self.musicas_ouvidas = 0
        self.video = Video()
        self.fila: list[str] = []

        # O controle remoto é um objeto da sala, não um cargo. Ou está na
        # mão de alguém (`controle` = uid), ou está caído no chão numa
        # posição (`controle_pos`) de onde qualquer um pode pegar.
        self.controle: str = ""
        self.controle_pos = Pos(x=50, y=80)

        self._lock = asyncio.Lock()

    # ------------------------------------------------------- controle

    def manda(self, uid: str) -> bool:
        """Essa pessoa pode mexer no player?"""
        return bool(self.controle) and self.controle == uid

    def pegar_controle(self, uid: str) -> bool:
        """Só pega quem chegar primeiro; ninguém tira da mão de ninguém."""
        if self.controle:
            return False
        self.controle = uid
        return True

    def soltar_controle(self, uid: str, onde: Optional[Pos] = None) -> bool:
        """Devolve o controle pro chão, onde a pessoa estava."""
        if self.controle != uid:
            return False
        self.controle = ""
        if onde is not None:
            self.controle_pos = onde
        return True

    def controle_estado(self) -> dict:
        return {
            "de": self.controle,
            "pos": self.controle_pos.model_dump(),
        }

    # ------------------------------------------------------------ fila

    def proximo(self) -> str:
        """Tira o primeiro da fila e devolve. Vazio se acabou."""
        return self.fila.pop(0) if self.fila else ""

    def video_acabou(self) -> bool:
        """Trata o fim do vídeo uma vez só.

        O evento de fim dispara no player de todo mundo quase junto, então
        chegam N mensagens iguais. Sem esta guarda o contador de músicas
        subiria uma vez por pessoa na sala.
        """
        if not self.video.id or not self.video.tocando:
            return False
        self.video.marcar(self.video.pos, tocando=False)
        self.musicas_ouvidas += 1
        return True

    @property
    def eh_lobby(self) -> bool:
        return self.code == LOBBY

    @property
    def limite(self) -> int:
        return MAX_LOBBY if self.eh_lobby else MAX_POR_SALA

    @property
    def cheia(self) -> bool:
        return len(self.users) >= self.limite

    def roster(self) -> list[dict]:
        return [u.publico() for u in self.users.values()]

    def resumo(self) -> dict:
        """O cartão da sala na lista do lobby.

        Sinal de vida em vez de nota: quem olha a lista quer saber se tem
        gente lá e quem é, não se a sala é "boa". Por isso vão os avatares
        de verdade e não uma média de estrelas.
        """
        return {
            "code": self.code,
            "gente": len(self.users),
            "limite": self.limite,
            "lobby": self.eh_lobby,
            # se tem vídeo rolando, a lista mostra — é sinal de vida tanto
            # quanto a contagem de gente
            "video": self.video.id if self.video.tocando else "",
            # Só o que já está em cache — a lista recarrega a cada 8s e não
            # pode disparar busca na rede a cada volta. Se ainda não sabemos,
            # o cartão mostra o id, como antes.
            "video_titulo": (
                titulos.conhecido(self.video.id) if self.video.tocando else ""
            ),
            "nicks": [u.nick for u in self.users.values()][:AMOSTRA],
            "avatares": [
                u.avatar.model_dump() for u in self.users.values()
            ][:AMOSTRA],
        }

    async def add(self, user: User) -> None:
        async with self._lock:
            self.users[user.uid] = user

    async def remove(self, uid: str) -> Optional[User]:
        async with self._lock:
            saiu = self.users.pop(uid, None)
        # Se a pessoa fechou a aba segurando o controle, ele cai no chão
        # onde ela estava. Sem isto o controle sumiria com ela e a sala
        # ficaria sem ninguém podendo mexer no vídeo — travada de vez.
        if saiu is not None and self.controle == uid:
            self.soltar_controle(uid, saiu.pos)
        return saiu

    async def broadcast(self, msg: dict, exceto: Optional[str] = None) -> None:
        """Manda pra todo mundo. Conexão morta é descartada em silêncio.

        Não removemos o usuário aqui: quem cuida disso é o `finally` do
        endpoint, que é o único lugar que sabe se a saída foi de verdade.
        """
        alvos = [u for uid, u in self.users.items() if uid != exceto]
        if not alvos:
            return
        await asyncio.gather(
            *(self._send(u, msg) for u in alvos), return_exceptions=True
        )

    @staticmethod
    async def _send(user: User, msg: dict) -> None:
        try:
            await user.ws.send_json(msg)
        except Exception:
            pass  # socket já caiu; o finally do endpoint limpa


class RoomManager:
    def __init__(self):
        self.rooms: dict[str, Room] = {}
        self.get(LOBBY)  # o lobby existe desde o boot, mesmo sem ninguém

    def get(self, code: str) -> Room:
        """Sala é criada na hora que alguém tenta entrar. Sem cadastro."""
        code = slugify(code)
        if code not in self.rooms:
            self.rooms[code] = Room(code)
        return self.rooms[code]

    def existe(self, code: str) -> bool:
        return slugify(code) in self.rooms

    def listar(self) -> list[dict]:
        """Salas com gente agora, o lobby sempre na frente.

        Só entra sala com alguém dentro: sala vazia na lista é convite pra
        entrar num lugar deserto e sair. O lobby é a exceção — ele aparece
        mesmo vazio, porque é o destino padrão e precisa de porta visível.
        """
        vivas = [
            r.resumo() for r in self.rooms.values()
            if r.users or r.eh_lobby
        ]
        # lobby primeiro; depois as mais cheias
        vivas.sort(key=lambda s: (not s["lobby"], -s["gente"], s["code"]))
        return vivas

    def limpar_vazias(self) -> int:
        """Sala sem ninguém há mais de 1h vira lixo. Roda pelo housekeeping.

        O lobby nunca entra na faxina: ele é o destino padrão, e recriá-lo
        no próximo acesso perderia o contador da sala.
        """
        agora = time.time()
        mortas = [
            c for c, r in self.rooms.items()
            if not r.users and not r.eh_lobby and agora - r.criada_em > 3600
        ]
        for c in mortas:
            del self.rooms[c]
        return len(mortas)

    def stats(self) -> dict:
        return {
            "salas": len(self.rooms),
            "online": sum(len(r.users) for r in self.rooms.values()),
        }


manager = RoomManager()

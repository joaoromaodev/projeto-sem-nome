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
        self.musicas_ouvidas = 0  # contador que aparece na sala; cresce na etapa do YouTube
        self._lock = asyncio.Lock()

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
            return self.users.pop(uid, None)

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

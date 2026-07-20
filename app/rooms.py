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
    def cheia(self) -> bool:
        return len(self.users) >= MAX_POR_SALA

    def roster(self) -> list[dict]:
        return [u.publico() for u in self.users.values()]

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

    def get(self, code: str) -> Room:
        """Sala é criada na hora que alguém tenta entrar. Sem cadastro."""
        code = slugify(code)
        if code not in self.rooms:
            self.rooms[code] = Room(code)
        return self.rooms[code]

    def existe(self, code: str) -> bool:
        return slugify(code) in self.rooms

    def limpar_vazias(self) -> int:
        """Sala sem ninguém há mais de 1h vira lixo. Roda pelo housekeeping."""
        agora = time.time()
        mortas = [
            c for c, r in self.rooms.items()
            if not r.users and agora - r.criada_em > 3600
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

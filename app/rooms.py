"""Salas e quem está dentro delas.

A divisão aqui é entre **presença** e **memória**, e ela não é arbitrária:

- Quem está dentro agora, onde cada boneco está, quem segurou o controle,
  o que toca neste segundo — tudo isso mora **em memória**. É estado de
  agora; guardar no banco só criaria gente fantasma sobrevivendo a um
  crash.
- Quem é o dono, quanto já tocou ali, o que já rolou e quem frequenta —
  isso mora **no banco** (`db.py`). É o que faz a sala ser um lugar e não
  um link: no Fly a máquina dorme quando não tem ninguém, e sem isso a
  sala perderia a história inteira toda vez que isso acontecesse.

O código da sala é derivado do nome, então "quinta-a-noite" sempre cai no
mesmo lugar — é ele a chave dos dois lados.
"""

import asyncio
import json
import re
import time
from dataclasses import dataclass, field
from typing import Optional

from fastapi import WebSocket

from . import db, titulos
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

# Teto de buzinas da sala: até BUZINA_MAX numa janela deslizante de
# BUZINA_JANELA_S. Rajada é permitida; rajada infinita não.
BUZINA_MAX = 10
BUZINA_JANELA_S = 40.0

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
    def __init__(self, code: str, dono: Optional[int] = None):
        self.code = code
        self.users: dict[str, User] = {}
        self.criada_em = time.time()
        self.video = Video()
        self.fila: list[str] = []

        # A sala pode existir no banco há meses e estar aparecendo em
        # memória agora só porque a máquina reiniciou. Por isso o contador
        # vem do banco e não do zero: reiniciar não é a sala nascer.
        linha = db.sala_registrar(code, dono)
        self.musicas_ouvidas = linha["musicas_ouvidas"]
        self.dono = linha["dono"]
        # O lobby é praça: nunca tranca, aconteça o que acontecer no banco.
        # Trancado, ele deixaria de ser o destino padrão e quem entrasse
        # sem sala não teria pra onde ir.
        self.privada = bool(linha["privada"]) and not self.eh_lobby
        self.convite = linha["convite"] or ""
        self.moveis = self._ler_moveis(self.code, linha["moveis"])

        # O controle remoto é um objeto da sala, não um cargo. Ou está na
        # mão de alguém (`controle` = uid), ou está caído no chão numa
        # posição (`controle_pos`) de onde qualquer um pode pegar.
        self.controle: str = ""
        self.controle_pos = Pos(x=50, y=80)

        # Quando cada buzina recente tocou. Ver `buzinar`.
        self.buzinas: list[float] = []

        self._lock = asyncio.Lock()

    # ---------------------------------------------------------- móveis

    # Onde a jukebox fica numa sala que ninguém decorou. É a mesma posição
    # que a TV ocupava, porque é o mesmo papel: o móvel que toca.
    #
    # A TV e o sofá saíram (ver a decisão "A sala ouve, não assiste"). Não
    # precisou de remendo no banco pra isso: `_ler_moveis` percorre as
    # chaves de MOVEIS_PADRAO e só lê do JSON as que existem hoje, então a
    # posição antiga de `tv`/`sofa` gravada numa sala velha é simplesmente
    # ignorada. Móvel que não existe mais não vira lixo, vira silêncio.
    MOVEIS_PADRAO = {"jukebox": {"x": 50.0, "y": 52.0}}

    # Sala com cenário tem o chão ocupado, e aí o meio deixa de ser um bom
    # lugar. No escritório a ilha de mesas cobre exatamente a faixa do
    # meio: a jukebox nascia 82% enterrada atrás de um monitor, e como o
    # clique nela é o que libera o áudio (requisito do navegador), móvel
    # escondido não é só feio — é a sala muda.
    #
    # Foi o mesmo problema que já tinha comido a TV. **A lição é que o
    # cenário precisa dizer onde o móvel nasce**, senão todo cenário novo
    # reencontra este bug sozinho.
    MOVEIS_POR_SALA = {
        "escritorio": {"jukebox": {"x": 87.0, "y": 20.0}},   # canto livre à direita
    }

    @classmethod
    def _ler_moveis(cls, code: str, cru: str) -> dict:
        """Lê o JSON da coluna, caindo no padrão a qualquer sinal de lixo.

        Sala sem decoração tem a coluna vazia, que é o caso comum e não é
        erro. Mas um JSON quebrado também não pode derrubar a sala inteira
        — móvel fora do lugar é chato, sala que não abre é fatal.

        O padrão pode ser específico da sala quando ela tem cenário (ver
        MOVEIS_POR_SALA). Isso só vale pra sala nova: quem já arrastou tem
        posição gravada, e ela ganha.
        """
        padrao = cls.MOVEIS_POR_SALA.get(code, cls.MOVEIS_PADRAO)
        moveis = {k: dict(v) for k, v in padrao.items()}
        try:
            salvo = json.loads(cru) if cru else {}
        except Exception:
            return moveis
        if not isinstance(salvo, dict):
            return moveis
        for nome, alvo in moveis.items():
            p = salvo.get(nome)
            if isinstance(p, dict):
                for eixo in ("x", "y"):
                    try:
                        alvo[eixo] = min(100.0, max(0.0, float(p[eixo])))
                    except (KeyError, TypeError, ValueError):
                        pass
        return moveis

    def mover_movel(self, qual: str, pos: Pos) -> bool:
        """Arrasta um móvel e grava. Só os móveis que existem de verdade."""
        if qual not in self.moveis:
            return False
        self.moveis[qual] = {"x": pos.x, "y": pos.y}
        db.salvar_moveis(self.code, self.moveis)
        return True

    # -------------------------------------------------------- privada

    def pode_entrar(self, uid: int) -> bool:
        """Sala aberta é de todos; sala trancada é de quem já esteve nela.

        Quem entra por convite vira membro **antes** desta checagem (ver a
        rota do convite), então "ser membro" é o mesmo que "foi
        convidado". Isso evita uma lista de permissões separada, que entre
        amigos ninguém mantém.
        """
        if not self.privada:
            return True
        return uid == self.dono or db.eh_membro(self.code, uid)

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

    # ---------------------------------------------------------- buzina

    def buzinar(self) -> tuple[bool, float]:
        """Pode buzinar agora? Devolve (pode, segundos até liberar).

        Era um intervalo mínimo entre buzinas, e a rajada é justamente a
        graça — buzinar em sequência quando a coisa é urgente de verdade.
        Agora vale floodar à vontade **até um teto**: 10 buzinas em 40s.

        A janela é deslizante e não um contador que zera de tempo em
        tempo. Com contador zerando, quem gastasse as 10 no fim de uma
        janela ganharia mais 10 no começo da seguinte — 20 buzinas
        seguidas, que é exatamente o que o teto existe pra impedir. Aqui
        cada buzina caduca 40s depois da sua vez, então o limite vale em
        qualquer trecho de 40s que se olhe.

        A trava é por **sala**, não por pessoa: o incômodo é o barulho, e
        pra quem ouve tanto faz se as dez vieram de uma pessoa ou de dez.
        Limitar por pessoa deixaria a sala inteira buzinar em fila com o
        mesmo efeito.
        """
        agora = time.monotonic()
        # descarta o que já saiu da janela
        self.buzinas = [t for t in self.buzinas if agora - t < BUZINA_JANELA_S]

        if len(self.buzinas) >= BUZINA_MAX:
            # a mais antiga é a que vai liberar a próxima vaga
            libera_em = BUZINA_JANELA_S - (agora - self.buzinas[0])
            return False, max(0.0, libera_em)

        self.buzinas.append(agora)
        return True, 0.0

    def buzinas_restantes(self) -> int:
        """Quantas ainda cabem na janela. Só pra mostrar na tela."""
        agora = time.monotonic()
        vivas = sum(1 for t in self.buzinas if agora - t < BUZINA_JANELA_S)
        return max(0, BUZINA_MAX - vivas)

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
        # O banco é quem soma, e o total volta de lá. Somar em memória e
        # gravar depois daria dois números pra mesma coisa — e o de
        # memória mentiria depois de qualquer restart.
        self.musicas_ouvidas = db.sala_contar_musica(self.code)
        return True

    def anotar_video(self, video: str, por: str) -> None:
        """Guarda no histórico o que acabou de entrar na TV.

        O título vai como o que já sabemos: se o oEmbed ainda não voltou,
        fica vazio e a tela cai no id, exatamente como já faz em todo
        canto. Esperar o rótulo pra gravar seria o mesmo erro de deixar um
        texto segurar a sala.
        """
        db.sala_anotar(self.code, video, titulos.conhecido(video) or "", por)

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
            "privada": self.privada,
            # O que já tocou aqui é o sinal de que a sala tem passado —
            # e, numa sala vazia, é o único sinal que sobra.
            "musicas": self.musicas_ouvidas,
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

    def iniciar(self) -> None:
        """O lobby existe desde o boot, mesmo sem ninguém.

        Isto era feito no `__init__`, e deixou de dar: montar uma sala
        agora escreve no banco, e o `manager` é criado no import deste
        módulo — antes de `db.iniciar()` ter criado as tabelas. Quem chama
        é o lifespan do app, depois do banco estar de pé.
        """
        self.get(LOBBY)

    def get(self, code: str, dono: Optional[int] = None) -> Room:
        """Sala é criada na hora que alguém tenta entrar. Sem cadastro."""
        code = slugify(code)
        if code not in self.rooms:
            self.rooms[code] = Room(code, dono)
        return self.rooms[code]

    def existe(self, code: str) -> bool:
        return slugify(code) in self.rooms

    def listar(self, uid: int = 0) -> list[dict]:
        """Salas com gente agora, o lobby sempre na frente.

        Só entra sala com alguém dentro: sala vazia na lista é convite pra
        entrar num lugar deserto e sair. O lobby é a exceção — ele aparece
        mesmo vazio, porque é o destino padrão e precisa de porta visível.

        Sala trancada não aparece pra quem não é de lá. Mostrar e barrar
        na porta seria pior que esconder: a lista já entrega **quem está
        onde**, e é justamente disso que quem trancou quer privacidade.
        """
        vivas = [
            r.resumo() for r in self.rooms.values()
            if (r.users or r.eh_lobby) and r.pode_entrar(uid)
        ]
        # lobby primeiro; depois as mais cheias
        vivas.sort(key=lambda s: (not s["lobby"], -s["gente"], s["code"]))
        return vivas

    def limpar_vazias(self) -> int:
        """Sala sem ninguém há mais de 1h sai da memória. Pelo housekeeping.

        Isto **não apaga a sala** — ela continua inteira no banco, com
        dono, contador, histórico e membros. O que a faxina descarta é a
        cópia em memória, que só existe pra atender quem está online. Quem
        voltar amanhã encontra o lugar de volta.

        O lobby fica de fora mesmo assim: é o destino padrão e precisa de
        porta visível na lista, que só mostra sala que existe em memória.
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

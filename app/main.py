"""Servidor: contas, arquivos estáticos e o WebSocket das salas."""

import asyncio
import contextlib
import json
import time
import uuid
from collections import defaultdict
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response, WebSocket
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
from starlette.websockets import WebSocketDisconnect

from . import db, titulos
from .protocol import (Avatar, AvatarIn, BuzinaIn, ChatIn, ControlePegarIn,
                       ControleSoltarIn, DigitandoIn, FilaPorIn, FilaTirarIn,
                       MoveIn, NickIn, PingIn, Pos, VideoFimIn, VideoPauseIn,
                       VideoPlayIn, VideoPorIn, VideoPularIn, VideoSeekIn,
                       ev, limpar_nick, parse)
from .rooms import LOBBY, User, Video, manager

RAIZ = Path(__file__).resolve().parent.parent
ESTATICO = RAIZ / "static"
COOKIE = "sessao"

# Limite de tentativas de login por IP. Não é fortaleza — é pra não deixar
# alguém varrer senhas à vontade num domingo à tarde.
TENTATIVAS_MAX, JANELA_S = 8, 300
_tentativas: dict[str, list[float]] = defaultdict(list)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    db.iniciar()
    tarefas = [
        asyncio.create_task(_housekeeping()),
        asyncio.create_task(_batida_video()),
    ]
    yield
    for t in tarefas:
        t.cancel()
    for t in tarefas:
        with contextlib.suppress(asyncio.CancelledError):
            await t


async def _housekeeping():
    while True:
        await asyncio.sleep(600)
        manager.limpar_vazias()
        db.limpar_sessoes_velhas()


# De quanto em quanto tempo o servidor conta a posição canônica do vídeo.
# 3s é o meio-termo do plano: mais raro deixa a deriva crescer demais antes
# da correção, mais frequente é tráfego à toa numa sala parada.
BATIDA_S = 3.0


async def _batida_video():
    """Manda a posição canônica pra quem está vendo vídeo.

    É isto que segura a sincronia: cada cliente compara a própria posição
    com esta e se corrige. O servidor não pergunta nada a ninguém — ele só
    afirma, e quem estiver fora de lugar que se ajuste.
    """
    while True:
        await asyncio.sleep(BATIDA_S)
        for room in list(manager.rooms.values()):
            if not room.users or not room.video.id or not room.video.tocando:
                continue
            await room.broadcast(ev("video_estado", **room.video.estado()))


app = FastAPI(title="projeto sem nome", lifespan=lifespan)


# ------------------------------------------------------------------ sessão

def usuario_opcional(request: Request) -> dict | None:
    return db.usuario_da_sessao(request.cookies.get(COOKIE))


def usuario(request: Request) -> dict:
    u = usuario_opcional(request)
    if not u:
        raise HTTPException(401, "entre primeiro")
    return u


def _publico(u: dict) -> dict:
    """O que pode sair do servidor. Nunca inclui salt nem hash de senha."""
    return {"id": u["id"], "nick": u["nick"], "avatar": json.loads(u["avatar"])}


def _pode_tentar(ip: str) -> bool:
    agora = time.time()
    t = [x for x in _tentativas[ip] if agora - x < JANELA_S]
    _tentativas[ip] = t
    return len(t) < TENTATIVAS_MAX


def _marcar_tentativa(ip: str) -> None:
    _tentativas[ip].append(time.time())


# ------------------------------------------------------------------ páginas

@app.get("/entrar")
async def pag_entrar(request: Request):
    if usuario_opcional(request):
        return RedirectResponse("/", 302)
    return FileResponse(ESTATICO / "entrar.html")


@app.get("/")
async def pag_home(request: Request):
    if not usuario_opcional(request):
        return RedirectResponse("/entrar", 302)
    return FileResponse(ESTATICO / "index.html")


@app.get("/sala/{code}")
async def pag_sala(request: Request, code: str):
    if not usuario_opcional(request):
        return RedirectResponse("/entrar", 302)
    return FileResponse(ESTATICO / "sala.html")


# ------------------------------------------------------------------ conta

class Credenciais(BaseModel):
    nick: str
    senha: str
    avatar: Avatar | None = None

    _n = field_validator("nick")(limpar_nick)


def _https(request: Request) -> bool:
    """Se a conexão do usuário é HTTPS.

    Atrás de um proxy (Render, Railway, túnel) o servidor recebe HTTP puro,
    e quem sabe do HTTPS é o cabeçalho que o proxy manda.
    """
    if request.headers.get("x-forwarded-proto", "").split(",")[0].strip() == "https":
        return True
    return request.url.scheme == "https"


def _por_cookie(resp: Response, token: str, request: Request) -> None:
    resp.set_cookie(
        COOKIE, token,
        max_age=db.SESSAO_DIAS * 86400,
        httponly=True,            # JS da página não enxerga o token
        samesite="lax",           # não viaja em requisição vinda de outro site
        secure=_https(request),   # só em HTTPS; ligado fixo quebraria o localhost
        path="/",
    )


@app.post("/api/cadastrar")
async def cadastrar(c: Credenciais, request: Request, response: Response):
    try:
        uid = db.criar_usuario(c.nick, c.senha, (c.avatar or Avatar()).model_dump())
    except db.ErroConta as e:
        raise HTTPException(400, str(e))
    _por_cookie(response, db.abrir_sessao(uid), request)
    return _publico(db.buscar_usuario(uid))


@app.post("/api/entrar")
async def entrar(c: Credenciais, request: Request, response: Response):
    ip = request.client.host if request.client else "?"
    if not _pode_tentar(ip):
        raise HTTPException(429, "muitas tentativas, espera uns minutos")

    u = db.autenticar(c.nick, c.senha)
    if not u:
        _marcar_tentativa(ip)
        raise HTTPException(401, "apelido ou senha incorretos")

    _por_cookie(response, db.abrir_sessao(u["id"]), request)
    return _publico(u)


@app.post("/api/sair")
async def sair(request: Request, response: Response):
    db.fechar_sessao(request.cookies.get(COOKIE))
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@app.get("/api/eu")
async def eu(u: dict = Depends(usuario)):
    return _publico(u)


class AvatarBody(BaseModel):
    avatar: Avatar


@app.put("/api/avatar")
async def por_avatar(body: AvatarBody, u: dict = Depends(usuario)):
    db.salvar_avatar(u["id"], body.avatar.model_dump())
    return {"ok": True}


class NickBody(BaseModel):
    nick: str
    _n = field_validator("nick")(limpar_nick)


@app.post("/api/nick")
async def por_nick(body: NickBody, u: dict = Depends(usuario)):
    try:
        db.trocar_nick(u["id"], body.nick)
    except db.ErroConta as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "nick": body.nick}


class SenhaBody(BaseModel):
    atual: str
    nova: str


@app.post("/api/senha")
async def por_senha(body: SenhaBody, response: Response, u: dict = Depends(usuario)):
    try:
        db.trocar_senha(u["id"], body.atual, body.nova)
    except db.ErroConta as e:
        raise HTTPException(400, str(e))
    # trocar senha derruba todas as sessões, inclusive esta
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@app.get("/api/stats")
async def stats():
    return manager.stats()


@app.get("/api/salas")
async def salas(u: dict = Depends(usuario)):
    """Salas com gente agora. Exige sessão: a lista diz quem está onde.

    Deliberadamente não tem nota nem ranking — ver `Room.resumo()`.
    """
    return {"salas": manager.listar(), "lobby": LOBBY}


# ------------------------------------------------------------- peças

CAMADAS = ["pele", "pernas", "sapatos", "torso", "cabelo"]


def _manifesto() -> dict[str, list[str]]:
    """Que peças existem, lido da pasta de sprites.

    Assim acrescentar uma roupa é soltar o arquivo em static/sprites/ e
    reiniciar — sem tocar em código nem em banco.
    """
    pasta = ESTATICO / "sprites"
    achado: dict[str, list[str]] = {c: [] for c in CAMADAS}
    if not pasta.is_dir():
        return achado

    for arq in sorted(pasta.glob("*.png")):
        nome = arq.stem                       # ex.: "torso-jaqueta"
        camada, _, peca = nome.partition("-")
        if camada in achado:
            achado[camada].append(peca)       # a pele fica com "" (não tem variante)
    return achado


@app.get("/api/pecas")
async def pecas():
    return _manifesto()


# ------------------------------------------------------------- guarda-roupa

class LookBody(BaseModel):
    nome: str = ""
    avatar: Avatar


@app.get("/api/guarda-roupa")
async def ver_guarda_roupa(u: dict = Depends(usuario)):
    return {"looks": db.listar_looks(u["id"]), "max": db.LOOKS_MAX}


@app.post("/api/guarda-roupa")
async def guardar_look(body: LookBody, u: dict = Depends(usuario)):
    try:
        lid = db.salvar_look(u["id"], body.nome, body.avatar.model_dump())
    except db.ErroConta as e:
        raise HTTPException(400, str(e))
    return {"id": lid}


@app.delete("/api/guarda-roupa/{look_id}")
async def apagar_look(look_id: int, u: dict = Depends(usuario)):
    if not db.apagar_look(u["id"], look_id):
        raise HTTPException(404, "esse look não existe")
    return {"ok": True}


# ------------------------------------------------------------------ sala

def _pode(room, uid: str, ws: WebSocket) -> bool:
    """Checa o controle e, se não tiver, avisa quem tentou.

    Avisar importa: sem retorno, quem clica num botão bloqueado acha que o
    site travou. E o aviso vai só pra quem tentou, não pra sala.
    """
    if room.manda(uid):
        return True
    dono = room.users.get(room.controle)
    texto = (f"{dono.nick} está com o controle" if dono
             else "pegue o controle remoto pra mexer no vídeo")
    asyncio.create_task(_avisar(ws, texto))
    return False


async def _avisar(ws: WebSocket, texto: str) -> None:
    try:
        await ws.send_json(ev("aviso", texto=texto))
    except Exception:
        pass


# O event loop só guarda referência fraca das tarefas: uma tarefa solta
# pode ser coletada no meio do caminho e o título nunca chegaria — e seria
# um bug intermitente, do tipo que não se reproduz testando.
_buscas: set[asyncio.Task] = set()


def _pedir_titulos(room, *vids: str) -> None:
    """Descobre o título desses vídeos e conta pra sala, sem segurar ninguém.

    É `create_task` de propósito: quem chamou está no meio de trocar o
    vídeo, e esperar um GET pro YouTube atrasaria o play de todo mundo por
    causa de um texto. O vídeo entra na hora com o id; o título chega
    depois e o cliente troca o rótulo no lugar.
    """
    faltam = [v for v in vids if v and not titulos.conhecido(v)]
    if not faltam:
        return

    async def _correr():
        achados = await titulos.de_varios(faltam)
        if achados and room.users:
            await room.broadcast(ev("titulos", titulos=achados))

    t = asyncio.create_task(_correr())
    _buscas.add(t)
    t.add_done_callback(_buscas.discard)


def _titulos_conhecidos(*vids: str) -> dict[str, str]:
    """O que já está em cache, sem ir na rede. Pro `bemvindo`."""
    return {v: t for v in vids if v and (t := titulos.conhecido(v))}


async def _passar_adiante(room, quem: str) -> None:
    """Puxa o próximo da fila. Se a fila secou, para e avisa."""
    prox = room.proximo()
    if prox:
        room.video = Video(id=prox, tocando=True, por=quem)
        room.video.marcar(0.0, tocando=True)
        # `daFila` separa "fulano colocou um vídeo" de "entrou o próximo da
        # fila": quem apertou pular não colocou nada, a fila é que andou.
        await room.broadcast(ev("video_trocou", **room.video.estado(), daFila=True))
        await room.broadcast(ev("fila", fila=room.fila, por="", novo=""))
        _pedir_titulos(room, prox)
    else:
        room.video = Video()
        await room.broadcast(ev("video_trocou", **room.video.estado()))


@app.websocket("/ws/{code}")
async def ws_sala(ws: WebSocket, code: str):
    # Quem é você vem do cookie, não do que o cliente diz ser.
    conta = db.usuario_da_sessao(ws.cookies.get(COOKIE))
    if not conta:
        await ws.close(code=4001)
        return

    await ws.accept()
    room = manager.get(code)
    uid = uuid.uuid4().hex[:8]
    user: User | None = None

    try:
        if room.cheia:
            await ws.send_json(ev("erro", motivo="sala cheia"))
            return

        user = User(
            uid=uid,
            nick=conta["nick"],
            avatar=Avatar(**json.loads(conta["avatar"])),
            # Nasce na frente da sala, entre a TV e o sofá. Era 20..60,
            # que passou a cair atrás da televisão — e quem entrasse ali
            # apareceria coberto por ela, sem entender que já estava dentro
            # da sala. Andar pra trás do móvel e sumir tudo bem: foi
            # escolha de quem andou. Nascer escondido, não.
            pos=Pos(x=20 + (hash(uid) % 60), y=10 + (hash(uid[::-1]) % 22)),
            ws=ws,
            conta=conta["id"],
        )
        await room.add(user)

        await ws.send_json(ev(
            "bemvindo",
            eu=user.publico(),
            sala={"code": room.code, "musicas": room.musicas_ouvidas},
            gente=room.roster(),
            # Quem chega no meio do filme já entra no ponto certo, em vez
            # de começar do zero e ser puxado pela primeira batida.
            video=room.video.estado(),
            fila=room.fila,
            # Só o que já está em cache: quem acabou de entrar não pode
            # esperar um GET pro YouTube pra ver a sala aparecer. O que
            # faltar chega pelo `titulos` logo em seguida.
            titulos=_titulos_conhecidos(room.video.id, *room.fila),
            controle=room.controle_estado(),
        ))
        await room.broadcast(ev("entrou", user=user.publico()), exceto=uid)
        _pedir_titulos(room, room.video.id, *room.fila)

        while True:
            msg = parse(await ws.receive_json())
            if msg is None:
                continue

            if isinstance(msg, ChatIn):
                await room.broadcast(ev("chat", uid=uid, nick=user.nick, text=msg.text))

            elif isinstance(msg, MoveIn):
                user.pos = msg.pos
                await room.broadcast(
                    ev("moveu", uid=uid, pos=msg.pos.model_dump()), exceto=uid
                )

            elif isinstance(msg, AvatarIn):
                user.avatar = msg.avatar
                db.salvar_avatar(user.conta, msg.avatar.model_dump())
                await room.broadcast(
                    ev("trocou_avatar", uid=uid, avatar=msg.avatar.model_dump())
                )

            elif isinstance(msg, NickIn):
                antigo = user.nick
                if msg.nick == antigo:
                    continue
                try:
                    db.trocar_nick(user.conta, msg.nick)
                except db.ErroConta as e:
                    await ws.send_json(ev("aviso", texto=str(e)))
                    continue
                user.nick = msg.nick
                await room.broadcast(
                    ev("trocou_nick", uid=uid, nick=user.nick, antigo=antigo)
                )

            elif isinstance(msg, PingIn):
                await ws.send_json(ev("pong"))

            elif isinstance(msg, DigitandoIn):
                # Só pros outros: ninguém precisa ver o próprio balãozinho.
                await room.broadcast(
                    ev("digitando", uid=uid, ligado=msg.ligado), exceto=uid
                )

            elif isinstance(msg, BuzinaIn):
                pode, espera = room.buzinar()
                if not pode:
                    # Dizer quanto falta em vez de só "não": sem o número,
                    # quem foi barrado fica martelando o botão pra
                    # descobrir quando volta.
                    await ws.send_json(ev(
                        "aviso",
                        texto=f"a sala já buzinou demais — volta em {espera:.0f}s",
                    ))
                    continue
                # Vai pra todo mundo, inclusive quem buzinou: o retorno é o
                # que confirma que funcionou. Sem isso, quem apertou e não
                # ouviu nada (aba muda, som desligado) aperta de novo.
                await room.broadcast(ev(
                    "buzina", nick=user.nick, restam=room.buzinas_restantes()
                ))

            # ---------------------------------------------------- vídeo
            # Quem manda no player é quem está com o controle remoto — um
            # objeto da sala, não um cargo. Pôr na fila, porém, é livre:
            # é a parte divertida e coletiva, e barrar isso transformaria
            # o dono do controle em porteiro. O controle serve pra evitar
            # que duas pessoas briguem pelo play/pause, não pra decidir o
            # que a sala assiste.

            elif isinstance(msg, ControlePegarIn):
                if room.pegar_controle(uid):
                    await room.broadcast(ev(
                        "controle", **room.controle_estado(), nick=user.nick
                    ))
                else:
                    dono = room.users.get(room.controle)
                    await ws.send_json(ev(
                        "aviso",
                        texto=f"{dono.nick if dono else 'alguém'} está com o controle",
                    ))

            elif isinstance(msg, ControleSoltarIn):
                if room.soltar_controle(uid, user.pos):
                    await room.broadcast(ev(
                        "controle", **room.controle_estado(), nick=""
                    ))

            elif isinstance(msg, FilaPorIn):
                if not room.video.id:
                    # Nada tocando: entra direto, sem passar pela fila.
                    room.video = Video(id=msg.video, tocando=True, por=user.nick)
                    room.video.marcar(0.0, tocando=True)
                    await room.broadcast(ev("video_trocou", **room.video.estado()))
                else:
                    room.fila.append(msg.video)
                    await room.broadcast(ev(
                        "fila", fila=room.fila, por=user.nick, novo=msg.video
                    ))
                _pedir_titulos(room, msg.video)

            elif isinstance(msg, FilaTirarIn):
                if msg.video in room.fila:
                    room.fila.remove(msg.video)
                    await room.broadcast(ev("fila", fila=room.fila, por="", novo=""))

            elif isinstance(msg, VideoPorIn):
                # Trocar o que está tocando agora exige o controle.
                if not _pode(room, uid, ws):
                    continue
                room.video = Video(id=msg.video, tocando=True, por=user.nick)
                room.video.marcar(0.0, tocando=True)
                # Só `video_trocou`: ele já carrega o `por`, e o cliente
                # escreve a linha no chat. Mandar um "sistema" junto fazia
                # a mensagem aparecer duas vezes.
                await room.broadcast(ev("video_trocou", **room.video.estado()))
                _pedir_titulos(room, msg.video)

            elif isinstance(msg, VideoPularIn):
                if not _pode(room, uid, ws):
                    continue
                await _passar_adiante(room, user.nick)

            elif isinstance(msg, (VideoPlayIn, VideoPauseIn, VideoSeekIn)):
                if not room.video.id or not _pode(room, uid, ws):
                    continue
                tocando = not isinstance(msg, VideoPauseIn)
                room.video.marcar(msg.pos, tocando=tocando)
                # Vai pra todo mundo, inclusive quem mandou: assim quem
                # pediu também confirma pela verdade do servidor em vez de
                # confiar no próprio player.
                await room.broadcast(ev("video_estado", **room.video.estado()))

            elif isinstance(msg, VideoFimIn):
                # Chega uma vez por pessoa; a sala trata só a primeira.
                # Não exige controle: é o player avisando um fato, não
                # alguém mandando na sala.
                if room.video_acabou():
                    await room.broadcast(ev(
                        "video_estado",
                        **room.video.estado(),
                        musicas=room.musicas_ouvidas,
                    ))
                    await _passar_adiante(room, "")

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if user is not None:
            tinha_controle = room.controle == uid
            await room.remove(uid)   # derruba o controle no chão, se tinha
            await room.broadcast(ev("saiu", uid=uid, nick=user.nick))
            if tinha_controle:
                await room.broadcast(ev(
                    "controle", **room.controle_estado(), nick="",
                    caiu=user.nick,
                ))


class EstaticoSemCache(StaticFiles):
    """Arquivos estáticos que sempre revalidam antes de serem reusados.

    Sem isto o `StaticFiles` responde sem nenhum cabeçalho de cache, e o
    navegador decide por heurística quanto tempo guardar. Na prática isso
    significa que **um deploy pode não chegar em quem já visitou o site**:
    a pessoa continua com o JS antigo e o servidor novo, que é a receita
    de bug impossível de reproduzir ("aqui funciona").

    Custou uma investigação pra achar: um `export` novo do `video.js`
    simplesmente não existia no navegador, embora o servidor já o
    estivesse entregando.

    `no-cache` não quer dizer "não guarde" — quer dizer "guarde, mas
    pergunte antes de usar". Com o ETag que o StaticFiles já manda, a
    pergunta volta 304 sem corpo, então o custo é um ida-e-volta curto e
    não o arquivo inteiro. Pra um site deste tamanho é troca barata pela
    garantia de que o que está no ar é o que a pessoa vê.
    """

    def file_response(self, *args, **kwargs):
        resp = super().file_response(*args, **kwargs)
        resp.headers["Cache-Control"] = "no-cache"
        return resp


app.mount("/", EstaticoSemCache(directory=ESTATICO), name="static")

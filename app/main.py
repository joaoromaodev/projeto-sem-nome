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

from . import db
from .protocol import (Avatar, AvatarIn, ChatIn, MoveIn, NickIn, PingIn, Pos,
                       ev, limpar_nick, parse)
from .rooms import User, manager

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
    faxina = asyncio.create_task(_housekeeping())
    yield
    faxina.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await faxina


async def _housekeeping():
    while True:
        await asyncio.sleep(600)
        manager.limpar_vazias()
        db.limpar_sessoes_velhas()


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
            pos=Pos(x=20 + (hash(uid) % 60), y=20 + (hash(uid[::-1]) % 40)),
            ws=ws,
            conta=conta["id"],
        )
        await room.add(user)

        await ws.send_json(ev(
            "bemvindo",
            eu=user.publico(),
            sala={"code": room.code, "musicas": room.musicas_ouvidas},
            gente=room.roster(),
        ))
        await room.broadcast(ev("entrou", user=user.publico()), exceto=uid)

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

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if user is not None:
            await room.remove(uid)
            await room.broadcast(ev("saiu", uid=uid, nick=user.nick))


app.mount("/", StaticFiles(directory=ESTATICO), name="static")

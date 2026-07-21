"""Título dos vídeos, sem chave de API.

O plano previa a YouTube Data API pra isto, que exigiria criar projeto no
Google Cloud, gerar chave, guardá-la como secret no Fly e viver com cota
diária. O **oEmbed** do próprio YouTube devolve o título por uma URL
pública, sem nada disso — e sem cota. Menos peça pra manter.

O preço é que o oEmbed não responde por vídeo privado, apagado ou com
embed bloqueado: nesses casos o título sai vazio e o cliente mostra o id,
que é exatamente o comportamento de hoje. Degrada pro que já existia.

Quem chama nunca espera por isto: o vídeo começa na hora e o título chega
depois, numa mensagem própria. Bloquear o play num GET pra fora seria
trocar sincronia — a coisa difícil do projeto — por enfeite.
"""

import asyncio
import json
import urllib.error
import urllib.parse
import urllib.request

OEMBED = "https://www.youtube.com/oembed"
TIMEOUT_S = 4.0

# Título de vídeo não muda; cabe guardar pra sempre. O teto existe só pra
# uma sala que rode a noite inteira não virar vazamento de memória lento.
MAX_CACHE = 1000

_cache: dict[str, str] = {}
# Duas pessoas põem o mesmo vídeo na fila quase junto — sem isto, sairiam
# duas buscas iguais. Aqui a segunda pega a tarefa da primeira.
_em_curso: dict[str, asyncio.Task] = {}


def conhecido(vid: str) -> str:
    """Título já em cache, sem ir na rede. Vazio se ainda não sabemos."""
    return _cache.get(vid, "")


def _buscar(vid: str) -> str:
    """Roda em thread: `urllib` é bloqueante."""
    alvo = f"https://www.youtube.com/watch?v={vid}"
    url = f"{OEMBED}?{urllib.parse.urlencode({'url': alvo, 'format': 'json'})}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "sala/1.0"})
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
            dados = json.loads(r.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError, TimeoutError):
        # Vídeo privado, apagado, sem embed, ou internet ruim. Sem título,
        # o cliente cai no id — que é o que ele já mostrava antes.
        return ""
    titulo = str(dados.get("title") or "").strip()
    return titulo[:120]


async def resolver(vid: str) -> str:
    """Título do vídeo. Vazio se não deu."""
    if vid in _cache:
        return _cache[vid]

    tarefa = _em_curso.get(vid)
    if tarefa is None:
        tarefa = asyncio.create_task(asyncio.to_thread(_buscar, vid))
        _em_curso[vid] = tarefa

    try:
        titulo = await asyncio.shield(tarefa)
    except asyncio.CancelledError:
        raise
    except Exception:
        titulo = ""
    finally:
        _em_curso.pop(vid, None)

    # Falha entra no cache também: sem isto, um vídeo apagado na fila
    # renderia uma busca nova a cada repintura da lista.
    if len(_cache) >= MAX_CACHE:
        for velho in list(_cache)[: MAX_CACHE // 2]:
            del _cache[velho]
    _cache[vid] = titulo
    return titulo


async def de_varios(vids: list[str]) -> dict[str, str]:
    """Resolve uma lista em paralelo. Só volta o que tem título."""
    unicos = [v for v in dict.fromkeys(vids) if v]
    if not unicos:
        return {}
    achados = await asyncio.gather(
        *(resolver(v) for v in unicos), return_exceptions=True
    )
    return {
        v: t for v, t in zip(unicos, achados)
        if isinstance(t, str) and t
    }

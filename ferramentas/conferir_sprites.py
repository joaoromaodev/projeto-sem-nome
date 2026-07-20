"""Confere as camadas do boneco antes de entrarem no jogo.

Roda com:  python ferramentas/conferir_sprites.py

Olha tudo que está em static/sprites/ e aponta os problemas que só aparecem
depois, quando já é caro consertar:

  - camadas com tamanho diferente umas das outras
  - fundo branco em vez de transparente
  - suavização (anti-aliasing) — o erro de exportação mais comum
  - peça fora do alinhamento das outras
  - paleta grande demais pra recolorir bem
"""

import sys
from collections import Counter
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
SPRITES = RAIZ / "static" / "sprites"

# Camadas, na ordem em que são empilhadas (de baixo pra cima).
CAMADAS = ["pele", "pernas", "sapatos", "torso", "cabelo"]

# Acima disso, recolorir fica ruim: não dá pra mapear uma rampa clara.
CORES_IDEAL = 6


def analisar(caminho: Path) -> dict:
    img = Image.open(caminho).convert("RGBA")
    px = img.load()
    L, A = img.size

    opacos = 0
    meio_transp = 0          # 0 < alpha < 255 → sinal de anti-aliasing
    cores = Counter()
    x0, y0, x1, y1 = L, A, -1, -1

    for y in range(A):
        for x in range(L):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if a < 255:
                meio_transp += 1
            opacos += 1
            cores[(r, g, b)] += 1
            x0, y0 = min(x0, x), min(y0, y)
            x1, y1 = max(x1, x), max(y1, y)

    return {
        "arquivo": caminho.name,
        "tam": (L, A),
        "opacos": opacos,
        "meio_transp": meio_transp,
        "cores": cores,
        "caixa": (x0, y0, x1, y1) if opacos else None,
    }


def achar_arquivos() -> list[Path]:
    if not SPRITES.exists():
        return []
    return sorted(p for p in SPRITES.rglob("*.png"))


def camada_de(nome: str) -> str | None:
    base = nome.lower()
    for c in CAMADAS:
        if base.startswith(c):
            return c
    return None


def main() -> int:
    arquivos = achar_arquivos()
    if not arquivos:
        print(f"Nenhum .png em {SPRITES.relative_to(RAIZ)}/")
        print("\nColoque as camadas lá com estes nomes:")
        for c in CAMADAS:
            exemplo = f"{c}.png" if c == "pele" else f"{c}-<nome>.png"
            print(f"  {exemplo}")
        print("\nEx.: pele.png, cabelo-moicano.png, torso-jaqueta.png")
        return 0

    print(f"{len(arquivos)} arquivo(s) em {SPRITES.relative_to(RAIZ)}/\n")

    infos = [analisar(p) for p in arquivos]
    erros, avisos = [], []

    # ---- tamanho: todas as camadas têm que bater ----
    tamanhos = Counter(i["tam"] for i in infos)
    padrao = tamanhos.most_common(1)[0][0]
    print(f"Tamanho padrão detectado: {padrao[0]} x {padrao[1]}")
    if len(tamanhos) > 1:
        erros.append("Nem todas as camadas têm o mesmo tamanho:")
        for i in infos:
            if i["tam"] != padrao:
                erros.append(f"    {i['arquivo']}: {i['tam'][0]}x{i['tam'][1]}"
                             f"  (esperado {padrao[0]}x{padrao[1]})")

    # ---- alinhamento: onde a peça começa e termina ----
    pele = next((i for i in infos if camada_de(i["arquivo"]) == "pele"), None)

    print()
    print(f"{'arquivo':<26} {'tam':>9} {'pixels':>7} {'cores':>6}  caixa (x0,y0)-(x1,y1)")
    print("-" * 78)
    for i in infos:
        cx = f"{i['caixa'][0]},{i['caixa'][1]}-{i['caixa'][2]},{i['caixa'][3]}" if i["caixa"] else "vazio"
        print(f"{i['arquivo']:<26} {i['tam'][0]:>4}x{i['tam'][1]:<4} "
              f"{i['opacos']:>7} {len(i['cores']):>6}  {cx}")

        if i["meio_transp"]:
            erros.append(
                f"{i['arquivo']}: {i['meio_transp']} pixel(s) semitransparente(s) — "
                "é suavização. Desligue o anti-aliasing e exporte de novo.")

        if len(i["cores"]) > CORES_IDEAL:
            avisos.append(
                f"{i['arquivo']}: {len(i['cores'])} cores. Acima de {CORES_IDEAL} "
                "a recoloração fica imprecisa — tente 2 ou 3 tons por peça.")

        # branco encostando na borda quase sempre é fundo que ficou opaco
        if i["caixa"] and i["caixa"][:2] == (0, 0) and i["opacos"] > 0.9 * i["tam"][0] * i["tam"][1]:
            erros.append(f"{i['arquivo']}: quase tudo opaco — o fundo não ficou "
                         "transparente?")

    # ---- pés no mesmo lugar ----
    if pele and pele["caixa"]:
        base_pe = pele["caixa"][3]
        print(f"\nPé da 'pele' na linha y={base_pe}")
        for i in infos:
            c = camada_de(i["arquivo"])
            if c in ("sapatos", "pernas") and i["caixa"]:
                if abs(i["caixa"][3] - base_pe) > 4:
                    avisos.append(
                        f"{i['arquivo']}: termina em y={i['caixa'][3]}, "
                        f"longe do pé da pele (y={base_pe}). Vai flutuar ou afundar.")

    # ---- camadas que faltam ----
    presentes = {camada_de(i["arquivo"]) for i in infos}
    faltando = [c for c in CAMADAS if c not in presentes]
    if faltando:
        print(f"\nAinda não tem: {', '.join(faltando)}")

    # ---- veredito ----
    print()
    for e in erros:
        print(f"ERRO   {e}")
    for a in avisos:
        print(f"aviso  {a}")

    if not erros and not avisos:
        print("Tudo certo. Pode mandar ver.")
    elif not erros:
        print("\nNenhum erro — os avisos são só sugestões.")

    return 1 if erros else 0


if __name__ == "__main__":
    sys.exit(main())

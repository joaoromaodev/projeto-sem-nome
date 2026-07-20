"""Lê o template editado de volta e imprime as peças em código.

Roda com:  python ferramentas/ler_template.py [caminho.png]

É o caminho de volta do gerar_template.py. Quando você me devolver o PNG
editado, é isto que roda: a saída dá pra colar direto no avatar.js.

Também serve de conferência: rodar em cima do template não editado tem que
devolver exatamente o que está no código hoje.
"""

import sys
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
LARG, ALT = 8, 14
COLS = 4

# cor -> letra. O inverso do CODIGO do gerar_template.py.
DE_COR = {
    (0, 0, 0): "K",
    (255, 0, 255): "S",
    (255, 255, 255): "W",
    (0, 255, 0): "B",
    (0, 0, 255): "P",
    (255, 255, 0): "H",
}

NOMES = [
    "CABECA",
    "TORSO medio", "TORSO esguio", "TORSO largo",
    "BAIXO calca parado", "BAIXO calca andando",
    "BAIXO saia parado", "BAIXO saia andando",
    "BAIXO vestido parado", "BAIXO vestido andando",
    "CABELO curto", "CABELO comprido", "CABELO moicano",
    "CABELO franjao", "CABELO coque", "CABELO careca",
]


def ler(caminho: Path):
    img = Image.open(caminho).convert("RGBA")
    px = img.load()

    esperado_l = COLS * (LARG + 1) + 1
    linhas_n = (len(NOMES) + COLS - 1) // COLS
    esperado_a = linhas_n * (ALT + 1) + 1
    if img.size != (esperado_l, esperado_a):
        print(f"AVISO: esperava {esperado_l}x{esperado_a}, veio {img.size[0]}x{img.size[1]}")
        print("Se você mudou o tamanho do sprite, me avise — mexe no renderizador.\n")

    problemas = []
    pecas = []

    for i, nome in enumerate(NOMES):
        cx = (i % COLS) * (LARG + 1) + 1
        cy = (i // COLS) * (ALT + 1) + 1

        linhas = []
        for y in range(ALT):
            linha = ""
            for x in range(LARG):
                if cx + x >= img.width or cy + y >= img.height:
                    linha += "."
                    continue
                r, g, b, a = px[cx + x, cy + y]
                if a < 128:
                    linha += "."
                    continue
                letra = DE_COR.get((r, g, b))
                if letra is None:
                    problemas.append(
                        f"  {nome} @ ({x},{y}): #{r:02x}{g:02x}{b:02x} "
                        f"não é uma cor-código")
                    linha += "."
                else:
                    linha += letra
            linhas.append(linha)

        # corta as linhas vazias de cima e de baixo, e guarda onde começa
        cheias = [n for n, l in enumerate(linhas) if set(l) != {"."}]
        if not cheias:
            pecas.append((nome, 0, []))
            continue
        topo, base = cheias[0], cheias[-1]
        pecas.append((nome, topo, linhas[topo:base + 1]))

    return pecas, problemas


def main():
    caminho = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "template" / "boneco-template.png"
    if not caminho.exists():
        print(f"não achei {caminho}")
        return 1

    pecas, problemas = ler(caminho)

    for nome, topo, linhas in pecas:
        print(f"// {nome}   (começa na linha {topo})")
        if not linhas:
            print("//   vazia\n")
            continue
        print("[" + ", ".join(f'"{l}"' for l in linhas) + "],\n")

    if problemas:
        print(f"\n{len(problemas)} pixel(s) com cor fora do padrão:")
        for p in problemas[:20]:
            print(p)
        if len(problemas) > 20:
            print(f"  ... e mais {len(problemas) - 20}")
        print("\nEsses pixels viram transparente. Confira a legenda em COMO-EDITAR.md.")
        return 1

    print("\nTodas as cores conferem.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

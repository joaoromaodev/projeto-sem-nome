"""Desenha uma jukebox de andaime pra `static/moveis/jukebox.png`.

ISTO É PLACEHOLDER, igual ao que `gerar_placeholders.py` faz com as camadas
do boneco. A arte definitiva dos móveis é do autor do projeto; esta existe só
pra a sala ficar testável enquanto a de verdade não chega.

**Quando a arte real chegar, é sobrescrever `static/moveis/jukebox.png` e
apagar este script — nenhum código muda.** O CSS lê largura e altura do
arquivo por variável (`--juke-l` / `--juke-a`), então trocar por uma arte de
outro tamanho é mexer nesses dois números e mais nada.

Regras que a arte definitiva precisa respeitar:

  - **Resolução nativa, desenhada em 1×.** Móvel desenha em 1× e boneco em
    2× (ver a decisão travada "Móvel desenha em 1×, boneco em 2×"). Uma
    jukebox de ~60px de altura lê como do tamanho de uma pessoa sentada; em
    2× ela ficaria mais alta que o boneco em pé.
  - **Sem suavização.** Pixel inteiro, sem meio-tom no contorno, senão a
    ampliação borra.
  - **Fundo transparente** em volta da silhueta.
  - **Não precisa de buraco transparente.** Ao contrário da TV, aqui o
    vídeo não aparece — ele toca escondido atrás. A frente pode ser opaca.

Rodar:  python ferramentas/gerar_jukebox.py
"""

import math
from pathlib import Path

from PIL import Image

SAIDA = Path(__file__).resolve().parent.parent / "static" / "moveis" / "jukebox.png"

L, A = 48, 62

# Paleta Dark Y2K — a mesma direção de arte da Etapa 3: quase-preto
# arroxeado, magenta neon, ciano.
CONTORNO = (10, 8, 16, 255)
CORPO = (42, 28, 56, 255)
CORPO_LUZ = (61, 42, 80, 255)
CORPO_SOMBRA = (26, 18, 32, 255)
NEON = (255, 45, 149, 255)
NEON_FRACO = (150, 26, 88, 255)
VISOR = (34, 224, 224, 255)
VISOR_FUNDO = (12, 60, 66, 255)
GRADE = (15, 12, 22, 255)
GRADE_RIPA = (74, 58, 94, 255)
BOTAO = (255, 209, 102, 255)
VAZIO = (0, 0, 0, 0)


def main() -> None:
    im = Image.new("RGBA", (L, A), VAZIO)
    px = im.load()

    def barra(x0, y0, x1, y1, cor):
        for y in range(max(0, y0), min(A, y1 + 1)):
            for x in range(max(0, x0), min(L, x1 + 1)):
                px[x, y] = cor

    # --- silhueta: retângulo com o topo em arco (a cara de jukebox) ---
    cx, arco = (L - 1) / 2, 14.0
    topo = [0] * L
    for x in range(L):
        d = (x - cx) / cx
        topo[x] = int(round(arco - arco * math.sqrt(max(0.0, 1 - d * d))))

    for x in range(L):
        for y in range(topo[x], A):
            px[x, y] = CORPO

    # sombreado: a luz vem da esquerda, então a direita escurece
    for x in range(L):
        for y in range(topo[x], A):
            if x < 6:
                px[x, y] = CORPO_LUZ
            elif x > L - 7:
                px[x, y] = CORPO_SOMBRA

    # --- tubos de neon nas laterais, do arco até a base ---
    barra(2, 10, 3, A - 7, NEON)
    barra(L - 4, 10, L - 3, A - 7, NEON_FRACO)

    # --- visor: onde a arte definitiva pode mostrar o que está tocando ---
    barra(8, 18, L - 9, 29, VISOR_FUNDO)
    barra(9, 19, L - 10, 28, VISOR)
    # duas "linhas de texto" só pra sugerir informação
    barra(11, 21, L - 14, 22, VISOR_FUNDO)
    barra(11, 25, L - 18, 26, VISOR_FUNDO)

    # --- grade do alto-falante ---
    barra(7, 33, L - 8, 47, GRADE)
    for y in range(35, 47, 3):
        barra(9, y, L - 10, y, GRADE_RIPA)

    # --- fileira de botões ---
    for i in range(5):
        x = 9 + i * 6
        barra(x, 50, x + 2, 52, BOTAO)

    # --- pés ---
    barra(5, A - 4, 12, A - 1, CORPO_SOMBRA)
    barra(L - 13, A - 4, L - 6, A - 1, CORPO_SOMBRA)
    barra(13, A - 4, L - 14, A - 1, VAZIO)

    # --- contorno preto de 1px em volta de tudo que é opaco ---
    opaco = {(x, y) for y in range(A) for x in range(L) if px[x, y][3] > 0}
    borda = set()
    for (x, y) in opaco:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in opaco:
                borda.add((x, y))
                break
    for (x, y) in borda:
        px[x, y] = CONTORNO

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    im.save(SAIDA)

    cores = len({px[x, y] for y in range(A) for x in range(L) if px[x, y][3] > 0})
    print(f"{SAIDA}  {L}x{A}  {cores} cores  (andaime — sobrescrever com a arte de verdade)")


if __name__ == "__main__":
    main()

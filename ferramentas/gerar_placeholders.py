"""Gera camadas provisórias em 32x48 pra o renderizador ter o que mostrar.

Roda com:  python ferramentas/gerar_placeholders.py

Isto NÃO é a arte final — é andaime. Serve pra o sistema de camadas,
recoloração e animação ficar testável antes dos sprites de verdade
chegarem. Quando a arte real entrar, é só sobrescrever os arquivos em
static/sprites/ e apagar este script.

Cada peça é desenhada em tons de UMA cor. A recoloração no navegador
preserva a claridade de cada pixel e troca só o matiz — então o sombreado
sobrevive à troca de cor.
"""

from pathlib import Path
from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "static" / "sprites"

L, A = 32, 48
MEIO = L // 2

CONTORNO = (26, 20, 30, 255)     # fica preto na recoloração (abaixo do limiar)

# Três tons da mesma cor: o renderizador troca o matiz e mantém a claridade.
def tons(base):
    r, g, b = base
    claro = (min(255, int(r * 1.25)), min(255, int(g * 1.25)), min(255, int(b * 1.25)), 255)
    medio = (r, g, b, 255)
    escuro = (int(r * .72), int(g * .72), int(b * .72), 255)
    return claro, medio, escuro


def nova():
    return Image.new("RGBA", (L, A), (0, 0, 0, 0))


def contornar(img, cor=CONTORNO):
    """Põe contorno em volta do que já está desenhado."""
    px = img.load()
    marcas = []
    for y in range(A):
        for x in range(L):
            if px[x, y][3] != 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                vx, vy = x + dx, y + dy
                if 0 <= vx < L and 0 <= vy < A and px[vx, vy][3] != 0:
                    marcas.append((x, y))
                    break
    for x, y in marcas:
        px[x, y] = cor
    return img


# ------------------------------------------------------------------ pele

def pele():
    """Cabeça, pescoço, braços e mãos. Os braços moram aqui porque a camisa
    é desenhada por cima — assim o comprimento da manga é decisão da camisa."""
    claro, medio, escuro = tons((235, 190, 150))
    img = nova()
    d = ImageDraw.Draw(img)

    d.ellipse([8, 3, 23, 19], fill=medio)          # cabeça
    d.rectangle([10, 4, 21, 10], fill=claro)       # testa mais clara
    d.rectangle([13, 19, 18, 22], fill=escuro)     # pescoço

    d.rectangle([7, 24, 9, 34], fill=medio)        # braço esquerdo
    d.rectangle([22, 24, 24, 34], fill=medio)      # braço direito
    d.rectangle([7, 34, 9, 36], fill=claro)        # mão
    d.rectangle([22, 34, 24, 36], fill=claro)

    contornar(img)

    # olhos por último, pra o contorno não os comer
    p = img.load()
    for ox in (12, 18):
        for dx in range(2):
            for dy in range(3):
                p[ox + dx, 11 + dy] = (255, 255, 255, 255)
        p[ox + 1, 12] = (30, 30, 40, 255)
    return img


# ------------------------------------------------------------------ pernas

def pernas_calca():
    claro, medio, escuro = tons((70, 84, 130))
    img = nova()
    d = ImageDraw.Draw(img)
    d.rectangle([11, 34, 15, 44], fill=medio)
    d.rectangle([16, 34, 20, 44], fill=medio)
    d.rectangle([11, 34, 20, 36], fill=claro)      # cós
    d.rectangle([15, 34, 16, 44], fill=escuro)     # vinco central
    return contornar(img)


def pernas_saia():
    claro, medio, escuro = tons((70, 84, 130))
    img = nova()
    d = ImageDraw.Draw(img)
    d.polygon([(12, 34), (19, 34), (23, 42), (8, 42)], fill=medio)
    d.rectangle([12, 34, 19, 36], fill=claro)
    d.rectangle([12, 42, 14, 44], fill=escuro)     # perna aparecendo
    d.rectangle([17, 42, 19, 44], fill=escuro)
    return contornar(img)


# ------------------------------------------------------------------ sapatos

def sapatos_tenis():
    claro, medio, escuro = tons((60, 60, 70))
    img = nova()
    d = ImageDraw.Draw(img)
    d.rectangle([10, 44, 15, 47], fill=medio)
    d.rectangle([16, 44, 21, 47], fill=medio)
    d.rectangle([10, 46, 21, 47], fill=claro)      # sola
    return contornar(img)


def sapatos_coturno():
    claro, medio, escuro = tons((60, 60, 70))
    img = nova()
    d = ImageDraw.Draw(img)
    d.rectangle([10, 41, 15, 47], fill=medio)
    d.rectangle([16, 41, 21, 47], fill=medio)
    d.rectangle([10, 41, 21, 43], fill=escuro)     # cano
    d.rectangle([10, 46, 21, 47], fill=claro)
    return contornar(img)


# ------------------------------------------------------------------ torso

def torso_camiseta():
    """Manga curta: cobre o ombro e deixa o braço aparecer."""
    claro, medio, escuro = tons((180, 50, 60))
    img = nova()
    d = ImageDraw.Draw(img)
    d.rectangle([10, 22, 21, 35], fill=medio)
    d.rectangle([10, 22, 21, 25], fill=claro)      # peito
    d.rectangle([7, 23, 9, 28], fill=medio)        # manga curta
    d.rectangle([22, 23, 24, 28], fill=medio)
    d.rectangle([10, 33, 21, 35], fill=escuro)     # barra
    return contornar(img)


def torso_jaqueta():
    """Manga longa: cobre o braço inteiro."""
    claro, medio, escuro = tons((180, 50, 60))
    img = nova()
    d = ImageDraw.Draw(img)
    d.rectangle([10, 22, 21, 36], fill=medio)
    d.rectangle([7, 23, 9, 34], fill=medio)        # manga longa
    d.rectangle([22, 23, 24, 34], fill=medio)
    d.rectangle([15, 22, 16, 36], fill=escuro)     # zíper
    d.rectangle([10, 22, 21, 24], fill=claro)      # gola
    return contornar(img)


def torso_regata():
    claro, medio, escuro = tons((180, 50, 60))
    img = nova()
    d = ImageDraw.Draw(img)
    d.rectangle([11, 24, 20, 35], fill=medio)
    d.rectangle([11, 24, 20, 26], fill=claro)
    d.rectangle([11, 33, 20, 35], fill=escuro)
    return contornar(img)


# ------------------------------------------------------------------ cabelo

def cabelo_curto():
    claro, medio, escuro = tons((70, 45, 30))
    img = nova()
    d = ImageDraw.Draw(img)
    d.ellipse([7, 2, 24, 14], fill=medio)
    d.rectangle([7, 9, 24, 14], fill=(0, 0, 0, 0))
    d.ellipse([7, 2, 24, 11], fill=medio)
    d.rectangle([9, 3, 20, 6], fill=claro)
    return contornar(img)


def cabelo_longo():
    claro, medio, escuro = tons((70, 45, 30))
    img = nova()
    d = ImageDraw.Draw(img)
    d.ellipse([6, 2, 25, 12], fill=medio)
    d.rectangle([6, 8, 9, 30], fill=medio)         # mecha esquerda
    d.rectangle([22, 8, 25, 30], fill=medio)       # mecha direita
    d.rectangle([6, 26, 9, 30], fill=escuro)
    d.rectangle([22, 26, 25, 30], fill=escuro)
    d.rectangle([9, 3, 20, 6], fill=claro)
    return contornar(img)


def cabelo_moicano():
    claro, medio, escuro = tons((70, 45, 30))
    img = nova()
    d = ImageDraw.Draw(img)
    d.polygon([(14, 0), (17, 0), (19, 10), (12, 10)], fill=medio)
    d.rectangle([14, 1, 16, 5], fill=claro)
    return contornar(img)


def cabelo_careca():
    return nova()   # existe pra "sem cabelo" ser uma escolha


PECAS = {
    "pele":    {"": pele},
    "pernas":  {"calca": pernas_calca, "saia": pernas_saia},
    "sapatos": {"tenis": sapatos_tenis, "coturno": sapatos_coturno},
    "torso":   {"camiseta": torso_camiseta, "jaqueta": torso_jaqueta,
                "regata": torso_regata},
    "cabelo":  {"curto": cabelo_curto, "longo": cabelo_longo,
                "moicano": cabelo_moicano, "careca": cabelo_careca},
}


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    n = 0
    for camada, variantes in PECAS.items():
        for nome, fn in variantes.items():
            arquivo = f"{camada}.png" if not nome else f"{camada}-{nome}.png"
            fn().save(SAIDA / arquivo)
            print(f"  {arquivo}")
            n += 1
    print(f"\n{n} camadas provisórias em {SAIDA.relative_to(RAIZ)}/  ({L}x{A})")
    print("Substitua pelos sprites de verdade quando a arte ficar pronta.")


if __name__ == "__main__":
    main()

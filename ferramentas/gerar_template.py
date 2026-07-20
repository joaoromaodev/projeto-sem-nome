"""Gera o template de edição do boneco a partir do que está no avatar.js.

Roda com:  python ferramentas/gerar_template.py

Sai em template/:
  boneco-template.png   1:1, é este que você edita e me devolve
  boneco-guia.png       ampliado e rotulado, só pra consultar

O template usa CORES-CÓDIGO, não as cores finais. Cada cor diz o papel
daquele pixel: magenta é "pele", verde é "camisa", e assim por diante. É
isso que deixa o mesmo desenho servir pra qualquer combinação de cores que
o usuário escolher depois.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "template"

LARG, ALT = 8, 14

# ---- cores-código. Escolhidas por serem berrantes e nunca aparecerem
#      numa arte de verdade, então não tem como confundir. ----
CODIGO = {
    "K": (0, 0, 0, 255),          # contorno — fica preto, não recolore
    "S": (255, 0, 255, 255),      # pele
    "W": (255, 255, 255, 255),    # olho / branco fixo
    "B": (0, 255, 0, 255),        # camisa (parte de cima)
    "P": (0, 0, 255, 255),        # calça / saia (parte de baixo)
    "H": (255, 255, 0, 255),      # cabelo
    ".": (0, 0, 0, 0),            # vazio (transparente)
}

LEGENDA = [
    ("K", "contorno", "fica preto sempre"),
    ("S", "pele", "o usuário escolhe a cor"),
    ("W", "olho", "branco fixo"),
    ("B", "camisa", "o usuário escolhe a cor"),
    ("P", "baixo", "calça/saia — o usuário escolhe"),
    ("H", "cabelo", "o usuário escolhe a cor"),
    (".", "vazio", "transparente"),
]

# ---------------------------------------------------------------- sprites
# Copiados de static/js/avatar.js. Se mudar lá, rode este script de novo.

CABECA = [
    "..KKKK..", ".KSSSSK.", "KSSSSSSK", "KSSSSSSK",
    "KSWSSWSK", "KSSSSSSK", ".KSSSSK.",
]

TORSOS = {
    "medio":  [".KBBBBK.", "KBBBBBBK", "SBBBBBBS", "KBBBBBBK"],
    "esguio": [".KBBBBK.", ".KBBBBK.", "SKBBBBKS", ".KBBBBK."],
    "largo":  ["KKBBBBKK", "KBBBBBBK", "SBBBBBBS", "KBBBBBBK"],
}

BAIXOS = {
    "calca":    ([".KPPPPK.", ".KPP.PPK", ".KK..KK."],
                 [".KPPPPK.", ".KPPPPK.", "KK....KK"]),
    "saia":     ([".KPPPPK.", "KPPPPPPK", ".KS..SK."],
                 [".KPPPPK.", "KPPPPPPK", "KS....SK"]),
    "vestido":  ([".KBBBBK.", "KBBBBBBK", ".KS..SK."],
                 [".KBBBBK.", "KBBBBBBK", "KS....SK"]),
}

CABELOS = {
    "curto":    ["..HHHH..", ".HHHHHH.", ".H....H."],
    "comprido": ["..HHHH..", ".HHHHHH.", "HHH..HHH", "HH....HH", "H......H", "H......H"],
    "moicano":  ["...HH...", "..HHHH..", "..H..H.."],
    "franjao":  ["..HHHH..", ".HHHHHH.", ".HHHHHH.", ".H....H."],
    "coque":    ["...HH...", "..HHHH..", ".HHHHHH.", ".H....H."],
    "careca":   ["..KKKK..", ".K....K."],
}


def celulas():
    """Cada célula é um quadro 8x14 com só a parte dela preenchida.

    Altura cheia mesmo nas peças curtas: assim você enxerga onde a peça
    encaixa no boneco inteiro, em vez de adivinhar.
    """
    itens = []

    itens.append(("CABEÇA", "linhas 0-6", 0, CABECA))

    for nome, linhas in TORSOS.items():
        itens.append((f"TORSO {nome}", "linhas 7-10", 7, linhas))

    for nome, (parado, passo) in BAIXOS.items():
        # rótulo curto de propósito: nome comprido invadia a célula vizinha
        itens.append((f"BAIXO {nome}", "parado · linhas 11-13", 11, parado))
        itens.append((f"BAIXO {nome}", "ANDANDO · linhas 11-13", 11, passo))

    for nome, linhas in CABELOS.items():
        itens.append((f"CABELO {nome}", "por cima, da linha 0", 0, linhas))

    return itens


def desenhar_celula(linhas, topo):
    img = Image.new("RGBA", (LARG, ALT), (0, 0, 0, 0))
    px = img.load()
    for y, linha in enumerate(linhas):
        for x, c in enumerate(linha):
            if topo + y >= ALT:
                continue
            px[x, topo + y] = CODIGO[c]
    return img


# ---------------------------------------------------------------- 1:1

def gerar_template(itens):
    """Folha 1:1, com 1px de separação. É o arquivo que você edita."""
    cols = 4
    linhas_n = (len(itens) + cols - 1) // cols
    larg = cols * (LARG + 1) + 1
    alt = linhas_n * (ALT + 1) + 1

    # fundo levemente visível pra dar pra ver as células no editor
    folha = Image.new("RGBA", (larg, alt), (40, 40, 40, 255))

    for i, (_, _, topo, linhas) in enumerate(itens):
        cx = (i % cols) * (LARG + 1) + 1
        cy = (i // cols) * (ALT + 1) + 1
        folha.paste(desenhar_celula(linhas, topo), (cx, cy))

    return folha


# ---------------------------------------------------------------- guia

def fonte(tam):
    for nome in ("tahoma.ttf", "arial.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(nome, tam)
        except OSError:
            continue
    return ImageFont.load_default()


def gerar_guia(itens):
    esc = 14
    cw, ch = LARG * esc, ALT * esc
    rot_h, gap = 34, 18
    cols = 8
    linhas_n = (len(itens) + cols - 1) // cols

    larg = cols * (cw + gap) + gap
    legenda_h = 30 + len(LEGENDA) * 26
    alt = 74 + linhas_n * (ch + rot_h + gap) + legenda_h

    img = Image.new("RGB", (larg, alt), (232, 232, 232))
    d = ImageDraw.Draw(img)
    f_tit = fonte(24)
    f_rot = fonte(14)
    f_sub = fonte(12)

    d.text((gap, 18), "Template do boneco — 8 x 14 pixels por peça",
           font=f_tit, fill=(0, 0, 60))
    d.text((gap, 48), "As cores abaixo são CÓDIGOS, não a cor final. Use exatamente estas.",
           font=f_sub, fill=(70, 70, 70))

    y0 = 74
    for i, (nome, sub, topo, linhas) in enumerate(itens):
        cx = (i % cols) * (cw + gap) + gap
        cy = y0 + (i // cols) * (ch + rot_h + gap)

        d.text((cx, cy), nome, font=f_rot, fill=(0, 0, 0))
        d.text((cx, cy + 16), sub, font=f_sub, fill=(110, 110, 110))

        cel = desenhar_celula(linhas, topo).resize((cw, ch), Image.NEAREST)
        # xadrez pra enxergar o transparente
        fundo = Image.new("RGB", (cw, ch), (255, 255, 255))
        dd = ImageDraw.Draw(fundo)
        for gy in range(ALT):
            for gx in range(LARG):
                if (gx + gy) % 2:
                    dd.rectangle([gx*esc, gy*esc, (gx+1)*esc, (gy+1)*esc],
                                 fill=(220, 220, 220))
        fundo.paste(cel, (0, 0), cel)
        img.paste(fundo, (cx, cy + rot_h))

        # grade
        gd = ImageDraw.Draw(img)
        for gx in range(LARG + 1):
            gd.line([(cx + gx*esc, cy + rot_h), (cx + gx*esc, cy + rot_h + ch)],
                    fill=(160, 160, 160))
        for gy in range(ALT + 1):
            gd.line([(cx, cy + rot_h + gy*esc), (cx + cw, cy + rot_h + gy*esc)],
                    fill=(160, 160, 160))

    # legenda
    ly = y0 + linhas_n * (ch + rot_h + gap) + 6
    d.text((gap, ly), "Legenda das cores-código:", font=f_rot, fill=(0, 0, 60))
    ly += 24
    for letra, papel, obs in LEGENDA:
        cor = CODIGO[letra]
        if cor[3] == 0:
            d.rectangle([gap, ly, gap + 18, ly + 18], outline=(120, 120, 120))
            d.line([(gap, ly + 18), (gap + 18, ly)], fill=(180, 180, 180))
        else:
            d.rectangle([gap, ly, gap + 18, ly + 18], fill=cor[:3],
                        outline=(90, 90, 90))
        hexa = "transparente" if cor[3] == 0 else "#%02x%02x%02x" % cor[:3]
        d.text((gap + 26, ly + 2), f"{hexa}   {papel} — {obs}",
               font=f_sub, fill=(30, 30, 30))
        ly += 26

    return img


def main():
    SAIDA.mkdir(exist_ok=True)
    itens = celulas()

    gerar_template(itens).save(SAIDA / "boneco-template.png")
    gerar_guia(itens).save(SAIDA / "boneco-guia.png")

    print(f"{len(itens)} peças")
    print("template/boneco-template.png  (1:1 — edite este)")
    print("template/boneco-guia.png      (ampliado — só pra consultar)")


if __name__ == "__main__":
    main()

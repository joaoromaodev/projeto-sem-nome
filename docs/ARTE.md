# Como produzir a arte do boneco

O boneco é montado por **cinco camadas** empilhadas, cada uma num PNG
separado de **32 × 48**. Elas vão em `static/sprites/`.

```
pele.png              cabeça, braços e mãos     ← cor de pele
pernas-<nome>.png     calça, saia               ← cor da calça
sapatos-<nome>.png                              ← cor do sapato
torso-<nome>.png      camisa                    ← cor da camisa
cabelo-<nome>.png                               ← cor do cabelo
```

O nome do arquivo vira o nome da peça na tela: `torso-jaqueta.png` aparece
como "jaqueta". Acrescentar uma roupa é **soltar o arquivo na pasta e
reiniciar** — não mexe em código nem em banco.

## Ordem de empilhamento

De baixo pra cima: **pele → pernas → sapatos → torso → cabelo**.

O torso vem **depois** dos braços de propósito. Como a camisa é desenhada
por cima, o comprimento da manga é decisão da camisa:

- manga curta → o torso cobre só o ombro, o braço aparece embaixo
- manga longa → o torso cobre o braço inteiro
- regata → não cobre nada

Ou seja: você ganha três tipos de manga sem nenhum arquivo novo de braço.

## As regras

- [ ] **Todos os arquivos exatamente 32 × 48.** Se um vier diferente, o
      encaixe quebra.
- [ ] **O boneco na mesma posição em todos.** Trabalhe num arquivo só, com
      cada peça numa layer, e exporte as layers separadas — no Aseprite,
      `File > Export Sprite Sheet` com "Split Layers". Alinhamento fica
      automático. Desenhar cada peça num arquivo novo e acertar "no olho"
      é o caminho mais rápido pra ter cabelo flutuando.
- [ ] **Fundo transparente**, não branco.
- [ ] **Sem suavização.** Desligue o anti-aliasing: pixel semitransparente
      na borda estraga a arte e o validador reclama.
- [ ] **2 ou 3 tons de uma cor só por peça.** A recoloração troca o matiz e
      mantém a claridade de cada pixel, então o sombreado que você desenhou
      sobrevive à troca de cor. Se a peça vier com cores misturadas, só dá
      pra usar como está.
- [ ] **Contorno bem escuro.** Pixel abaixo de 16% de claridade não é
      recolorido — é assim que o contorno continua preto em vez de virar uma
      versão escura da cor escolhida.
- [ ] **Pés sempre na mesma altura** entre os pares de sapato, senão um par
      flutua e o outro afunda.

## Conferir antes de usar

```powershell
python ferramentas/conferir_sprites.py
```

Ele aponta o que só apareceria depois: tamanho divergente, fundo opaco,
suavização, perna que não encontra o sapato, e cores demais numa peça.

Enquanto a arte de verdade não chega, `python ferramentas/gerar_placeholders.py`
gera camadas de andaime pra o sistema ficar testável.

## Movimento

Não precisa desenhar quadro de caminhada. O boneco **pula** e a sombra no
chão encolhe junto — isso é feito por código.

A escolha foi deliberada: num sprite pequeno o movimento vertical lê melhor
que troca de perna, e um ciclo de 4 quadros × 5 camadas seriam 20 sprites em
vez de 5. Se um dia quiser passo de verdade, dá pra acrescentar 2 quadros só
na camada de pernas, sem refazer o resto.

---

## Se for usar assets de terceiros (itch.io e afins)

### O pacote precisa ser MODULAR

A maioria dos packs de personagem vem com corpo, roupa e cabelo **fundidos
numa imagem só**. Esse tipo não serve: sem camadas separadas, o usuário não
escolhe cor de pele, camisa e cabelo — o boneco vira figurinha fixa e o
guarda-roupa perde o sentido.

Procure por: **"modular character"**, **"character customizer"**,
**"layered character"**, **"paper doll"**, **"LPC"**.

### Licença — o item que mais importa

- [ ] **O link da página** do asset
- [ ] **A licença**, escrita. Procure "License" na página:
      - CC0 / domínio público → pode tudo
      - CC-BY → pode, mas **tem que creditar** (anote o nome do autor)
      - "free for personal use" → **não serve**, site público não é uso pessoal
      - "no redistribution" → **não serve**, publicar já é redistribuir

Entre amigos o risco é praticamente zero. Mas se um dia isso abrir pro
público, o problema já vai estar dentro do código — por isso vale anotar
agora, não depois.

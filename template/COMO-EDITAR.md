# Template do boneco — como editar e o que me devolver

## Os arquivos

- **`boneco-template.png`** — 1:1 (36 × 61 px). **É este que você edita.**
- **`boneco-guia.png`** — ampliado e rotulado. Só pra consultar enquanto desenha.

Os dois saem de `ferramentas/gerar_template.py`. Se eu mudar o boneco no
código, rode `python ferramentas/gerar_template.py` pra atualizar.

## A regra que não dá pra quebrar

O template usa **cores-código**, não as cores finais. Cada cor diz *o papel*
daquele pixel — é isso que permite o mesmo desenho servir pra qualquer
combinação de cores que o usuário escolher depois.

| Cor | Papel | O que acontece |
|-----|-------|----------------|
| `#000000` preto | contorno | continua preto |
| `#ff00ff` magenta | pele | vira a cor de pele escolhida |
| `#ffffff` branco | olho | continua branco |
| `#00ff00` verde | camisa | vira a cor de camisa escolhida |
| `#0000ff` azul | parte de baixo | vira a cor de calça/saia escolhida |
| `#ffff00` amarelo | cabelo | vira a cor de cabelo escolhida |
| transparente | vazio | nada é desenhado |

**Use exatamente esses valores.** Um `#ff00fe` no lugar de `#ff00ff` já não é
reconhecido, e aquele pixel vai sumir. No seu editor, desligue qualquer
suavização (anti-aliasing) — pixel art tem que sair com a cor cravada.

Sugestão de programa: **Aseprite** (pago, é o padrão), **Piskel** ou
**Lospec Pixel Editor** (os dois de graça, rodam no navegador). Paint do
Windows também dá conta nesse tamanho.

## Como o boneco é montado

Cada célula do template é um quadro de 8 × 14, mas **cada peça só ocupa
algumas linhas**. A altura cheia está lá pra você enxergar o encaixe.

```
linhas 0-6    cabeça
linhas 7-10   torso   (muda conforme o corpo: médio, esguio, largo)
linhas 11-13  baixo   (muda conforme a roupa: calça, saia, vestido)
```

O **cabelo é desenhado por cima**, a partir da linha 0. Pode passar da linha
6 se for comprido — o "comprido" atual desce até a linha 5.

Cada parte de baixo tem **duas versões**: parada e andando. A de andar é o
que dá a impressão de passo. Se você fizer uma roupa nova, precisa das duas.

## Checklist do que me devolver

Não precisa fazer tudo. Me manda só o que você mudou — eu encaixo o resto.

- [ ] `boneco-template.png` editado (**mantenha o mesmo tamanho e as mesmas
      posições das células** — é assim que eu sei qual peça é qual)
- [ ] Se criou peça nova (um cabelo a mais, uma roupa a mais): me diga
      **o nome de cada uma**, na ordem em que aparecem
- [ ] Se mudou o tamanho do sprite (por ex. de 8×14 pra 16×16): **me avise
      antes**, porque isso mexe no renderizador inteiro

## Se for usar assets do itch.io

### Antes do tamanho: o pacote precisa ser MODULAR

A maioria dos packs de personagem vem com corpo, roupa e cabelo **fundidos
numa imagem só**. Esse tipo não serve pro que a gente quer: sem camadas
separadas, o usuário não consegue escolher cor de pele, de camisa e de
cabelo — o boneco vira figurinha fixa e o guarda-roupa perde o sentido.

Procure por: **"modular character"**, **"character customizer"**,
**"layered character"**, **"paper doll"**, **"LPC"**.

Um pack modular traz o corpo nu num arquivo, roupas em outro, cabelos em
outro. É isso que mantém o seletor de cor funcionando.

Pack não-modular ainda dá pra usar, mas aí a customização vira "escolher
entre N bonecos prontos", com as cores que o artista definiu. É uma troca
real — melhor saber antes de escolher.

### Tamanho

| | |
|---|---|
| **Ideal** | **16 × 24** (largura × altura), ou 16 × 16 |
| Aceitável | 24 × 24, 32 × 32 |
| Evite | acima de 32 × 32 |

Personagem quase nunca é quadrado: 16 de largura por 24 de altura dá
proporção de corpo e é o tamanho mais comum em pack modular. O editor
pixel a pixel continua viável (384 pixels; hoje são 112).

Acima de 32 × 32 o editor vira 2.300+ pixels — ninguém desenha o próprio
boneco nisso — e a sala fica apertada com 8 pessoas.

### Formato

- [ ] **PNG** com fundo **transparente** (não branco)
- [ ] Sem suavização (anti-aliasing) — borda de pixel cravada
- [ ] Pelo menos **2 quadros de caminhada** (4 é melhor). Com 1 só, o boneco
      desliza sem mexer as pernas
- [ ] Vista de frente ou de lado — o código espelha pra virar, então não
      precisa de esquerda e direita separadas
- [ ] Se for sprite sheet, **quantos pixels tem cada quadro**

### Licença — o item que mais importa

- [ ] **O link da página** do asset
- [ ] **A licença**, escrita. Procure "License" na página:
      - CC0 / domínio público → pode tudo
      - CC-BY → pode, mas **tem que creditar** (me diga o nome do autor)
      - "free for personal use" → **não serve**, site público não é uso pessoal
      - "no redistribution" → **não serve**, publicar já é redistribuir

Entre vocês o risco é praticamente zero. Mas se um dia isso abrir pro
público, o problema já vai estar dentro do código — por isso vale anotar
agora, não depois.

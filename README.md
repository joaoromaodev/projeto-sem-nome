# projeto sem nome

Uma sala na internet pra assistir e ouvir coisas junto com os amigos, com
bonequinho andando pela tela e cara de Windows 98.

A ideia vem das antigas salas de música do Transformice e do MSN: o que
prendia não era o player de música, era **estar num lugar** — ver os
bonequinhos dos outros na tela, reconhecer quem sempre aparecia, a sala ter
nome e história.

Sites de assistir junto existem (Watch2Gether, Teleparty, Kosmi) e são bons.
Mas todos tratam a sala como link descartável: cria, manda, acaba. A aposta
aqui é o contrário — sala fixa, gente recorrente, identidade visual própria.

> **Status:** em construção. A sala, o chat, as contas e o editor de avatar
> funcionam. A sincronia de vídeo e o compartilhamento de tela ainda não.
>
> O caminho completo até o MVP, com as decisões e o porquê de cada uma, está
> em **[docs/PLANO.md](docs/PLANO.md)**.

---

## O que funciona hoje

- **Conta com senha** — apelido, senha, e o boneco preso à conta
- **Sala em tempo real** — entra pelo nome; quem digita o mesmo nome cai junto
- **Bonequinho que anda** — setas, WASD ou clique no chão, com quem está na
  frente cobrindo quem está atrás
- **Chat** com balão de fala sobre a cabeça
- **Editor de avatar** — cinco camadas (pele, pernas, sapatos, torso,
  cabelo), cada uma com peça e cor livres, mais um guarda-roupa de looks

## O que ainda não

- Sincronia de vídeo do YouTube (é a próxima etapa, e a mais difícil)
- Compartilhamento de tela por WebRTC
- Histórico da sala — a sala some quando o servidor reinicia; as contas não

---

## Decisões que valem explicar

**O boneco anda na hora, sem esperar o servidor.**
O servidor só conta aos outros onde você está. Esperar a confirmação pra
desenhar deixaria o movimento borrachudo em qualquer internet que não fosse
ótima — e movimento borrachudo mataria justamente a parte que dá graça.

**Quem você é vem do cookie, não do que o cliente diz ser.**
O WebSocket lê a sessão e usa o apelido e o avatar do banco. Não existe
mensagem de "join" carregando nome — se existisse, qualquer um entraria na
sala se dizendo outra pessoa.

**Senha por scrypt, nunca em texto.**
O custo é calibrado pra ser imperceptível num login e caro em ataque de
força bruta. Login errado devolve sempre a mesma mensagem *e demora o mesmo
tempo* mesmo quando o apelido não existe — senão dá pra descobrir quem tem
conta só cronometrando a resposta.

**O avatar são cinco camadas empilhadas, não uma imagem pronta.**
Cada camada aponta pra um sprite e uma cor, então o avatar inteiro cabe em
~150 bytes — trocar de roupa no meio da sala não pesa na rede. A camisa é
desenhada **depois** dos braços de propósito: assim o comprimento da manga
vira decisão da camisa, e manga curta, longa e regata saem sem precisar de
arte de braço nova.

**A recoloração preserva o sombreado.**
Trocar a cor de uma peça muda o matiz e mantém a claridade de cada pixel, em
vez de chapar tudo — o sombreado que o artista desenhou sobrevive. Pixel
abaixo de 16% de claridade fica como está, senão o contorno preto viraria
uma versão escura da cor escolhida e o boneco perderia definição.

**O catálogo de peças é lido da pasta.**
`/api/pecas` monta a lista a partir de `static/sprites/`. Acrescentar uma
roupa é soltar o arquivo lá e reiniciar — sem tocar em código nem em banco.

**O canvas do boneco é mais alto que o sprite.**
Ao andar, o boneco sobe alguns pixels. Sem essa folga o topo da cabeça era
desenhado fora do canvas e sumia — bug real, encontrado testando.

**Frontend sem framework.**
A estética Win98 é feita de bordas chanfradas, gradientes e fontes de
sistema. CSS puro faz isso melhor e mais rápido do que lutar contra uma
biblioteca de componentes, e o projeto tem três telas.

---

## Stack

| | |
|---|---|
| Backend | Python, FastAPI, WebSocket |
| Validação | Pydantic — tudo que entra pelo socket passa por schema |
| Banco | SQLite |
| Frontend | HTML, CSS e JavaScript puros (ES modules, Canvas) |
| Deploy | Fly.io (Docker) |

---

## Rodar

```powershell
git clone https://github.com/joaoromaodev/projeto-sem-nome.git
cd projeto-sem-nome
.\run.ps1
```

Abre em <http://localhost:8000>. A primeira execução instala as dependências.
Em Linux/macOS: `pip install -r requirements.txt && uvicorn app.main:app`.

Pra testar com duas pessoas na mesma máquina, use uma janela anônima ao lado
da normal — duas abas normais compartilham o mesmo login.

### Chamar gente de fora, sem deploy

```powershell
winget install --id Cloudflare.cloudflared
.\run.ps1 -Tunel
```

O endereço público aparece na janela do túnel. Muda a cada reinício e só
funciona com a máquina ligada.

### Botar no ar

```powershell
fly launch --no-deploy
fly volumes create dados --size 1 --region gru
fly deploy
```

O `fly.toml` já vem com volume em `/data` (sem ele, todo deploy apagaria as
contas), região São Paulo, e uma máquina só — o estado da sala vive em
memória, então dois usuários em máquinas diferentes não se enxergariam.

Vercel não serve: é serverless e não segura conexão WebSocket aberta.

---

## Organização

```
app/
  protocol.py   formato das mensagens do WebSocket (Pydantic)
  db.py         SQLite: contas, senhas, sessões e guarda-roupa
  rooms.py      salas e quem está dentro — em memória
  main.py       rotas HTTP, conta e o WebSocket
static/
  entrar.html   login e cadastro
  index.html    montar o boneco e escolher a sala
  sala.html     a sala
  js/avatar.js  compõe as camadas do boneco
  js/sprites.js carrega, recolore e guarda os sprites em cache
  js/editor.js  painel do boneco: peças, cores e guarda-roupa
  js/api.js     conversa com o servidor
  js/sala.js    conexão, movimento e chat
  css/y2k.css   a cara Win98
ferramentas/    gerar camadas provisórias e validar sprites
static/sprites/ as camadas do boneco (PNG 32x48)
docs/           o plano até o MVP, as regras da arte e a apresentação
```

## Mexer na arte do boneco

Os sprites vivem em `static/sprites/`, um PNG de 32×48 por peça:

```
pele.png              a base: cabeça, braços e mãos
cabelo-<nome>.png
torso-<nome>.png
pernas-<nome>.png
sapatos-<nome>.png
```

```powershell
python ferramentas/gerar_placeholders.py   # camadas provisórias, pra testar
python ferramentas/conferir_sprites.py     # valida antes de entrar no jogo
```

> A arte atual é **andaime**, gerada pelo `gerar_placeholders.py`. Quando os
> sprites de verdade chegarem, é só sobrescrever os arquivos — nenhum código
> muda, e o catálogo se atualiza sozinho.

O validador aponta o que só apareceria depois: camada com tamanho diferente
das outras, fundo que ficou opaco, perna que não encontra o sapato, cores
demais numa peça, e **suavização** (pixels semitransparentes) — o erro de
exportação mais comum e o mais difícil de ver a olho nu.

Cada peça deve ser desenhada em **2 ou 3 tons de uma cor só**: a recoloração
troca o matiz e preserva a claridade, então o sombreado sobrevive.

As regras completas — alinhamento, ordem das camadas, licença de assets de
terceiros — estão em **[docs/ARTE.md](docs/ARTE.md)**.

---

## Limitações conhecidas

- Estado da sala em memória: reiniciou, esvaziou
- Máximo 12 pessoas por sala (`MAX_POR_SALA` em `app/rooms.py`)
- Sem recuperação de senha
- A arte atual é provisória (andaime gerado por script)
- Só existe uma vista do boneco, espelhada — falta frente e costas
- Qualquer um logado entra em qualquer sala se souber o nome

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

> **Status:** no ar em **<https://2gether.fly.dev>**. A sala, o chat, as
> contas, o lobby e o editor de avatar funcionam. A sincronia de vídeo e o
> compartilhamento de tela ainda não.
>
> O caminho completo até o MVP, com as decisões e o porquê de cada uma, está
> em **[docs/PLANO.md](docs/PLANO.md)**.

---

## O que funciona hoje

- **Conta com senha** — apelido, senha, e o boneco preso à conta
- **Sala em tempo real** — entra pelo nome; quem digita o mesmo nome cai junto
- **Lobby** — sala oficial onde cai quem não tem destino, com teto maior
  (30) que o de uma sala comum (12)
- **Lista de salas com gente agora** — quantas pessoas, quem são, e os
  bonequinhos delas em miniatura
- **Bonequinho que anda** — setas, WASD ou clique no chão, com quem está na
  frente cobrindo quem está atrás
- **Chat** com balão de fala sobre a cabeça
- **Editor de avatar** — cinco camadas (pele, pernas, sapatos, torso,
  cabelo), cada uma com peça e cor livres, mais um guarda-roupa de looks

- **Vídeo do YouTube sincronizado** — cola o link e toca junto pra todo
  mundo; quem chega no meio entra no ponto certo
- **O vídeo toca dentro da TV da sala** — a televisão é um móvel no chão,
  com os bonecos andando na frente dela; quando não tem nada tocando, ela
  mostra a tela verde de TV desligada
- **"Está digitando"** — três pontinhos animados sobre a cabeça do boneco,
  e a linha "fulano está digitando..." embaixo da conversa
- **Volume de cada um** — o único ajuste do vídeo que não passa pelo
  servidor nem exige o controle remoto, e que o navegador lembra
- **Controle remoto** — fica no chão da sala; quem pega manda no play,
  pause, avançar e pular, e devolve quando quiser
- **Fila de vídeos** — qualquer um põe, e o próximo entra sozinho
- **Título de cada vídeo** — na fila, no que está tocando e no cartão da
  sala no lobby, resolvido sem chave de API
- **A sala tem memória** — quanto já tocou ali, o que já rolou e quem
  frequenta ficam no banco e sobrevivem ao restart. Ao entrar, a sala
  conta isso pelo chat; sala nova fica calada
- **Suas salas** — as que você frequenta, na home, inclusive as vazias
- **Sala privada por convite** — o dono tranca, o link vai pra área de
  transferência, e quem abre o link vira membro e entra
- **Favoritos da sala** — o repertório do grupo; clicar num põe na fila
- **Decoração** — a TV e o sofá são arrastáveis no modo decorar, e onde
  ficam vale pra todo mundo
- **Quem frequenta** — os frequentadores com o boneco de cada um, e
  apagadinho pra quem não está agora

## O que ainda não

- Compartilhamento de tela por WebRTC
- Moderação — o lobby é aberto e o editor de boneco é livre

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

**O servidor é o relógio do vídeo, e ninguém confia no próprio player.**
O servidor guarda o par (posição, instante) em vez de uma posição "atual" —
posição atual envelheceria no caminho. Cada cliente reconstrói onde deveria
estar e **se corrige**: menos de 0,5s de desvio fica quieto, entre 0,5s e 2s
ele acelera ou freia 5% (ninguém percebe, e o vídeo não pula), e só acima de
2s ele pula. Essa correção suave é o que separa "funciona" de "funciona
bem" — sem ela o vídeo fica dando pulinhos o tempo todo.

**O controle remoto é um objeto, não um cargo.**
Quem manda no player é quem está segurando o controle — e ele fica caído no
chão da sala até alguém ir lá e pegar. Aparece na mão do boneco de quem
pegou, e cai de volta quando a pessoa devolve ou fecha a aba (se sumisse
junto com ela, a sala travaria sem ninguém podendo mexer no vídeo).

Um "host" com botão de passar a vez resolveria a mesma disputa. A diferença
é que cargo é caixa de permissão e objeto é coisa que existe no lugar — e o
projeto inteiro aposta que o valor está em **estar num lugar**. Pegar o
controle da mesa é a versão digital de levantar do sofá.

**Mas pôr na fila é livre pra todo mundo.**
O controle existe pra duas pessoas não brigarem pelo play/pause, não pra
alguém decidir o que a sala assiste. Se a fila exigisse o controle, quem o
pegasse viraria porteiro — e todo mundo empilhando música é justamente a
graça.

**O título do vídeo sai do oEmbed, não da API do YouTube.**
A rota óbvia seria a YouTube Data API, que custaria um projeto no Google
Cloud, uma chave, um secret no servidor e uma cota diária — quatro peças
pra manter por causa de um texto. O `youtube.com/oembed` devolve o título
por URL pública, sem nenhuma delas. Quando ele não responde (vídeo privado,
apagado, sem embed) a tela mostra o id, que é o que ela mostrava antes:
degrada pro comportamento antigo em vez de quebrar.

E a busca nunca segura o vídeo — ela roda em paralelo e o título chega numa
mensagem depois. Esperar um GET pro YouTube antes de dar play atrasaria a
sala inteira por causa de um rótulo, trocando sincronia por enfeite.

**A lista de salas mostra presença, não nota.**
Chegou a ser considerado um sistema de avaliação das salas, e foi descartado.
Quem olha a lista não quer saber se a sala é "boa" — quer saber **se tem
gente lá e quem é**. Presença responde isso melhor, e ainda evita três
problemas que a nota traria: entre poucos amigos uma nota é dois votos, ou
seja ruído; ranking cria sala "mal avaliada", que entre amigos é
constrangimento; e descoberta por nota é o modelo de lista de servidor
público, que é justamente o que a tese deste projeto rejeita.

**A cor escolhida tem que ser a cor que aparece.**
A recoloração troca a cor de uma arte em tons de qualquer coisa por outra
qualquer, e a primeira versão fazia o óbvio errado: pegava o matiz e a
saturação da cor nova e mantinha a claridade do pixel original. Como
claridade é o que decide se algo é escuro ou claro, a cor pedida nunca
aparecia — quem escolhia um vinho escuro via um rosa.

A versão certa funciona por deslocamento: cada arte tem um tom base (o
mais frequente dela), é esse tom que recebe a cor escolhida, e os outros
se movem junto mantendo a distância que tinham. Sombra continua sombra e
brilho continua brilho, mas agora são os daquela cor. O tom base é a moda
e não a média porque em pixel art o corpo da peça é uma área chapada
grande — a moda cai nela, que é o que a pessoa lê como "a cor da roupa".

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

Já está: **<https://2gether.fly.dev>**. Pra reproduzir do zero:

```powershell
winget install --id Fly-io.flyctl   # o comando é `flyctl`, não `fly`
flyctl auth login
flyctl apps create <nome> --org personal
flyctl volumes create dados --size 1 --region gru --app <nome>
flyctl deploy --remote-only        # --remote-only dispensa Docker local
```

`apps create` em vez de `fly launch` de propósito: o `launch` reescreve o
`fly.toml` e derrubaria os comentários e os ajustes de volume, região e
concorrência que estão lá.

**O volume tem que existir antes do primeiro deploy.** Sem ele a app sobe
sem disco e cada atualização apaga apelido, senha, boneco e guarda-roupa de
todo mundo.

O `fly.toml` vem com volume em `/data`, região São Paulo, e uma máquina só —
o estado da sala vive em memória, então dois usuários em máquinas diferentes
não se enxergariam.

A máquina dorme quando não tem ninguém (`min_machines_running = 0`): o
primeiro a chegar espera ~2s, e as salas abertas somem junto (as contas
não). Deploy também costuma cuspir um `WARNING: The app is not listening on
the expected address` — é corrida de tempo entre o check e o uvicorn subir;
confira o log antes de achar que quebrou.

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
  js/video.js   o player e a correção de deriva
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

- **Presença** vive em memória: reiniciou, a sala esvazia. O que a sala
  *lembra* (dona, contador, histórico, frequentadores, decoração) está no
  banco e volta. A separação é de propósito — gravar presença criaria
  gente fantasma numa sala vazia depois de um crash
- Uma máquina só: o estado de quem está online não é compartilhado entre
  instâncias
- Máximo 12 pessoas por sala e 30 no lobby (`app/rooms.py`)
- Sem recuperação de senha
- A arte atual é provisória (andaime gerado por script)
- Só existe uma vista do boneco, espelhada — falta frente e costas
- Sala aberta: qualquer um logado entra se souber o nome. Trancar é
  possível, mas é escolha do dono, não o padrão
- A lista de salas mostra o apelido de todo mundo que está online pra
  qualquer pessoa logada — entre amigos é o objetivo, numa sala aberta ao
  público é outra conversa. Sala trancada fica fora dessa lista pra quem
  não é membro
- O editor de boneco não cabe na tela: dentro da sala ele passa da altura
  do chão sem rolagem, e na home domina a página. Vai ser reestruturado
  junto com a arte definitiva — ver `docs/PLANO.md`

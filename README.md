# soat13-tc-revenda-veiculos

Serviço independente para cadastro, consulta e disponibilidade de veículos. Este projeto mantém seu próprio código, dependências, infraestrutura Docker e banco MySQL; não importa código de outros serviços.

## Executar

```bash
cp .env.example .env
docker compose up -d --build
```

O serviço fica disponível em `http://localhost:3002`; o MySQL deste projeto usa a porta `3308`. Para executar sem Docker, instale as dependências com `npm install` e inicie com `npm start`.

As credenciais `root/root` do `.env.example` são somente para desenvolvimento
local. Não reutilize em produção, não versione o arquivo `.env` e nunca coloque
credenciais AWS no projeto.

## API

- `GET /api/health`
- `GET /api/veiculos/disponiveis`, `/api/veiculos/reservados`, `/api/veiculos/vendidos`
- `GET /api/veiculos/:placa`
- `POST /api/veiculos`
- `PUT /api/veiculos/:placa`
- `GET /internal/veiculos/:placa` para consulta via API por outros serviços

O antigo `PATCH /internal/veiculos/:placa/status` foi removido: reserva, venda e
liberação do veículo agora acontecem somente pela saga, via eventos.

## Saga coreografada

Veículos é participante da saga de vendas. O worker (`npm run worker`) consome
a fila `vendas-eventos`, executa a transação local e publica o resultado na
fila `veiculos-eventos`. Não há chamadas HTTP entre vendas e veículos.

| Evento recebido | Transação local | Evento publicado |
|-----------------|-----------------|------------------|
| `VENDA_CRIADA` | `DISPONIVEL → RESERVADO` para a venda | `VEICULO_RESERVADO` (`veiculoId`, `preco`) ou `VEICULO_RESERVA_FALHOU` (`motivo`) |
| `PAGAMENTO_RECEBIDO` | `RESERVADO → VENDIDO` se a reserva for da venda | `VEICULO_VENDIDO` ou `VEICULO_VENDA_FALHOU` |
| `VENDA_CANCELADA` (compensação) | `RESERVADO → DISPONIVEL` se a reserva for da venda | `VEICULO_LIBERADO` |

- A coluna `venda_codigo` guarda a venda dona da reserva. Assim os handlers são
  idempotentes (a fila standard entrega pelo menos uma vez: uma entrega repetida
  só republica o resultado) e uma venda nunca libera ou conclui a reserva de
  outra.
- As gravações usam controle otimista (`WHERE status = ? AND venda_codigo <=> ?`);
  conflitos devolvem a mensagem à fila para nova tentativa.
- Na última tentativa (5ª entrega) de `VENDA_CRIADA` ou `PAGAMENTO_RECEBIDO`, o
  worker desfaz uma reserva parcial e publica o evento de falha, para que a
  venda não fique aguardando indefinidamente. Depois a mensagem vai para a DLQ.
- O `database/init.sql` é idempotente e adiciona `venda_codigo` em bancos
  existentes. Veículos reservados pelo fluxo antigo ficam com `venda_codigo`
  nulo: libere-os manualmente antes da migração, se houver vendas em andamento.

Variáveis do worker: `AWS_REGION`, `SQS_VENDAS_EVENTOS_URL` (entrada),
`SQS_VEICULOS_EVENTOS_URL` (saída) e as variáveis de banco.

## Arquitetura

O código segue Clean Architecture; as dependências apontam sempre para dentro
(infraestrutura → aplicação → domínio):

```
src/
├── domain/
│   ├── entities/
│   │   ├── veiculo.js              # Entidade, StatusVeiculo e transições da saga
│   │   └── value-objects/placa.js
│   └── errors/                     # InvalidInput, NotFound, Duplicate, BusinessRule
├── application/
│   ├── gateways/                   # Portas: repositório, publisher e contratos de eventos
│   └── usecases/
│       ├── veiculo-usecase.js      # Cadastro, edição e consultas
│       └── veiculo-saga-usecase.js # Reações aos eventos de vendas e compensações
└── infrastructure/
    ├── api/                        # Express (app.js, server.js, erros → HTTP)
    ├── controllers/                # Controllers, wire-in e factory
    ├── datasource/                 # MySQL
    └── messaging/                  # SqsProducer, SqsConsumer, worker.js
```

Testes: `npm test` (unitários de domínio, casos de uso e consumidor SQS, além de
testes da API com banco simulado).

## AWS

## AWS

O deploy de produção usa a imagem deste serviço no ECR e o manifesto Kubernetes
mantido em `soat13-tc-revenda-infra-k8s`. Consulte o README desse repositório
para provisionamento e deploy. Não configure chaves AWS dentro do projeto.

Em produção, o banco é um RDS MySQL privado, criptografado e separado dos bancos
dos outros serviços. Placa, preço e estado de disponibilidade são dados
operacionais da venda; o banco não armazena dados do cliente. A API key é
validada no API Gateway, não pelo serviço: não exponha o ALB interno nem use a
chave compartilhada como autenticação de usuário.

## Repositórios relacionados

- [Clientes](https://github.com/mgustavocoder/soat13-tc-revenda-clientes)
- [Vendas](https://github.com/mgustavocoder/soat13-tc-revenda-vendas)
- [Infraestrutura de banco](https://github.com/mgustavocoder/soat13-tc-revenda-infra-db)
- [Infraestrutura EKS e API Gateway](https://github.com/mgustavocoder/soat13-tc-revenda-infra-k8s)
- [Arquitetura, segurança e Saga (PDF)](https://github.com/mgustavocoder/soat13-tc-revenda-infra-k8s/blob/main/docs/arquitetura-seguranca-saga.pdf)

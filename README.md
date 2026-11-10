# soat13-tc-revenda-veiculos

Serviço independente para cadastro, consulta e disponibilidade de veículos. Este projeto mantém seu próprio código, dependências, infraestrutura Docker e banco MySQL; não importa código de outros serviços.

## Executar

```bash
cp .env.example .env
docker compose up -d --build
```

O serviço fica disponível em `http://localhost:3002`; o MySQL deste projeto usa a porta `3308`. Para executar sem Docker, instale as dependências com `npm install` e inicie com `npm start`.

## API

- `GET /api/health`
- `GET /api/veiculos/disponiveis`, `/api/veiculos/reservados`, `/api/veiculos/vendidos`
- `GET /api/veiculos/:placa`
- `POST /api/veiculos`
- `PUT /api/veiculos/:placa`
- `GET /internal/veiculos/:placa` para consulta via API por outros serviços
- `PATCH /internal/veiculos/:placa/status` com `{ "status": "RESERVADO" }`

## AWS

O deploy de produção usa a imagem deste serviço no ECR e o manifesto Kubernetes
mantido em `soat13-tc-revenda-infra-k8s`. Consulte o README desse repositório
para provisionamento e deploy. Não configure chaves AWS dentro do projeto.

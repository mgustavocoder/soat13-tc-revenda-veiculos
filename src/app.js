import cors from 'cors'
import express from 'express'
import { xss } from 'express-xss-sanitizer'
import { createPool } from 'mysql2/promise'

const normalizePlaca = (placa) => String(placa || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
const isValidPlaca = (placa) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa)
const statuses = new Set(['DISPONIVEL', 'RESERVADO', 'VENDIDO'])
const ANO_MINIMO = 1886
const ANO_MAXIMO = new Date().getFullYear() + 1

const createApp = ({ db = createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'veiculos_db',
  waitForConnections: true,
  connectionLimit: 10
}) } = {}) => {
  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use(xss())
  app.disable('x-powered-by')

  const getVeiculo = async (placa) => {
    const normalizedPlaca = normalizePlaca(placa)
    if (!isValidPlaca(normalizedPlaca)) {
      const error = new Error('Placa do veículo inválida.')
      error.status = 400
      throw error
    }
    const [rows] = await db.execute(
      'SELECT id, placa, marca, modelo, ano, cor, preco, status FROM veiculos WHERE placa = ? LIMIT 1',
      [normalizedPlaca]
    )
    return rows[0]
  }

  const publicVehicle = ({ id, ...veiculo }) => veiculo
  app.get('/api/health', (req, res) => res.json({ status: 'healthy' }))

  app.get('/api/veiculos/disponiveis', async (req, res) => {
    const [rows] = await db.execute(
      "SELECT id, placa, marca, modelo, ano, cor, preco, status FROM veiculos WHERE status = 'DISPONIVEL' ORDER BY preco"
    )
    return res.status(200).json(rows.map(publicVehicle))
  })

  app.get('/api/veiculos/reservados', async (req, res) => {
    const [rows] = await db.execute(
      "SELECT id, placa, marca, modelo, ano, cor, preco, status FROM veiculos WHERE status = 'RESERVADO' ORDER BY preco"
    )
    return res.status(200).json(rows.map(publicVehicle))
  })

  app.get('/api/veiculos/vendidos', async (req, res) => {
    const [rows] = await db.execute(
      "SELECT id, placa, marca, modelo, ano, cor, preco, status FROM veiculos WHERE status = 'VENDIDO' ORDER BY preco"
    )
    return res.status(200).json(rows.map(publicVehicle))
  })

  app.get('/api/veiculos/:placa', async (req, res) => {
    const veiculo = await getVeiculo(req.params.placa)
    if (!veiculo) return res.status(404).json({ message: 'Veículo não encontrado.' })
    return res.status(200).json(publicVehicle(veiculo))
  })

  app.get('/internal/veiculos/:placa', async (req, res) => {
    const veiculo = await getVeiculo(req.params.placa)
    if (!veiculo) return res.status(404).json({ message: 'Veículo não encontrado.' })
    return res.status(200).json(veiculo)
  })

  app.post('/api/veiculos', async (req, res) => {
    const { marca, modelo, ano, cor, preco } = req.body || {}
    const placa = normalizePlaca(req.body?.placa)
    const numericYear = Number(ano)
    const numericPrice = Number(preco)
    if (typeof marca !== 'string' || !marca.trim() || typeof modelo !== 'string' || !modelo.trim() ||
      typeof cor !== 'string' || !cor.trim() || !isValidPlaca(placa) ||
      !Number.isInteger(numericYear) || numericYear < ANO_MINIMO || numericYear > ANO_MAXIMO ||
      !Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ message: 'Informe marca, modelo, ano, cor, placa e preço válidos.' })
    }
    await db.execute(
      'INSERT INTO veiculos (marca, modelo, ano, cor, placa, preco) VALUES (?, ?, ?, ?, ?, ?)',
      [marca.trim(), modelo.trim(), numericYear, cor.trim(), placa, numericPrice]
    )
    return res.status(201).json({
      placa,
      marca: marca.trim(),
      modelo: modelo.trim(),
      ano: numericYear,
      cor: cor.trim(),
      preco: numericPrice,
      status: 'DISPONIVEL'
    })
  })

  app.put('/api/veiculos/:placa', async (req, res) => {
    const placa = normalizePlaca(req.params.placa)
    if (!isValidPlaca(placa)) return res.status(400).json({ message: 'Placa do veículo inválida.' })
    const veiculo = await getVeiculo(placa)
    if (!veiculo) return res.status(404).json({ message: 'Veículo não encontrado.' })
    if (veiculo.status !== 'DISPONIVEL') {
      return res.status(400).json({ message: 'Não é possível editar um veículo reservado ou vendido.' })
    }
    if (Object.hasOwn(req.body || {}, 'placa')) {
      return res.status(400).json({ message: 'A placa do veículo não pode ser alterada.' })
    }
    const fields = ['marca', 'modelo', 'ano', 'cor', 'preco']
    const updates = {}
    for (const field of fields) {
      if (req.body?.[field] !== undefined) updates[field] = req.body[field]
    }
    if (!Object.keys(updates).length) return res.status(400).json({ message: 'Nenhum campo válido para atualização.' })
    const merged = { ...veiculo, ...updates }
    const year = Number(merged.ano)
    const price = Number(merged.preco)
    if (typeof merged.marca !== 'string' || !merged.marca.trim() ||
      typeof merged.modelo !== 'string' || !merged.modelo.trim() ||
      typeof merged.cor !== 'string' || !merged.cor.trim() ||
      !Number.isInteger(year) || year < ANO_MINIMO || year > ANO_MAXIMO ||
      !Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ message: 'Dados inválidos para atualização do veículo.' })
    }
    await db.execute(
      'UPDATE veiculos SET marca = ?, modelo = ?, ano = ?, cor = ?, preco = ? WHERE placa = ?',
      [merged.marca.trim(), merged.modelo.trim(), year, merged.cor.trim(), price, placa]
    )
    return res.status(200).json(publicVehicle({ ...merged, placa, ano: year, preco: price }))
  })

  app.patch('/internal/veiculos/:placa/status', async (req, res) => {
    const placa = normalizePlaca(req.params.placa)
    const { status } = req.body || {}
    if (!isValidPlaca(placa)) return res.status(400).json({ message: 'Placa do veículo inválida.' })
    if (!statuses.has(status)) return res.status(400).json({ message: 'Status do veículo inválido.' })
    const veiculo = await getVeiculo(placa)
    if (!veiculo) return res.status(404).json({ message: 'Veículo não encontrado.' })
    const allowed = {
      DISPONIVEL: new Set(['RESERVADO', 'VENDIDO']),
      RESERVADO: new Set(['DISPONIVEL', 'VENDIDO']),
      VENDIDO: new Set()
    }
    if (veiculo.status !== status && !allowed[veiculo.status].has(status)) {
      return res.status(409).json({ message: `Não é possível alterar de ${veiculo.status} para ${status}.` })
    }
    if (veiculo.status !== status) {
      const [result] = await db.execute(
        'UPDATE veiculos SET status = ? WHERE placa = ? AND status = ?',
        [status, placa, veiculo.status]
      )
      if (!result.affectedRows) return res.status(409).json({ message: 'O status do veículo foi alterado por outra operação.' })
    }
    return res.status(200).json({ ...veiculo, status })
  })

  app.use((error, req, res, next) => {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Veículo com essa placa já cadastrado.' })
    }
    if (error?.status) return res.status(error.status).json({ message: error.message })
    console.error('Falha no serviço de veículos:', error)
    return res.status(500).json({ message: 'Erro interno no serviço de veículos.' })
  })

  return app
}

export { createApp }

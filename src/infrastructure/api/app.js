import cors from 'cors'
import express from 'express'
import { xss } from 'express-xss-sanitizer'
import { Logger } from '../logger.js'
import { createHttpErrorHandler } from './http-error-handler.js'

const createApp = ({ veiculoController, logger = new Logger() }) => {
  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use(xss())
  app.disable('x-powered-by')

  app.get('/api/health', (req, res) => res.json({ status: 'healthy' }))

  app.get('/api/veiculos/disponiveis', (req, res) => veiculoController.listarDisponiveis(req, res))
  app.get('/api/veiculos/reservados', (req, res) => veiculoController.listarReservados(req, res))
  app.get('/api/veiculos/vendidos', (req, res) => veiculoController.listarVendidos(req, res))
  app.get('/api/veiculos/:placa', (req, res) => veiculoController.buscarPorPlaca(req, res))
  app.post('/api/veiculos', (req, res) => veiculoController.cadastrar(req, res))
  app.put('/api/veiculos/:placa', (req, res) => veiculoController.atualizar(req, res))
  app.get('/internal/veiculos/:placa', (req, res) => veiculoController.buscarPorPlacaInterno(req, res))

  app.use(createHttpErrorHandler({ logger }))
  return app
}

export { createApp }

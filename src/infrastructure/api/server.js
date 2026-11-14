import 'dotenv/config'
import { controllersFactory } from '../controllers/controllers-factory.js'
import { createMysqlPool } from '../datasource/mysql-connection.js'
import { Logger } from '../logger.js'
import { createApp } from './app.js'

const logger = new Logger()
const port = Number(process.env.VEICULOS_PORT || 3002)
const db = createMysqlPool()
const app = createApp({ ...controllersFactory({ db }), logger })

app.listen(port, '0.0.0.0', () => {
  logger.info(`Serviço de veículos disponível na porta ${port}`)
})

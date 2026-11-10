import 'dotenv/config'
import { createApp } from './app.js'

const port = Number(process.env.VEICULOS_PORT || 3002)
const app = createApp()
app.listen(port, '0.0.0.0', () => {
  console.info(`Serviço de veículos disponível na porta ${port}`)
})

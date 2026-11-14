import { VeiculoEventosPublisher } from '../../application/gateways/veiculo-eventos-publisher.js'
import { SqsProducer } from './sqs-producer.js'

class SqsVeiculoEventosPublisher extends VeiculoEventosPublisher {
  constructor({ sqsClient, queueUrl, logger }) {
    super()
    this.producer = new SqsProducer({ sqsClient, queueUrl, origem: 'veiculos', logger })
  }

  async publicar(tipo, payload) {
    return this.producer.publicar(tipo, payload)
  }
}

export { SqsVeiculoEventosPublisher }

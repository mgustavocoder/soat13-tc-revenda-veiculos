import { EventosVenda } from '../../application/gateways/eventos-venda.js'
import { VeiculoSagaUsecase } from '../../application/usecases/veiculo-saga-usecase.js'
import { InvalidInputError } from '../../domain/errors/invalid-input-error.js'
import { MysqlVeiculoRepository } from '../datasource/mysql-veiculo-repository.js'
import { SqsConsumer } from './sqs-consumer.js'
import { SqsVeiculoEventosPublisher } from './sqs-veiculo-eventos-publisher.js'

/**
 * Liga os eventos de vendas (entrada) às transações locais de veículos, que
 * publicam seus resultados na fila de eventos de veículos (saída).
 */
const sagaConsumerFactory = ({ db, sqsClient, vendasEventosUrl, veiculosEventosUrl, logger }) => {
  const sagaUsecase = new VeiculoSagaUsecase(
    new MysqlVeiculoRepository(db),
    new SqsVeiculoEventosPublisher({ sqsClient, queueUrl: veiculosEventosUrl, logger })
  )

  return new SqsConsumer({
    sqsClient,
    queueUrl: vendasEventosUrl,
    logger,
    isPermanentError: (error) => error instanceof InvalidInputError,
    handlers: {
      [EventosVenda.VENDA_CRIADA]: (evento) => sagaUsecase.reservarParaVenda(evento),
      [EventosVenda.PAGAMENTO_RECEBIDO]: (evento) => sagaUsecase.venderParaVenda(evento),
      [EventosVenda.VENDA_CANCELADA]: (evento) => sagaUsecase.liberarReserva(evento)
    },
    onExhausted: {
      [EventosVenda.VENDA_CRIADA]: (evento) => sagaUsecase.compensarReservaNaoProcessada(evento),
      [EventosVenda.PAGAMENTO_RECEBIDO]: (evento) => sagaUsecase.compensarVendaNaoProcessada(evento)
    }
  })
}

export { sagaConsumerFactory }

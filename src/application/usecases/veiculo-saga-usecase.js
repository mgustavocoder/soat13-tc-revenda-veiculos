import { Placa } from '../../domain/entities/value-objects/placa.js'
import { BusinessRuleError } from '../../domain/errors/business-rule-error.js'
import { InvalidInputError } from '../../domain/errors/invalid-input-error.js'
import { EventosVeiculo } from '../gateways/veiculo-eventos-publisher.js'

const CODIGO_VENDA_PATTERN = /^VEN-[A-F0-9]{8}$/

class ConcurrentUpdateError extends Error {
  constructor() {
    super('O veículo foi alterado por outra operação; o evento será reprocessado.')
    this.name = 'ConcurrentUpdateError'
  }
}

/**
 * Participante da saga coreografada de vendas.
 *
 * Reage aos eventos publicados por vendas, executa a transação local sobre o
 * veículo e publica o resultado como evento de veículos. Não conhece nem chama
 * o serviço de vendas: a única integração é via eventos.
 *
 * Todos os handlers são idempotentes, porque a fila standard do SQS entrega
 * cada mensagem pelo menos uma vez: o veículo guarda o código da venda dona da
 * reserva e uma entrega repetida apenas republica o evento de resultado.
 */
class VeiculoSagaUsecase {
  constructor(veiculoRepository, eventosPublisher) {
    this.veiculoRepository = veiculoRepository
    this.eventosPublisher = eventosPublisher
  }

  /** VENDA_CRIADA → VEICULO_RESERVADO | VEICULO_RESERVA_FALHOU */
  async reservarParaVenda(evento) {
    const { vendaCodigo, veiculoPlaca } = this.#validarEvento(evento)
    const veiculo = await this.veiculoRepository.buscarPorPlaca(veiculoPlaca)
    if (!veiculo) {
      return this.#publicar(EventosVeiculo.VEICULO_RESERVA_FALHOU, {
        vendaCodigo, veiculoPlaca, motivo: 'Veículo não encontrado.'
      })
    }

    try {
      await this.#aplicar(veiculo, () => veiculo.reservarPara(vendaCodigo))
    } catch (error) {
      if (!(error instanceof BusinessRuleError)) throw error
      return this.#publicar(EventosVeiculo.VEICULO_RESERVA_FALHOU, {
        vendaCodigo, veiculoPlaca, motivo: error.message
      })
    }

    return this.#publicar(EventosVeiculo.VEICULO_RESERVADO, {
      vendaCodigo,
      veiculoPlaca,
      veiculoId: veiculo.id,
      preco: veiculo.preco
    })
  }

  /** PAGAMENTO_RECEBIDO → VEICULO_VENDIDO | VEICULO_VENDA_FALHOU */
  async venderParaVenda(evento) {
    const { vendaCodigo, veiculoPlaca } = this.#validarEvento(evento)
    const veiculo = await this.veiculoRepository.buscarPorPlaca(veiculoPlaca)
    if (!veiculo) {
      return this.#publicar(EventosVeiculo.VEICULO_VENDA_FALHOU, {
        vendaCodigo, veiculoPlaca, motivo: 'Veículo não encontrado.'
      })
    }

    try {
      await this.#aplicar(veiculo, () => veiculo.venderPara(vendaCodigo))
    } catch (error) {
      if (!(error instanceof BusinessRuleError)) throw error
      return this.#publicar(EventosVeiculo.VEICULO_VENDA_FALHOU, {
        vendaCodigo, veiculoPlaca, motivo: error.message
      })
    }

    return this.#publicar(EventosVeiculo.VEICULO_VENDIDO, { vendaCodigo, veiculoPlaca })
  }

  /** VENDA_CANCELADA (compensação) → VEICULO_LIBERADO */
  async liberarReserva(evento) {
    const { vendaCodigo, veiculoPlaca } = this.#validarEvento(evento)
    const veiculo = await this.veiculoRepository.buscarPorPlaca(veiculoPlaca)
    if (veiculo) {
      await this.#aplicar(veiculo, () => veiculo.liberarReservaDe(vendaCodigo))
    }
    return this.#publicar(EventosVeiculo.VEICULO_LIBERADO, { vendaCodigo, veiculoPlaca })
  }

  /**
   * Chamado quando VENDA_CRIADA esgotou as tentativas de processamento.
   * Desfaz uma eventual reserva parcial e informa a falha para que vendas
   * encerre a saga em vez de ficar aguardando indefinidamente.
   */
  async compensarReservaNaoProcessada(evento) {
    const { vendaCodigo, veiculoPlaca } = this.#validarEvento(evento)
    const veiculo = await this.veiculoRepository.buscarPorPlaca(veiculoPlaca)
    if (veiculo) {
      await this.#aplicar(veiculo, () => veiculo.liberarReservaDe(vendaCodigo))
    }
    return this.#publicar(EventosVeiculo.VEICULO_RESERVA_FALHOU, {
      vendaCodigo,
      veiculoPlaca,
      motivo: 'Não foi possível concluir a reserva após várias tentativas.'
    })
  }

  /**
   * Chamado quando PAGAMENTO_RECEBIDO esgotou as tentativas. A reserva é
   * mantida para que o pagamento possa ser confirmado novamente.
   */
  async compensarVendaNaoProcessada(evento) {
    const { vendaCodigo, veiculoPlaca } = this.#validarEvento(evento)
    return this.#publicar(EventosVeiculo.VEICULO_VENDA_FALHOU, {
      vendaCodigo,
      veiculoPlaca,
      motivo: 'Não foi possível concluir a venda do veículo após várias tentativas.'
    })
  }

  #validarEvento(evento) {
    const vendaCodigo = evento?.vendaCodigo
    if (typeof vendaCodigo !== 'string' || !CODIGO_VENDA_PATTERN.test(vendaCodigo) ||
      !Placa.isValid(evento?.veiculoPlaca)) {
      throw new InvalidInputError('Evento de venda inválido.')
    }
    return { vendaCodigo, veiculoPlaca: Placa.normalizar(evento.veiculoPlaca) }
  }

  async #aplicar(veiculo, transicao) {
    const estadoAnterior = { status: veiculo.status, vendaCodigo: veiculo.vendaCodigo }
    const alterou = transicao()
    if (!alterou) return
    const gravou = await this.veiculoRepository.atualizarReserva(veiculo, estadoAnterior)
    if (!gravou) throw new ConcurrentUpdateError()
  }

  async #publicar(tipo, payload) {
    await this.eventosPublisher.publicar(tipo, payload)
    return { tipo, ...payload }
  }
}

export { ConcurrentUpdateError, VeiculoSagaUsecase }

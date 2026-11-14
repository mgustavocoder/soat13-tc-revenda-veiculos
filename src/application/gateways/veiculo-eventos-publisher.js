/**
 * Eventos de domínio publicados pelo serviço de veículos na fila
 * `veiculos-eventos`, consumidos pela saga coreografada de vendas.
 */
const EventosVeiculo = Object.freeze({
  VEICULO_RESERVADO: 'VEICULO_RESERVADO',
  VEICULO_RESERVA_FALHOU: 'VEICULO_RESERVA_FALHOU',
  VEICULO_VENDIDO: 'VEICULO_VENDIDO',
  VEICULO_VENDA_FALHOU: 'VEICULO_VENDA_FALHOU',
  VEICULO_LIBERADO: 'VEICULO_LIBERADO'
})

/**
 * Porta de saída de eventos. Implementações devem lançar erro quando a
 * publicação falhar, para que a mensagem de entrada seja reprocessada.
 */
class VeiculoEventosPublisher {
  async publicar() {
    throw new Error('Method publicar(tipo, payload) must be implemented')
  }
}

export { EventosVeiculo, VeiculoEventosPublisher }

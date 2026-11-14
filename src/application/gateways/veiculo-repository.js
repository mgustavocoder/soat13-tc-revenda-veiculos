/**
 * Porta de persistência de veículos. A implementação concreta fica na camada
 * de infraestrutura e deve retornar entidades `Veiculo`.
 */
class VeiculoRepository {
  async listarPorStatus() {
    throw new Error('Method listarPorStatus() must be implemented')
  }

  async buscarPorPlaca() {
    throw new Error('Method buscarPorPlaca() must be implemented')
  }

  /**
   * Deve lançar DuplicateResourceError quando a placa já existir.
   */
  async criar() {
    throw new Error('Method criar() must be implemented')
  }

  async atualizarDados() {
    throw new Error('Method atualizarDados() must be implemented')
  }

  /**
   * Persiste status e venda dona da reserva com controle otimista: só grava se
   * o registro ainda estiver em `estadoAnterior` ({ status, vendaCodigo }).
   * Retorna `true` quando gravou.
   */
  async atualizarReserva() {
    throw new Error('Method atualizarReserva(veiculo, estadoAnterior) must be implemented')
  }
}

export { VeiculoRepository }

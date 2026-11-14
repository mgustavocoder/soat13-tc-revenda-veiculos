import { StatusVeiculo, Veiculo } from '../../domain/entities/veiculo.js'
import { Placa } from '../../domain/entities/value-objects/placa.js'
import { InvalidInputError } from '../../domain/errors/invalid-input-error.js'
import { ResourceNotFoundError } from '../../domain/errors/resource-not-found-error.js'

class VeiculoUsecase {
  constructor(veiculoRepository) {
    this.veiculoRepository = veiculoRepository
  }

  async listarDisponiveis() {
    return this.veiculoRepository.listarPorStatus(StatusVeiculo.DISPONIVEL)
  }

  async listarReservados() {
    return this.veiculoRepository.listarPorStatus(StatusVeiculo.RESERVADO)
  }

  async listarVendidos() {
    return this.veiculoRepository.listarPorStatus(StatusVeiculo.VENDIDO)
  }

  async buscarPorPlaca(placa) {
    if (!Placa.isValid(placa)) {
      throw new InvalidInputError('Placa do veículo inválida.')
    }
    const veiculo = await this.veiculoRepository.buscarPorPlaca(Placa.normalizar(placa))
    if (!veiculo) {
      throw new ResourceNotFoundError('Veículo não encontrado.')
    }
    return veiculo
  }

  async cadastrar(dados) {
    const veiculo = Veiculo.criar(dados)
    return this.veiculoRepository.criar(veiculo)
  }

  async atualizar(placa, campos) {
    const veiculo = await this.buscarPorPlaca(placa)
    veiculo.atualizar(campos)
    await this.veiculoRepository.atualizarDados(veiculo)
    return veiculo
  }
}

export { VeiculoUsecase }

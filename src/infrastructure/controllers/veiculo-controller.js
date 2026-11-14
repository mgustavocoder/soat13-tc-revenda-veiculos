import { CreateVeiculoWireIn, UpdateVeiculoWireIn } from './wire-in/veiculo-wire-in.js'

class VeiculoController {
  constructor(veiculoUsecase) {
    this.veiculoUsecase = veiculoUsecase
  }

  async listarDisponiveis(req, res) {
    const veiculos = await this.veiculoUsecase.listarDisponiveis()
    res.status(200).json(veiculos.map(veiculo => veiculo.toPublic()))
  }

  async listarReservados(req, res) {
    const veiculos = await this.veiculoUsecase.listarReservados()
    res.status(200).json(veiculos.map(veiculo => veiculo.toPublic()))
  }

  async listarVendidos(req, res) {
    const veiculos = await this.veiculoUsecase.listarVendidos()
    res.status(200).json(veiculos.map(veiculo => veiculo.toPublic()))
  }

  async buscarPorPlaca(req, res) {
    const veiculo = await this.veiculoUsecase.buscarPorPlaca(req.params.placa)
    res.status(200).json(veiculo.toPublic())
  }

  async buscarPorPlacaInterno(req, res) {
    const veiculo = await this.veiculoUsecase.buscarPorPlaca(req.params.placa)
    res.status(200).json(veiculo.toInternal())
  }

  async cadastrar(req, res) {
    const veiculo = await this.veiculoUsecase.cadastrar(CreateVeiculoWireIn.fromRequest(req.body))
    res.status(201).json(veiculo.toPublic())
  }

  async atualizar(req, res) {
    const veiculo = await this.veiculoUsecase.atualizar(req.params.placa, UpdateVeiculoWireIn.fromRequest(req.body))
    res.status(200).json(veiculo.toPublic())
  }
}

export { VeiculoController }

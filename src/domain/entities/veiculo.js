import { BusinessRuleError } from '../errors/business-rule-error.js'
import { InvalidInputError } from '../errors/invalid-input-error.js'
import { Placa } from './value-objects/placa.js'

const StatusVeiculo = Object.freeze({
  DISPONIVEL: 'DISPONIVEL',
  RESERVADO: 'RESERVADO',
  VENDIDO: 'VENDIDO'
})

const ANO_MINIMO = 1886
const CAMPOS_EDITAVEIS = ['marca', 'modelo', 'ano', 'cor', 'preco']

const anoMaximo = () => new Date().getFullYear() + 1
const textoValido = (valor) => typeof valor === 'string' && valor.trim().length > 0

const normalizarDados = ({ marca, modelo, ano, cor, preco }) => {
  const anoNumerico = Number(ano)
  const precoNumerico = Number(preco)
  const valido = textoValido(marca) && textoValido(modelo) && textoValido(cor) &&
    Number.isInteger(anoNumerico) && anoNumerico >= ANO_MINIMO && anoNumerico <= anoMaximo() &&
    Number.isFinite(precoNumerico) && precoNumerico > 0
  if (!valido) return null
  return {
    marca: marca.trim(),
    modelo: modelo.trim(),
    ano: anoNumerico,
    cor: cor.trim(),
    preco: precoNumerico
  }
}

class Veiculo {
  static StatusVeiculo = StatusVeiculo

  constructor({ id = null, placa, marca, modelo, ano, cor, preco, status, vendaCodigo = null }) {
    this.id = id
    this.placa = placa
    this.marca = marca
    this.modelo = modelo
    this.ano = ano
    this.cor = cor
    this.preco = preco
    this.status = status
    this.vendaCodigo = vendaCodigo
  }

  static criar(dados = {}) {
    const normalizados = normalizarDados(dados)
    if (!normalizados || !Placa.isValid(dados.placa)) {
      throw new InvalidInputError('Informe marca, modelo, ano, cor, placa e preço válidos.')
    }
    return new Veiculo({
      ...normalizados,
      placa: Placa.criar(dados.placa).getValor(),
      status: StatusVeiculo.DISPONIVEL
    })
  }

  atualizar(campos = {}) {
    if (this.status !== StatusVeiculo.DISPONIVEL) {
      throw new InvalidInputError('Não é possível editar um veículo reservado ou vendido.')
    }
    if (Object.hasOwn(campos, 'placa')) {
      throw new InvalidInputError('A placa do veículo não pode ser alterada.')
    }
    const alteracoes = Object.fromEntries(
      CAMPOS_EDITAVEIS.filter(campo => campos[campo] !== undefined).map(campo => [campo, campos[campo]])
    )
    if (!Object.keys(alteracoes).length) {
      throw new InvalidInputError('Nenhum campo válido para atualização.')
    }
    const normalizados = normalizarDados({ ...this, ...alteracoes })
    if (!normalizados) {
      throw new InvalidInputError('Dados inválidos para atualização do veículo.')
    }
    Object.assign(this, normalizados)
    return this
  }

  isReservadoPara(vendaCodigo) {
    return this.status === StatusVeiculo.RESERVADO && this.vendaCodigo === vendaCodigo
  }

  isVendidoPara(vendaCodigo) {
    return this.status === StatusVeiculo.VENDIDO && this.vendaCodigo === vendaCodigo
  }

  /**
   * Transação local da saga: reserva o veículo para a venda.
   * Retorna `true` se o estado mudou e `false` se a venda já detinha a reserva
   * (entrega duplicada do evento).
   */
  reservarPara(vendaCodigo) {
    if (this.isReservadoPara(vendaCodigo)) return false
    if (this.status !== StatusVeiculo.DISPONIVEL) {
      throw new BusinessRuleError('Veículo não está disponível para venda.')
    }
    this.status = StatusVeiculo.RESERVADO
    this.vendaCodigo = vendaCodigo
    return true
  }

  /**
   * Transação local da saga: conclui a venda do veículo reservado.
   */
  venderPara(vendaCodigo) {
    if (this.isVendidoPara(vendaCodigo)) return false
    if (!this.isReservadoPara(vendaCodigo)) {
      throw new BusinessRuleError('O veículo não está reservado para esta venda.')
    }
    this.status = StatusVeiculo.VENDIDO
    return true
  }

  /**
   * Transação de compensação: desfaz a reserva feita para a venda.
   * Não altera reservas de outras vendas.
   */
  liberarReservaDe(vendaCodigo) {
    if (!this.isReservadoPara(vendaCodigo)) return false
    this.status = StatusVeiculo.DISPONIVEL
    this.vendaCodigo = null
    return true
  }

  toPublic() {
    return {
      placa: this.placa,
      marca: this.marca,
      modelo: this.modelo,
      ano: this.ano,
      cor: this.cor,
      preco: this.preco,
      status: this.status
    }
  }

  toInternal() {
    return { id: this.id, ...this.toPublic() }
  }
}

export { StatusVeiculo, Veiculo }

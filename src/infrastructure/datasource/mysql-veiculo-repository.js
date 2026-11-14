import { VeiculoRepository } from '../../application/gateways/veiculo-repository.js'
import { Veiculo } from '../../domain/entities/veiculo.js'
import { DuplicateResourceError } from '../../domain/errors/duplicate-resource-error.js'

const SELECT_VEICULO = `SELECT id, placa, marca, modelo, ano, cor, preco, status, venda_codigo
  FROM veiculos`

const toVeiculo = (row) => new Veiculo({
  id: row.id,
  placa: row.placa,
  marca: row.marca,
  modelo: row.modelo,
  ano: row.ano,
  cor: row.cor,
  preco: row.preco == null ? row.preco : Number(row.preco),
  status: row.status,
  vendaCodigo: row.venda_codigo ?? null
})

class MysqlVeiculoRepository extends VeiculoRepository {
  constructor(db) {
    super()
    this.db = db
  }

  async listarPorStatus(status) {
    const [rows] = await this.db.execute(`${SELECT_VEICULO} WHERE status = ? ORDER BY preco`, [status])
    return rows.map(toVeiculo)
  }

  async buscarPorPlaca(placa) {
    const [rows] = await this.db.execute(`${SELECT_VEICULO} WHERE placa = ? LIMIT 1`, [placa])
    return rows[0] ? toVeiculo(rows[0]) : undefined
  }

  async criar(veiculo) {
    try {
      const [result] = await this.db.execute(
        'INSERT INTO veiculos (marca, modelo, ano, cor, placa, preco) VALUES (?, ?, ?, ?, ?, ?)',
        [veiculo.marca, veiculo.modelo, veiculo.ano, veiculo.cor, veiculo.placa, veiculo.preco]
      )
      return new Veiculo({ ...veiculo, id: result?.insertId ?? null })
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        throw new DuplicateResourceError('Veículo com essa placa já cadastrado.')
      }
      throw error
    }
  }

  async atualizarDados(veiculo) {
    await this.db.execute(
      'UPDATE veiculos SET marca = ?, modelo = ?, ano = ?, cor = ?, preco = ? WHERE placa = ?',
      [veiculo.marca, veiculo.modelo, veiculo.ano, veiculo.cor, veiculo.preco, veiculo.placa]
    )
  }

  async atualizarReserva(veiculo, estadoAnterior) {
    const [result] = await this.db.execute(
      `UPDATE veiculos SET status = ?, venda_codigo = ?
       WHERE placa = ? AND status = ? AND venda_codigo <=> ?`,
      [veiculo.status, veiculo.vendaCodigo, veiculo.placa, estadoAnterior.status, estadoAnterior.vendaCodigo]
    )
    return result.affectedRows > 0
  }
}

export { MysqlVeiculoRepository }

import assert from 'node:assert/strict'
import test from 'node:test'
import { StatusVeiculo, Veiculo } from '../../../src/domain/entities/veiculo.js'
import { BusinessRuleError } from '../../../src/domain/errors/business-rule-error.js'
import { InvalidInputError } from '../../../src/domain/errors/invalid-input-error.js'

const dados = { placa: 'abc-1d23', marca: ' Toyota ', modelo: 'Corolla', ano: '2024', cor: 'Branco', preco: '85000' }

test('Veiculo.criar normalizes data and starts available', () => {
  const veiculo = Veiculo.criar(dados)
  assert.deepEqual(veiculo.toPublic(), {
    placa: 'ABC1D23', marca: 'Toyota', modelo: 'Corolla', ano: 2024, cor: 'Branco', preco: 85000, status: 'DISPONIVEL'
  })
  assert.throws(() => Veiculo.criar({ ...dados, ano: 1800 }), InvalidInputError)
  assert.throws(() => Veiculo.criar({ ...dados, placa: 'X' }), InvalidInputError)
})

test('atualizar rejects plate changes, empty updates and non-available vehicles', () => {
  const veiculo = Veiculo.criar(dados)
  assert.throws(() => veiculo.atualizar({ placa: 'XYZ1A23' }), /placa/)
  assert.throws(() => veiculo.atualizar({}), /Nenhum campo/)
  assert.throws(() => veiculo.atualizar({ preco: -1 }), /Dados inválidos/)
  veiculo.atualizar({ cor: ' Preto ' })
  assert.equal(veiculo.cor, 'Preto')
  veiculo.reservarPara('VEN-00000001')
  assert.throws(() => veiculo.atualizar({ cor: 'Azul' }), /reservado ou vendido/)
})

test('saga transitions are idempotent and scoped to the owning sale', () => {
  const veiculo = Veiculo.criar(dados)
  assert.equal(veiculo.reservarPara('VEN-00000001'), true)
  assert.equal(veiculo.reservarPara('VEN-00000001'), false)
  assert.throws(() => veiculo.reservarPara('VEN-00000002'), BusinessRuleError)
  assert.throws(() => veiculo.venderPara('VEN-00000002'), BusinessRuleError)
  assert.equal(veiculo.liberarReservaDe('VEN-00000002'), false)
  assert.equal(veiculo.status, StatusVeiculo.RESERVADO)

  assert.equal(veiculo.venderPara('VEN-00000001'), true)
  assert.equal(veiculo.venderPara('VEN-00000001'), false)
  assert.equal(veiculo.liberarReservaDe('VEN-00000001'), false)
  assert.equal(veiculo.status, StatusVeiculo.VENDIDO)
})

test('liberarReservaDe returns the vehicle to the available pool', () => {
  const veiculo = Veiculo.criar(dados)
  veiculo.reservarPara('VEN-00000001')
  assert.equal(veiculo.liberarReservaDe('VEN-00000001'), true)
  assert.equal(veiculo.status, StatusVeiculo.DISPONIVEL)
  assert.equal(veiculo.vendaCodigo, null)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { ConcurrentUpdateError, VeiculoSagaUsecase } from '../../../src/application/usecases/veiculo-saga-usecase.js'
import { Veiculo } from '../../../src/domain/entities/veiculo.js'
import { InvalidInputError } from '../../../src/domain/errors/invalid-input-error.js'

const makeVeiculo = (overrides = {}) => new Veiculo({
  id: 7, placa: 'ABC1D23', marca: 'Toyota', modelo: 'Corolla', ano: 2024, cor: 'Branco', preco: 85000,
  status: 'DISPONIVEL', vendaCodigo: null, ...overrides
})

const makeContext = (veiculo, { conflict = false } = {}) => {
  const stored = veiculo
  const events = []
  const repository = {
    writes: 0,
    async buscarPorPlaca(placa) {
      return stored && placa === stored.placa ? new Veiculo({ ...stored }) : undefined
    },
    async atualizarReserva(atualizado, anterior) {
      if (conflict) return false
      assert.equal(stored.status, anterior.status)
      assert.equal(stored.vendaCodigo, anterior.vendaCodigo)
      Object.assign(stored, { status: atualizado.status, vendaCodigo: atualizado.vendaCodigo })
      this.writes++
      return true
    }
  }
  const publisher = { async publicar(tipo, payload) { events.push({ tipo, ...payload }) } }
  return { stored, events, repository, usecase: new VeiculoSagaUsecase(repository, publisher) }
}

const evento = { vendaCodigo: 'VEN-1234ABCD', veiculoPlaca: 'ABC1D23' }

test('VENDA_CRIADA reserves the vehicle and publishes VEICULO_RESERVADO, even on redelivery', async () => {
  const { stored, events, repository, usecase } = makeContext(makeVeiculo())
  await usecase.reservarParaVenda(evento)
  await usecase.reservarParaVenda(evento)
  assert.equal(stored.status, 'RESERVADO')
  assert.equal(stored.vendaCodigo, 'VEN-1234ABCD')
  assert.equal(repository.writes, 1)
  assert.deepEqual(events.map(e => e.tipo), ['VEICULO_RESERVADO', 'VEICULO_RESERVADO'])
  assert.equal(events[0].veiculoId, 7)
  assert.equal(events[0].preco, 85000)
})

test('VENDA_CRIADA for an unavailable or unknown vehicle publishes VEICULO_RESERVA_FALHOU', async () => {
  const reserved = makeContext(makeVeiculo({ status: 'RESERVADO', vendaCodigo: 'VEN-FFFFFFFF' }))
  await reserved.usecase.reservarParaVenda(evento)
  assert.equal(reserved.events[0].tipo, 'VEICULO_RESERVA_FALHOU')
  assert.equal(reserved.stored.vendaCodigo, 'VEN-FFFFFFFF')

  const missing = makeContext(null)
  await missing.usecase.reservarParaVenda(evento)
  assert.equal(missing.events[0].tipo, 'VEICULO_RESERVA_FALHOU')
  assert.equal(missing.events[0].motivo, 'Veículo não encontrado.')
})

test('PAGAMENTO_RECEBIDO sells only the vehicle reserved for the sale', async () => {
  const ok = makeContext(makeVeiculo({ status: 'RESERVADO', vendaCodigo: evento.vendaCodigo }))
  await ok.usecase.venderParaVenda(evento)
  await ok.usecase.venderParaVenda(evento)
  assert.equal(ok.stored.status, 'VENDIDO')
  assert.deepEqual(ok.events.map(e => e.tipo), ['VEICULO_VENDIDO', 'VEICULO_VENDIDO'])

  const other = makeContext(makeVeiculo({ status: 'RESERVADO', vendaCodigo: 'VEN-FFFFFFFF' }))
  await other.usecase.venderParaVenda(evento)
  assert.equal(other.events[0].tipo, 'VEICULO_VENDA_FALHOU')
  assert.equal(other.stored.status, 'RESERVADO')
})

test('VENDA_CANCELADA compensates the reservation without touching other sales', async () => {
  const own = makeContext(makeVeiculo({ status: 'RESERVADO', vendaCodigo: evento.vendaCodigo }))
  await own.usecase.liberarReserva(evento)
  assert.equal(own.stored.status, 'DISPONIVEL')
  assert.equal(own.stored.vendaCodigo, null)
  assert.equal(own.events[0].tipo, 'VEICULO_LIBERADO')

  const other = makeContext(makeVeiculo({ status: 'RESERVADO', vendaCodigo: 'VEN-FFFFFFFF' }))
  await other.usecase.liberarReserva(evento)
  assert.equal(other.stored.vendaCodigo, 'VEN-FFFFFFFF')
})

test('exhausted reservation releases a partial reservation and reports the failure', async () => {
  const { stored, events, usecase } = makeContext(makeVeiculo({ status: 'RESERVADO', vendaCodigo: evento.vendaCodigo }))
  await usecase.compensarReservaNaoProcessada(evento)
  assert.equal(stored.status, 'DISPONIVEL')
  assert.equal(events[0].tipo, 'VEICULO_RESERVA_FALHOU')
})

test('optimistic-lock conflicts are retried and invalid events are rejected', async () => {
  const { events, usecase } = makeContext(makeVeiculo(), { conflict: true })
  await assert.rejects(usecase.reservarParaVenda(evento), ConcurrentUpdateError)
  assert.equal(events.length, 0)
  await assert.rejects(usecase.reservarParaVenda({ vendaCodigo: 'x', veiculoPlaca: 'ABC1D23' }), InvalidInputError)
})

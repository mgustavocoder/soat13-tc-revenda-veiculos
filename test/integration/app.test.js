import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../../src/infrastructure/api/app.js'
import { controllersFactory } from '../../src/infrastructure/controllers/controllers-factory.js'

const silentLogger = { info() {}, warn() {}, error() {} }

const withServer = async (db, callback) => {
  const app = createApp({ ...controllersFactory({ db }), logger: silentLogger })
  const server = app.listen(0)
  await once(server, 'listening')
  try {
    await callback(`http://127.0.0.1:${server.address().port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

const row = {
  id: 7, placa: 'ABC1D23', marca: 'Toyota', modelo: 'Corolla', ano: 2024, cor: 'Branco',
  preco: '85000.00', status: 'DISPONIVEL', venda_codigo: null
}

test('public lookup hides internal fields while the internal lookup exposes the id', async () => {
  const db = { execute: async () => [[row]] }
  await withServer(db, async (baseUrl) => {
    const publicResponse = await fetch(`${baseUrl}/api/veiculos/abc-1d23`)
    assert.equal(publicResponse.status, 200)
    const publicBody = await publicResponse.json()
    assert.equal(publicBody.id, undefined)
    assert.equal(publicBody.preco, 85000)

    const internalResponse = await fetch(`${baseUrl}/internal/veiculos/ABC1D23`)
    assert.equal((await internalResponse.json()).id, 7)

    const invalid = await fetch(`${baseUrl}/api/veiculos/X`)
    assert.equal(invalid.status, 400)
  })
})

test('the status-changing internal endpoint was replaced by saga events', async () => {
  const db = { execute: async () => [[row]] }
  await withServer(db, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/internal/veiculos/ABC1D23/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'VENDIDO' })
    })
    assert.equal(response.status, 404)
  })
})

test('vehicle update persists editable fields and rejects reserved vehicles', async () => {
  let current = { ...row }
  const updates = []
  const db = {
    execute: async (sql, params) => {
      if (sql.startsWith('SELECT')) return [[current]]
      if (sql.startsWith('UPDATE')) {
        updates.push(params)
        return [{ affectedRows: 1 }]
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }
  await withServer(db, async (baseUrl) => {
    const put = (body) => fetch(`${baseUrl}/api/veiculos/ABC1D23`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    const ok = await put({ cor: 'Preto' })
    assert.equal(ok.status, 200)
    assert.equal((await ok.json()).cor, 'Preto')
    assert.deepEqual(updates[0], ['Toyota', 'Corolla', 2024, 'Preto', 85000, 'ABC1D23'])

    current = { ...row, status: 'RESERVADO', venda_codigo: 'VEN-1234ABCD' }
    const blocked = await put({ cor: 'Azul' })
    assert.equal(blocked.status, 400)
  })
})

test('vehicle creation maps duplicate plates to 409', async () => {
  const db = { execute: async () => { throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }) } }
  await withServer(db, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/veiculos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ placa: 'ABC1D23', marca: 'Toyota', modelo: 'Corolla', ano: 2024, cor: 'Branco', preco: 85000 })
    })
    assert.equal(response.status, 409)
  })
})

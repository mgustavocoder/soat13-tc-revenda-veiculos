import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../src/app.js'

const withServer = async (app, callback) => {
  const server = app.listen(0)
  await once(server, 'listening')
  try {
    await callback(`http://127.0.0.1:${server.address().port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

test('internal API changes vehicle availability without a database shared with sales', async () => {
  let currentStatus = 'DISPONIVEL'
  const vehicle = {
    id: 7,
    placa: 'ABC1D23',
    marca: 'Toyota',
    modelo: 'Corolla',
    ano: 2024,
    cor: 'Branco',
    preco: 85000,
    get status() { return currentStatus }
  }
  const db = {
    execute: async (sql, params) => {
      if (sql.startsWith('SELECT')) return [[{ ...vehicle, status: currentStatus }]]
      if (sql.startsWith('UPDATE')) {
        currentStatus = params[0]
        return [{ affectedRows: 1 }]
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    }
  }
  const app = createApp({ db })
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/internal/veiculos/ABC1D23/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'RESERVADO' })
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).status, 'RESERVADO')
    assert.equal(currentStatus, 'RESERVADO')
  })
})

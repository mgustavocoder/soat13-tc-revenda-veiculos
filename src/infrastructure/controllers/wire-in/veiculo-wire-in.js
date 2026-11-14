const asObject = (body) => (body && typeof body === 'object' && !Array.isArray(body) ? body : {})

class CreateVeiculoWireIn {
  static fromRequest(body) {
    const { placa, marca, modelo, ano, cor, preco } = asObject(body)
    return { placa, marca, modelo, ano, cor, preco }
  }
}

class UpdateVeiculoWireIn {
  /**
   * Mantém a chave `placa` quando enviada, para que o domínio rejeite a
   * tentativa de alteração da placa.
   */
  static fromRequest(body) {
    const campos = asObject(body)
    return Object.fromEntries(
      ['placa', 'marca', 'modelo', 'ano', 'cor', 'preco']
        .filter(campo => Object.hasOwn(campos, campo))
        .map(campo => [campo, campos[campo]])
    )
  }
}

export { CreateVeiculoWireIn, UpdateVeiculoWireIn }

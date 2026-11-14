/**
 * Eventos publicados pelo serviço de vendas na fila `vendas-eventos` aos quais
 * o serviço de veículos reage.
 */
const EventosVenda = Object.freeze({
  VENDA_CRIADA: 'VENDA_CRIADA',
  PAGAMENTO_RECEBIDO: 'PAGAMENTO_RECEBIDO',
  VENDA_CANCELADA: 'VENDA_CANCELADA'
})

export { EventosVenda }

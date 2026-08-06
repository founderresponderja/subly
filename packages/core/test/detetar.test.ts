import { describe, expect, test } from 'vitest'
import { detetarSubscricoes, type Transacao } from '../src'

function criarTransacao(input: {
  id: string
  data: string
  descritivo: string
  valor: number
}): Transacao {
  return {
    ...input,
    moeda: 'EUR',
    origem: 'csv',
  }
}

describe('detetarSubscricoes', () => {
  test('deteta mensal perfeito', () => {
    const transacoes = [
      criarTransacao({ id: '1', data: '2025-01-01', descritivo: 'COMPRA NETFLIX.COM', valor: -1299 }),
      criarTransacao({ id: '2', data: '2025-02-01', descritivo: 'COMPRA NETFLIX.COM', valor: -1299 }),
      criarTransacao({ id: '3', data: '2025-03-01', descritivo: 'COMPRA NETFLIX.COM', valor: -1299 }),
      criarTransacao({ id: '4', data: '2025-04-01', descritivo: 'COMPRA NETFLIX.COM', valor: -1299 }),
    ]

    const resultado = detetarSubscricoes(transacoes)
    expect(resultado).toHaveLength(1)
    expect(resultado[0]?.periodicidade).toBe('mensal')
    expect(resultado[0]?.valorTipico).toBe(1299)
    expect(resultado[0]?.proximoPagamentoEstimado).toBe('2025-05-01')
  })

  test('deteta mensal com uma falha de cobrança', () => {
    const transacoes = [
      criarTransacao({ id: '1', data: '2025-01-15', descritivo: 'COMPRA SPOTIFY', valor: -899 }),
      criarTransacao({ id: '2', data: '2025-02-15', descritivo: 'COMPRA SPOTIFY', valor: -899 }),
      criarTransacao({ id: '3', data: '2025-04-15', descritivo: 'COMPRA SPOTIFY', valor: -899 }),
      criarTransacao({ id: '4', data: '2025-05-15', descritivo: 'COMPRA SPOTIFY', valor: -899 }),
      criarTransacao({ id: '5', data: '2025-06-15', descritivo: 'COMPRA SPOTIFY', valor: -899 }),
    ]

    const resultado = detetarSubscricoes(transacoes)
    expect(resultado).toHaveLength(1)
    expect(resultado[0]?.periodicidade).toBe('mensal')
  })

  test('deteta variação de preço persistente', () => {
    const transacoes = [
      criarTransacao({ id: '1', data: '2025-01-10', descritivo: 'DD SEPA NOS COMUNICACOES SA', valor: -3000 }),
      criarTransacao({ id: '2', data: '2025-02-10', descritivo: 'DD SEPA NOS COMUNICACOES SA', valor: -3000 }),
      criarTransacao({ id: '3', data: '2025-03-10', descritivo: 'DD SEPA NOS COMUNICACOES SA', valor: -3000 }),
      criarTransacao({ id: '4', data: '2025-04-10', descritivo: 'DD SEPA NOS COMUNICACOES SA', valor: -3300 }),
      criarTransacao({ id: '5', data: '2025-05-10', descritivo: 'DD SEPA NOS COMUNICACOES SA', valor: -3300 }),
      criarTransacao({ id: '6', data: '2025-06-10', descritivo: 'DD SEPA NOS COMUNICACOES SA', valor: -3300 }),
    ]

    const resultado = detetarSubscricoes(transacoes)
    expect(resultado).toHaveLength(1)
    expect(resultado[0]?.variacaoPreco).toEqual({
      anterior: 3000,
      atual: 3300,
      desde: '2025-04-10',
    })
  })

  test('deteta anual', () => {
    const transacoes = [
      criarTransacao({ id: '1', data: '2022-03-10', descritivo: 'COMPRA AMAZON PRIME VIDEO', valor: -4990 }),
      criarTransacao({ id: '2', data: '2023-03-10', descritivo: 'COMPRA AMAZON PRIME VIDEO', valor: -4990 }),
      criarTransacao({ id: '3', data: '2024-03-09', descritivo: 'COMPRA AMAZON PRIME VIDEO', valor: -4990 }),
    ]

    const resultado = detetarSubscricoes(transacoes)
    expect(resultado).toHaveLength(1)
    expect(resultado[0]?.periodicidade).toBe('anual')
  })

  test('não deteta compras irregulares no mesmo comerciante', () => {
    const transacoes = [
      criarTransacao({ id: '1', data: '2025-01-02', descritivo: 'COMPRA CONTINENTE', valor: -2100 }),
      criarTransacao({ id: '2', data: '2025-01-11', descritivo: 'COMPRA CONTINENTE', valor: -4700 }),
      criarTransacao({ id: '3', data: '2025-02-03', descritivo: 'COMPRA CONTINENTE', valor: -3200 }),
      criarTransacao({ id: '4', data: '2025-03-22', descritivo: 'COMPRA CONTINENTE', valor: -5800 }),
      criarTransacao({ id: '5', data: '2025-04-05', descritivo: 'COMPRA CONTINENTE', valor: 1200 }),
      criarTransacao({ id: '6', data: '2025-04-17', descritivo: 'COMPRA CONTINENTE', valor: -2600 }),
    ]

    const resultado = detetarSubscricoes(transacoes)
    expect(resultado).toHaveLength(0)
  })

  test('respeita data de referência opcional', () => {
    const transacoes = [
      criarTransacao({ id: '1', data: '2025-01-01', descritivo: 'COMPRA NETFLIX.COM', valor: -1299 }),
      criarTransacao({ id: '2', data: '2025-02-01', descritivo: 'COMPRA NETFLIX.COM', valor: -1299 }),
      criarTransacao({ id: '3', data: '2025-03-01', descritivo: 'COMPRA NETFLIX.COM', valor: -1299 }),
      criarTransacao({ id: '4', data: '2025-04-01', descritivo: 'COMPRA NETFLIX.COM', valor: -1299 }),
    ]

    const resultado = detetarSubscricoes(transacoes, '2025-03-05')
    expect(resultado).toHaveLength(1)
    expect(resultado[0]?.transacoes).toHaveLength(3)
    expect(resultado[0]?.proximoPagamentoEstimado).toBe('2025-03-31')
  })
})

import { expect, expectTypeOf, test } from 'vitest'
import { normalizarDescritivo, type Categoria, type Comerciante, type Subscricao, type Transacao } from '../src'

test('o pacote exporta os tipos e compila', () => {
  expectTypeOf<Transacao['origem']>().toEqualTypeOf<'pdf' | 'csv' | 'colado'>()
  expectTypeOf<Categoria>().toEqualTypeOf<
    | 'streaming'
    | 'telecomunicacoes'
    | 'ginasio'
    | 'seguros'
    | 'energia'
    | 'software'
    | 'transporte'
    | 'outro'
  >()
  expectTypeOf<Comerciante['categoria']>().toEqualTypeOf<Categoria>()
  expectTypeOf<Subscricao['transacoes']>().toEqualTypeOf<Transacao[]>()
})

test('o pacote exporta normalizarDescritivo', () => {
  const resultado = normalizarDescritivo('COMPRA 1234 SPOTIFY STOCKHOLM')
  expect(resultado.limpo).toBe('spotify')
})

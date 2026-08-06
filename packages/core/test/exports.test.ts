import { expectTypeOf, test } from 'vitest'
import type { Categoria, Comerciante, Subscricao, Transacao } from '../src'

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

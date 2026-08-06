import { describe, expect, test } from 'vitest'
import { normalizarDescritivo } from '../src'

type Caso = {
  nome: string
  bruto: string
  limpoEsperado: string
  pistaEsperada?: string
}

const casosBase: Caso[] = [
  {
    nome: 'compra com cidade no fim',
    bruto: 'COMPRA 5678 NETFLIX.COM         AMSTERDAM',
    limpoEsperado: 'netflix com',
    pistaEsperada: 'netflix',
  },
  {
    nome: 'dd sepa com referencia',
    bruto: 'DD SEPA NOS COMUNICACOES SA REF 000123456',
    limpoEsperado: 'nos comunicacoes sa',
    pistaEsperada: 'nos comunicacoes',
  },
  {
    nome: 'transferencia mb way para particular',
    bruto: 'TRF MB WAY P/ JOAO S.',
    limpoEsperado: 'joao s',
    pistaEsperada: 'joao s',
  },
  {
    nome: 'pagamento de servicos so com identificadores',
    bruto: 'PAG SERV 21587 ENTIDADE 20194 REF 999888777',
    limpoEsperado: '21587',
    pistaEsperada: '21587',
  },
  {
    nome: 'compra com terminal no nome',
    bruto: 'COMPRA CONT MOD-MATOSINHOS',
    limpoEsperado: 'cont mod matosinhos',
    pistaEsperada: 'cont mod',
  },
  {
    nome: 'debito direto',
    bruto: 'DEB DIRECTO EDP COMERCIAL SA',
    limpoEsperado: 'edp comercial sa',
    pistaEsperada: 'edp comercial',
  },
  {
    nome: 'compra com codigo de autorizacao',
    bruto: 'COMPRA 1234 SPOTIFY P0A1B2C3 STOCKHOLM',
    limpoEsperado: 'spotify',
    pistaEsperada: 'spotify',
  },
  {
    nome: 'levantamento multibanco',
    bruto: 'LEVANTAMENTO MB 0123 LISBOA',
    limpoEsperado: '0123',
    pistaEsperada: '0123',
  },
]

const variacoes: Caso[] = [
  {
    nome: 'dd sepa com acentos e espacos',
    bruto: '  DD   SEPA   ÁGUAS   DO  PORTO   SA   REF  00112233  ',
    limpoEsperado: 'aguas do porto sa',
    pistaEsperada: 'aguas do',
  },
  {
    nome: 'compra com terminal etiquetado',
    bruto: 'COMPRA GALP TERMINAL 8899 PORTO',
    limpoEsperado: 'galp',
    pistaEsperada: 'galp',
  },
  {
    nome: 'compra com codigo e cidade portuguesa',
    bruto: 'COMPRA 4321 UBER BV 9A8B7C6D LISBOA',
    limpoEsperado: 'uber bv',
    pistaEsperada: 'uber bv',
  },
  {
    nome: 'trf sem mb way explicito',
    bruto: 'TRF P/ Maria da Silva',
    limpoEsperado: 'maria da silva',
    pistaEsperada: 'maria da',
  },
  {
    nome: 'mb way sem prefixo trf',
    bruto: 'MB WAY P/ JOSE C',
    limpoEsperado: 'jose c',
    pistaEsperada: 'jose c',
  },
  {
    nome: 'debito direto com cidade no fim',
    bruto: 'DEB DIRECTO MEO - SERVICOS DE COMUNICACOES LISBOA',
    limpoEsperado: 'meo servicos de comunicacoes',
    pistaEsperada: 'meo servicos',
  },
  {
    nome: 'pagamento servicos com labels minusculas',
    bruto: 'pag serv entidade 24567 ref 123456789 EDP COMERCIAL',
    limpoEsperado: 'edp comercial',
    pistaEsperada: 'edp comercial',
  },
  {
    nome: 'compra com sufixo de pais',
    bruto: 'COMPRA 1111 AMAZON EU S A MADRID',
    limpoEsperado: 'amazon eu s a',
    pistaEsperada: 'amazon eu',
  },
  {
    nome: 'compra sem ruido extra',
    bruto: 'COMPRA CONTINENTE',
    limpoEsperado: 'continente',
    pistaEsperada: 'continente',
  },
  {
    nome: 'levantamento com cidade internacional',
    bruto: 'LEVANTAMENTO MB 9988 LONDON',
    limpoEsperado: '9988',
    pistaEsperada: '9988',
  },
]

describe('normalizarDescritivo', () => {
  test.each([...casosBase, ...variacoes])('$nome', ({ bruto, limpoEsperado, pistaEsperada }) => {
    const resultado = normalizarDescritivo(bruto)

    expect(resultado.limpo).toBe(limpoEsperado)
    expect(resultado.pistas.length).toBeGreaterThan(0)

    if (pistaEsperada) {
      expect(resultado.pistas).toContain(pistaEsperada)
    }
  })

  test('degrada com elegancia em descritivo irreconhecivel', () => {
    const resultado = normalizarDescritivo('@@@ ??? ### sem padrão bancário !!!')
    expect(resultado.limpo).toBe('sem padrao bancario')
    expect(resultado.limpo.length).toBeGreaterThan(0)
    expect(resultado.pistas).toContain('sem padrao bancario')
  })

  test('é determinística e não altera o input', () => {
    const bruto = 'COMPRA 5678 NETFLIX.COM AMSTERDAM'
    const primeira = normalizarDescritivo(bruto)
    const segunda = normalizarDescritivo(bruto)

    expect(bruto).toBe('COMPRA 5678 NETFLIX.COM AMSTERDAM')
    expect(primeira).toEqual(segunda)
  })
})

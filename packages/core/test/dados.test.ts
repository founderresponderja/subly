import { describe, expect, test } from 'vitest'
import { identificarComerciante, merchantsPt } from '../src'

describe('merchants.pt.json', () => {
  test('tem pelo menos 40 fornecedores', () => {
    expect(merchantsPt.length).toBeGreaterThanOrEqual(40)
  })

  test('falha se preAvisoDias estiver preenchido sem fonte', () => {
    for (const merchant of merchantsPt) {
      const { preAvisoDias, fonte } = merchant.cancelamento
      if (preAvisoDias !== null) {
        expect(fonte.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

describe('identificarComerciante', () => {
  test('corresponde ignorando maiúsculas/minúsculas', () => {
    const merchant = identificarComerciante('nos comunicacoes sa')
    expect(merchant?.id).toBe('nos')
  })

  test('corresponde ignorando acentos', () => {
    const merchant = identificarComerciante('vódáfóné portugal')
    expect(merchant?.id).toBe('vodafone')
  })

  test('padrão mais específico ganha ao genérico', () => {
    const merchant = identificarComerciante('pagamento amazon prime video mensal')
    expect(merchant?.id).toBe('prime-video')
  })

  test('retorna null quando não encontra correspondência', () => {
    const merchant = identificarComerciante('comerciante desconhecido xyz')
    expect(merchant).toBeNull()
  })

  test('mapeia exemplos reais dos fornecedores', () => {
    expect(identificarComerciante('netflix com amsterdam')?.id).toBe('netflix')
    expect(identificarComerciante('spotify stockholM')?.id).toBe('spotify')
    expect(identificarComerciante('edp comercial sa')?.id).toBe('edp-comercial')
    expect(identificarComerciante('fitness hut mensalidade')?.id).toBe('fitness-hut')
    expect(identificarComerciante('openai chatgpt plus')?.id).toBe('chatgpt')
    expect(identificarComerciante('uber one b v')?.id).toBe('uber-one')
  })
})

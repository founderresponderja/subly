// Valores monetários são sempre representados em cêntimos inteiros (nunca em euros com decimais).

export type Transacao = {
  id: string
  data: string
  descritivo: string
  valor: number
  moeda: string
  origem: 'pdf' | 'csv' | 'colado'
}

export type Comerciante = {
  id: string
  nome: string
  categoria: Categoria
  confianca: number
}

export type Categoria =
  | 'streaming'
  | 'telecomunicacoes'
  | 'ginasio'
  | 'seguros'
  | 'energia'
  | 'software'
  | 'transporte'
  | 'outro'

export type Subscricao = {
  id: string
  comerciante: Comerciante
  valorTipico: number
  periodicidade: 'mensal' | 'trimestral' | 'semestral' | 'anual'
  transacoes: Transacao[]
  proximoPagamentoEstimado: string | null
  confianca: number
  variacaoPreco: { anterior: number; atual: number; desde: string } | null
}

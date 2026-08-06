type ResultadoNormalizacao = {
  limpo: string
  pistas: string[]
}

type Regra = {
  nome: string
  aplicar: (entrada: string) => string
}

const LOCATION_SUFFIXES = new Set([
  'AMSTERDAM',
  'BARCELONA',
  'BERLIN',
  'BRAGA',
  'COIMBRA',
  'DUBLIN',
  'FARO',
  'LISBOA',
  'LONDON',
  'LONDRES',
  'MADRID',
  'MILANO',
  'PARIS',
  'PORTO',
  'ROMA',
  'STOCKHOLM',
  'VALENCIA',
])

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function toComparable(value: string): string {
  return collapseSpaces(
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
  )
}

function stripTrailingLocations(value: string): string {
  const tokens = collapseSpaces(value).split(' ').filter(Boolean)
  while (tokens.length > 1) {
    const lastToken = tokens[tokens.length - 1]?.toUpperCase() ?? ''
    if (!LOCATION_SUFFIXES.has(lastToken)) {
      break
    }
    tokens.pop()
  }
  return tokens.join(' ')
}

function runRules(value: string, rules: Regra[]): string {
  return rules.reduce((current, rule) => {
    const updated = rule.aplicar(current)
    return collapseSpaces(updated)
  }, value)
}

function buildPistas(limpo: string): string[] {
  if (!limpo) {
    return []
  }

  const tokens = limpo.split(' ').filter(Boolean)
  const pistas = new Set<string>([limpo])

  const removableTailTokens = new Set(['sa', 's', 'a', 'lda', 'unipessoal', 'com', 'pt'])
  const coreTokens = [...tokens]
  while (coreTokens.length > 1) {
    const tail = coreTokens[coreTokens.length - 1]
    if (!tail || !removableTailTokens.has(tail)) {
      break
    }
    coreTokens.pop()
  }

  if (coreTokens.length > 0) {
    pistas.add(coreTokens.join(' '))
  }
  if (tokens.length > 1) {
    pistas.add(tokens.slice(0, 2).join(' '))
  }
  if (coreTokens.length > 1) {
    pistas.add(coreTokens.slice(0, 2).join(' '))
  }

  return Array.from(pistas).filter(Boolean)
}

const regrasPrefixo: Regra[] = [
  {
    // Padrão comum em cartões de débito/crédito de bancos portugueses.
    nome: 'compra-prefixo',
    aplicar: (entrada) => entrada.replace(/^COMPRA\b\s*/i, ''),
  },
  {
    // Débito direto SEPA usado por bancos como Caixa Geral de Depósitos e BPI.
    nome: 'dd-sepa-prefixo',
    aplicar: (entrada) => entrada.replace(/^DD\s+SEPA\b\s*/i, ''),
  },
  {
    // Transferências MB WAY visíveis em extratos de vários bancos.
    nome: 'trf-mbway-prefixo',
    aplicar: (entrada) =>
      entrada.replace(/^TRF(?:\s+MB\s+WAY)?(?:\s+P\/)?\s*/i, '').replace(/^MB\s+WAY\s+P\/\s*/i, ''),
  },
  {
    // Pagamentos de serviços via entidade/referência (Multibanco).
    nome: 'pag-serv-prefixo',
    aplicar: (entrada) => entrada.replace(/^PAG\s+SERV\b\s*/i, ''),
  },
  {
    // Variação de débito direto em extratos portugueses.
    nome: 'deb-direto-prefixo',
    aplicar: (entrada) => entrada.replace(/^DEB\s+DIRECTO\b\s*/i, ''),
  },
  {
    // Levantamentos em ATM da rede Multibanco.
    nome: 'levantamento-mb-prefixo',
    aplicar: (entrada) => entrada.replace(/^LEVANTAMENTO\s+MB\b\s*/i, ''),
  },
]

const regrasRuidoBasico: Regra[] = [
  {
    // "ENTIDADE 12345" em pagamentos de serviços (Multibanco).
    nome: 'entidade-referencia',
    aplicar: (entrada) => entrada.replace(/\bENTIDADE\b\s*\d+\b/gi, ' '),
  },
  {
    // "REF 999..." em débitos diretos e pagamentos de serviços.
    nome: 'referencia-ref',
    aplicar: (entrada) => entrada.replace(/\bREF\b\s*[:\-]?\s*[A-Z0-9]+\b/gi, ' '),
  },
  {
    // "TERMINAL 1234" frequente em operações de cartão.
    nome: 'terminal-id',
    aplicar: (entrada) => entrada.replace(/\bTERMINAL\b\s*[A-Z0-9]+\b/gi, ' '),
  },
]

const regrasRuidoAgressivo: Regra[] = [
  {
    // Códigos alfanuméricos de autorização (ex.: P0A1B2C3).
    nome: 'auth-code',
    aplicar: (entrada) => entrada.replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,}\b/g, ' '),
  },
  {
    // Números de cartão/terminal no início de compras.
    nome: 'leading-card-number',
    aplicar: (entrada) => entrada.replace(/^\d{4,}\b/, ' '),
  },
  {
    // Identificadores numéricos longos (referências e IDs transacionais).
    nome: 'long-numeric-id',
    aplicar: (entrada) => entrada.replace(/\b\d{6,}\b/g, ' '),
  },
]

export function normalizarDescritivo(bruto: string): ResultadoNormalizacao {
  const originalCompact = collapseSpaces(bruto)
  if (!originalCompact) {
    return { limpo: '', pistas: [] }
  }

  const semPrefixos = runRules(originalCompact, regrasPrefixo)
  const semRuidoBasico = runRules(semPrefixos, regrasRuidoBasico)
  const semRuidoAgressivo = runRules(semRuidoBasico, regrasRuidoAgressivo)
  const limpoPrimario = toComparable(stripTrailingLocations(semRuidoAgressivo))

  const limpoFallback = toComparable(stripTrailingLocations(semRuidoBasico))
  const limpo = limpoPrimario || limpoFallback || toComparable(originalCompact)

  return {
    limpo,
    pistas: buildPistas(limpo),
  }
}

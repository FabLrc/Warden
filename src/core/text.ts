const stopwords = new Set(["the", "and", "for", "with", "this", "that", "from", "into", "not", "are", "was", "has", "have", "can", "will", "your", "our", "their", "all", "any"])

export function objectiveTokens(objective: string): string[] {
  return objective.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !stopwords.has(token))
}

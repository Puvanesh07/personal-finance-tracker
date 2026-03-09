export function createId(prefix = 'id') {
  // Reasonably unique for a local-only app.
  return `${prefix}_${crypto.randomUUID()}`
}


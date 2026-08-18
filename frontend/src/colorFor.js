const AVATAR_COLORS = ['#c9704f', '#5b7f6b', '#6d6ab8', '#b8894f', '#4f8fa8', '#a8567e']

export function colorFor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export type Modo = 'show' | 'ask' | 'hidden'

declare module 'claude-code' {
  interface PluginState {
    'botones-commit': { modo: Modo }
  }
}

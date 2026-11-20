import type { TeaApi } from '../../shared/api'

declare global {
  interface Window {
    tea: TeaApi
  }
}

export {}

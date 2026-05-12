import type { Component } from 'vue'

export interface ExternalSourcePlugin {
  id: string
  name: string
  icon: string
  description: string
  component: Component
}

export interface ImportSubmitPayload {
  source: string
  url: string
  title?: string
  profile?: string
}

import type { ExternalSourcePlugin } from './types'
import YouTubeSongPlugin from './YouTubeSongPlugin.vue'

const plugins: ExternalSourcePlugin[] = [
  {
    id: 'youtube-song',
    name: 'Single YouTube Song',
    icon: 'pi pi-play-circle',
    description: 'Download audio from a YouTube video URL',
    component: YouTubeSongPlugin,
  },
]

export function getExternalSourcePlugins(): ExternalSourcePlugin[] {
  return plugins
}

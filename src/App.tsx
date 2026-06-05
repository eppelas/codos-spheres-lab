import { useState } from 'react'

import { ContextGraph } from './ContextGraph'
import { FireflyProgramExperience } from './FireflyProgramExperience'
import { ParticleField } from './ParticleField'
import { WireSphereFieldThree } from './WireSphereFieldThree'
import type { TrackId } from './programTracks'

export default function App() {
  const variant = window.location.pathname.toLowerCase().includes('firefly')
    || new URLSearchParams(window.location.search).get('variant') === 'firefly'
  const [activeTrack, setActiveTrack] = useState<TrackId>('founders')

  return (
    <main className={`animation-shell${variant ? ' animation-shell--wire' : ''}`} data-variant={variant ? 'firefly' : 'codos'}>
      {variant ? <WireSphereFieldThree activeTrack={activeTrack} onTrackFocus={setActiveTrack} /> : <ParticleField />}
      <div className="scroll-rail" aria-hidden="true">
        <section className="scroll-anchor scroll-anchor--home" />
      </div>
      {variant ? <FireflyProgramExperience activeTrack={activeTrack} onTrackChange={setActiveTrack} /> : <ContextGraph />}
      <div className="scroll-rail" aria-hidden="true">
        <section className="scroll-anchor scroll-anchor--wide" />
        <section className="scroll-anchor scroll-anchor--compression" />
        <section className="scroll-anchor scroll-anchor--release" />
        <section className="scroll-anchor scroll-anchor--afterglow" />
        <section className="scroll-anchor scroll-anchor--vanish" />
      </div>
    </main>
  )
}

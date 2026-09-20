"use client";

import { useState } from "react";
import { ConnectedJourney } from "./ConnectedJourney";
import { FinalCTA } from "./FinalCTA";
import { HeroScene } from "./HeroScene";
import { KineticMenu } from "./KineticMenu";
import { ModulesScene } from "./ModulesScene";
import { Navbar } from "./Navbar";
import { ProductWorld } from "./ProductWorld";
import { ScrollProgress } from "./ScrollProgress";
import { SocialChaosScene } from "./SocialChaosScene";

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="site-shell">
      {/* One persistent atmosphere for the whole page. Every section used to paint its
          own opaque backdrop starting from flat #0b0a14, so each boundary reset the world
          and the scroll read as page 1 -> page 2. Sections are transparent now and this
          field drifts underneath them, lit by --world-y which the scroll drives. */}
      <div className="world-atmos" aria-hidden="true">
        <i className="world-violet" />
        <i className="world-magenta" />
        <i className="world-cyan" />
      </div>
      <ScrollProgress />
      <Navbar menuOpen={menuOpen} onMenuClick={() => setMenuOpen((open) => !open)} />
      <KineticMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <HeroScene />
      <SocialChaosScene />
      <ModulesScene />
      <ConnectedJourney />
      <ProductWorld />
      <FinalCTA />
    </main>
  );
}

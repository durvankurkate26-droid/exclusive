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

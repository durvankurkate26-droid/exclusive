import { journeySteps } from "@/lib/constants/landing";
import { Reveal } from "./Reveal";

export function ConnectedJourney() {
  return (
    <section className="journey-section" aria-labelledby="journey-title">
      <Reveal className="journey-heading">
        <p className="eyebrow text-[var(--pink)]">NOT 5 FEATURES · ONE LOOP</p>
        <h2 id="journey-title">EVERYTHING A GROUP DOES,<br /><span>START TO MEMORY.</span></h2>
        <p>An idea in TEA becomes a someday in ONE DAY, gets locked in ALIGN, made real in CREATE, and lives forever in VAULT. The loop your group already runs — finally kept in one place.</p>
      </Reveal>
      <Reveal className="journey-flow" delay={0.08}>
        {journeySteps.map((step, index) => (
          <div className="journey-node-wrap" key={step.room}>
            <article className="journey-node" data-accent={step.accent}>
              <p>{step.label}</p>
              <h3>{step.room}</h3>
              <span>{step.copy}</span>
            </article>
            {index < journeySteps.length - 1 && <i className="journey-arrow" aria-hidden="true">→</i>}
          </div>
        ))}
      </Reveal>
      <Reveal className="journey-loop" delay={0.16}>↳ AND THE MEMORY SPARKS THE NEXT IDEA ↺</Reveal>
    </section>
  );
}

import { Reveal } from "./Reveal";

export function ProductWorld() {
  return (
    <section className="product-world" aria-labelledby="world-title">
      <Reveal className="world-heading">
        <p className="eyebrow text-[var(--pink)]">↳ YOU'RE INSIDE NOW</p>
        <h2 id="world-title">A ROOM THAT ONLY MAKES SENSE IF YOU WERE THERE.</h2>
      </Reveal>
      <div className="world-grid">
        <Reveal className="world-card world-tea">
          <p>01 · TEA</p><h3>SPILL, SAFELY</h3>
          <span>Threads that disappear from the timeline but never from the room. Screenshots die at the door.</span>
          <div className="mini-chat"><i>wait WHAT happened 👀</i><i>not here i can&apos;t 💀</i></div>
        </Reveal>
        <Reveal className="world-card world-one-day" delay={0.06}>
          <div><p>03 · ONE DAY</p><h3>SOMEDAY,<br />SCHEDULED</h3></div>
          <div className="goa-card"><b>📍 GOA · winter</b><i /><span>7 in · 2 maybe · 1 &quot;budget?&quot;</span></div>
        </Reveal>
        <Reveal className="world-card world-create" delay={0.04}>
          <div><p>02 · CREATE</p><h3>MAKE THE<br />DAMN REEL</h3></div>
          <div className="play-row"><i>▶</i><span>shared timeline · 4 clips</span></div>
        </Reveal>
        <Reveal className="world-card world-align" delay={0.1}>
          <div><p>04 · ALIGN</p><h3>FREE<br />SATURDAY?</h3></div>
          <div className="availability">{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</div>
        </Reveal>
        <Reveal className="world-card world-vault" delay={0.16}>
          <p>05 · VAULT</p><h3>THE GOOD<br />ONES</h3>
          <div className="vault-grid">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>
        </Reveal>
      </div>
    </section>
  );
}

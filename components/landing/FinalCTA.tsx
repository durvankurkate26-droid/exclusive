"use client";

import { FormEvent, useState } from "react";
import { Reveal } from "./Reveal";

export function FinalCTA() {
  const [message, setMessage] = useState("");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = String(form.get("contact") ?? "").trim();
    setMessage(value ? "you're on the list. tell nobody. 🤫" : "drop something first 👀");
  };

  return (
    <section id="access" className="final-cta" aria-labelledby="access-title">
      <Reveal className="cta-inner">
        <p className="eyebrow text-[var(--pink)]">INVITE-ONLY · BY YOUR PEOPLE</p>
        <h2 id="access-title">NOT FOR EVERYONE.<br /><span>JUST FOR YOURS.</span></h2>
        <p>Drop your number. When your group gets a key, you&apos;ll be the reason.</p>
        <form onSubmit={onSubmit} noValidate>
          <label className="sr-only" htmlFor="contact">Your social handle or phone number</label>
          <input id="contact" name="contact" type="text" placeholder="your @ or number" autoComplete="tel" />
          <button type="submit">get us in ↗</button>
        </form>
        <div className="form-message" aria-live="polite">{message}</div>
      </Reveal>
      <footer>
        <span className="footer-brand">EXCLUSIVE</span>
        <span>TEA · CREATE · ONE DAY · ALIGN · VAULT</span>
        <span>© 2026 · STILL AWAKE</span>
      </footer>
    </section>
  );
}

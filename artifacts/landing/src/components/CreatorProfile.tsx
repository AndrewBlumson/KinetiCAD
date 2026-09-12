import { ArrowUpRight, Globe, Building2 } from 'lucide-react';
import { FaLinkedinIn, FaXTwitter } from 'react-icons/fa6';
import { CREATOR_LINKS } from '../lib/creatorLinks';
import { KINETICAD_SUPPORT_URL } from '../../../shared/support';
import './CreatorProfile.css';

const icons = { website: Globe, adevious: Building2, x: FaXTwitter, linkedin: FaLinkedinIn };

export function CreatorProfile() {
  return <section id="creator" aria-labelledby="creator-heading" className="creator-profile">
    <div className="creator-profile__inner">
      <div className="creator-profile__intro">
        <p className="creator-profile__eyebrow">The person behind KinetiCAD</p>
        <h2 id="creator-heading">Created by<br /><span>Andrew Blumson.</span></h2>
        <p className="creator-profile__description">Replit UK Ambassador, creator of KinetiCAD and founder of Adevious AI. Explore Andrew’s projects, follow what he’s building, or visit Adevious for bespoke software and practical AI training.</p>
        <p className="creator-profile__description">KinetiCAD is free to use. If it helps you, you can support its development with an optional donation.</p>
        <p className="creator-byline"><a href={KINETICAD_SUPPORT_URL} target="_blank" rel="noopener noreferrer">Support KinetiCAD <span aria-hidden="true">↗</span><span className="sr-only"> on Buy Me a Coffee (opens in a new tab)</span></a></p>
      </div>
      <nav aria-label="Andrew Blumson’s websites and social profiles" className="creator-profile__links">
        {CREATOR_LINKS.map(link => {
          const Icon = icons[link.id];
          return <a key={link.id} href={link.href} target="_blank" rel="noopener noreferrer" className="creator-profile__link">
            <Icon size={21} aria-hidden="true" className="creator-profile__icon" />
            <span className="creator-profile__link-copy"><strong>{link.label}</strong><span>{link.caption}</span></span>
            <ArrowUpRight size={17} aria-hidden="true" className="creator-profile__arrow" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>;
        })}
      </nav>
    </div>
  </section>;
}

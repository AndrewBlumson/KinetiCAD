import { Link } from "wouter";
import { CREATOR_LINKS } from "@/lib/creatorLinks";
import "./SiteFooter.css";

const LOGO = `${import.meta.env.BASE_URL}logo.webp`;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__top">
          <div className="site-footer__identity">
            <Link href="/" className="site-footer__brand" aria-label="KinetiCAD home">
              <img src={LOGO} alt="" width={36} height={36} draggable={false} />
              <span>KinetiCAD</span>
            </Link>
            <p className="site-footer__attribution">Created by <strong>Andrew Blumson</strong></p>
          </div>

          <div className="site-footer__navigation">
            <nav className="site-footer__pages" aria-label="Footer navigation">
              <Link href="/">Home</Link>
              <Link href="/story">Story</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
            </nav>
            <nav className="site-footer__profiles" aria-label="Andrew Blumson profiles">
              {CREATOR_LINKS.map((profile) => (
                <a key={profile.id} href={profile.href} title={profile.caption} target="_blank" rel="noopener noreferrer">
                  {profile.label}<span aria-hidden="true">↗</span>
                  <span className="site-footer__sr-only"> (opens in a new tab)</span>
                </a>
              ))}
            </nav>
          </div>
        </div>

        <div className="site-footer__bottom">
          <div className="site-footer__company">
            <p className="site-footer__copyright">© 2026 Adevious Ltd. All rights reserved.</p>
            <p>Adevious AI is a trading name of Adevious Ltd. Company No. 08550853, registered in England and Wales.</p>
            <p>Registered Office: Rosedean House, 4 Argyle Road, Barnet, England, EN5 4DX</p>
          </div>
          <div className="site-footer__contact">
            <a href="https://kineticad.co.uk">kineticad.co.uk</a>
            <a href="mailto:support@adevious.co.uk">support@adevious.co.uk</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

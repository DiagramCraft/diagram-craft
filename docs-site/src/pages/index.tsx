import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import type {ReactElement} from 'react';

const ArrowRight = () => (
  <svg className="doc-hub-card-link-arrow" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6.5"/>
    <path d="M8 5v3.5L10.5 10" strokeLinecap="round"/>
  </svg>
);

const EntityIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1.5" y="1.5" width="5" height="5" rx="1"/>
    <rect x="9.5" y="1.5" width="5" height="5" rx="1"/>
    <rect x="1.5" y="9.5" width="5" height="5" rx="1"/>
    <path d="M12 9.5v5M9.5 12h5" strokeLinecap="round"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6.5"/>
    <path d="M8 5v4M8 11v.5" strokeLinecap="round"/>
  </svg>
);

type QuickLink = {
  icon: ReactElement;
  label: string;
  to: string;
};

type ProductCardProps = {
  accentColor: string;
  icon: ReactElement;
  name: string;
  badge?: { label: string; warn?: boolean };
  description: string;
  links: QuickLink[];
  dim?: boolean;
};

function ProductCard({accentColor, icon, name, badge, description, links, dim}: ProductCardProps) {
  return (
    <div className="doc-hub-card" style={dim ? {opacity: 0.72} : undefined}>
      <div
        className="doc-hub-card-icon"
        style={{background: `color-mix(in oklch, ${accentColor} 14%, var(--bg-3))`}}
      >
        {icon}
      </div>
      <div className="doc-hub-card-name">
        {name}
        {badge && (
          <span className={`doc-badge${badge.warn ? ' doc-badge--warn' : ''}`}>
            {badge.label}
          </span>
        )}
      </div>
      <p className="doc-hub-card-desc">{description}</p>
      <div className="doc-hub-card-links">
        {links.map(link => (
          <Link key={link.to} className="doc-hub-card-link" to={link.to}>
            {link.icon}
            {link.label}
            <ArrowRight />
          </Link>
        ))}
      </div>
    </div>
  );
}

const AR_COLOR = 'oklch(0.62 0.14 145)';
const DC_COLOR = 'oklch(0.66 0.17 258)';

export default function Home(): ReactElement {
  return (
    <Layout title="Documentation" description="Documentation for Arch Register and Diagram Craft">
      <div className="doc-hub">
        <div className="doc-hub-hero">
          <h1 className="doc-hub-title">Documentation</h1>
          <p className="doc-hub-sub">
            Everything you need to understand, use, build with, and extend Arch Register and Diagram Craft.
            Choose a product to get started.
          </p>
        </div>

        <div className="doc-hub-products">
          <ProductCard
            accentColor={AR_COLOR}
            icon={
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke={AR_COLOR} strokeWidth="1.5">
                <rect x="2" y="6" width="7.5" height="7.5" rx="1.5"/>
                <rect x="12.5" y="9" width="7.5" height="7.5" rx="1.5"/>
                <path d="M9.5 9.5l3 2" strokeLinecap="round"/>
              </svg>
            }
            name="Arch Register"
            badge={{label: 'v2.4'}}
            description="Map and document your system landscape. Register services, APIs, databases and teams — link them with typed relationships and visualise them in live diagrams."
            links={[
              {icon: <ClockIcon />, label: 'Quick Start', to: '/arch-register/getting-started/intro'},
              {icon: <EntityIcon />, label: 'Entities', to: '/arch-register/use/entities'},
              {icon: <InfoIcon />, label: 'Overview', to: '/arch-register/intro'},
            ]}
          />

          <ProductCard
            accentColor={DC_COLOR}
            icon={
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke={DC_COLOR} strokeWidth="1.5">
                <rect x="2" y="2" width="8" height="8" rx="1.5"/>
                <rect x="12" y="12" width="8" height="8" rx="1.5"/>
                <path d="M10 6h3M16 10v2.5" strokeLinecap="round"/>
              </svg>
            }
            name="Diagram Craft"
            badge={{label: 'Available'}}
            description="The collaborative diagram editor at the heart of Arch Register. Build architecture diagrams with smart connectors, live entity data, and team annotations."
            links={[
              {icon: <ClockIcon />, label: 'Quick Start', to: '/diagram-craft/diagram-craft/getting-started/introduction'},
              {icon: <EntityIcon />, label: 'Core Concepts', to: '/diagram-craft/diagram-craft/overview/core-concepts'},
              {icon: <InfoIcon />, label: 'Overview', to: '/diagram-craft/diagram-craft/intro'},
            ]}
          />
        </div>
      </div>
    </Layout>
  );
}

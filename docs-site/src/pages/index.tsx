import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import type {ReactElement} from 'react';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
      </div>
    </header>
  );
}

function ProductCard({
  title,
  description,
  link,
}: {
  title: string;
  description: string;
  link: string;
}) {
  return (
    <div className={clsx('col col--6', styles.productCard)}>
      <div className="card">
        <div className="card__header">
          <Heading as="h3">{title}</Heading>
        </div>
        <div className="card__body">
          <p>{description}</p>
        </div>
        <div className="card__footer">
          <Link
            className="button button--primary button--block"
            to={link}>
            View Documentation
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Home(): ReactElement {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title}`}
      description="Documentation for Diagram Craft and Arch Register">
      <HomepageHeader />
      <main>
        <section className={styles.products}>
          <div className="container">
            <div className="row">
              <ProductCard
                title="Diagram Craft"
                description="Interactive diagramming tool for creating professional diagrams with real-time collaboration, advanced features, and flexible export options."
                link="/diagram-craft/diagram-craft/intro"
              />
              <ProductCard
                title="Arch Register"
                description="Architecture management platform for documenting, visualizing, and managing software architecture with AI-powered insights and team collaboration."
                link="/diagram-craft/arch-register/intro"
              />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

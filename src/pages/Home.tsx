import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, FolderKanban, ShieldCheck, TrendingUp, Users, Wallet, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductLogo } from '@/components/brand/BrandMark';
import SignInCard from '@/components/auth/SignInCard';
import { PRODUCT_NAME } from '@/config/product';
import { TRIAL_DAYS } from '@/config/plans';

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: FolderKanban, title: 'Projects', text: 'Budgets, costs, tasks and timelines for every project.' },
  { icon: FileText, title: 'Tenders', text: 'Follow each tender from first look to award.' },
  { icon: TrendingUp, title: 'Sales pipeline', text: 'Deals, follow-ups, and one click to a tender or project.' },
  { icon: ShieldCheck, title: 'Compliance', text: 'Licences and registrations with their expiry dates.' },
  { icon: Wallet, title: 'Payments', text: 'Payments due and subscriptions, in one view.' },
  { icon: Users, title: 'Client access', text: 'Clients sign in and see only their own projects.' },
];

/** The home address for signed-out visitors: what the product does, and the sign-in form. */
const Home: React.FC = () => (
  <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-10 bottom-10 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
    </div>

    <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Link to="/" className="flex items-center gap-3">
          <ProductLogo className="h-9 w-9" />
          <span className="text-lg font-bold text-foreground">{PRODUCT_NAME}</span>
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link to="/signup">Start free trial</Link>
        </Button>
      </header>

      <main className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <section className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">For project and contracting companies</p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Projects, tenders and sales in one place
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {PRODUCT_NAME} keeps your projects, tenders, registrations, payments and sales pipeline together.
            Every company gets its own secure space, and your clients get a view of their own projects.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Button asChild size="lg" className="h-12 px-6 text-base font-semibold">
              <Link to="/signup">Start your {TRIAL_DAYS}-day free trial</Link>
            </Button>
            <span className="text-sm text-muted-foreground">No charge during the trial. Clients are always free.</span>
          </div>
        </section>

        <div className="w-full max-w-md justify-self-center lg:row-span-2 lg:justify-self-end">
          <SignInCard />
        </div>

        <section aria-label="Features" className="grid gap-4 sm:grid-cols-2 lg:col-start-1">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3 rounded-xl border bg-card/60 p-4 backdrop-blur">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {PRODUCT_NAME}
      </footer>
    </div>
  </div>
);

export default Home;

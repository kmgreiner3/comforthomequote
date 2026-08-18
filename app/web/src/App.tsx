import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import PriceHero from './components/PriceHero';
import Build from './routes/Build';

function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-3xl text-navy-950">{title}</h1>
      <p className="mt-2 text-ink">{note}</p>
    </main>
  );
}

function Home() {
  return <Placeholder title="Comfort Home Quote" note="A quote from the comfort of your home." />;
}

function Next() {
  return <Placeholder title="You're Ready" note="Let's get your project scheduled." />;
}

function About() {
  return <Placeholder title="About Comfort Home Quote" note="Your roof. Your research. Your decision." />;
}

function Metal() {
  return <Placeholder title="Roofing Options" note="Explore metal and tile roofing systems." />;
}

export default function App() {
  const location = useLocation();
  // /build renders its own PriceHero (it needs to hide on the review step,
  // where the price is already the centerpiece of the page and a floating
  // duplicate would overlap the primary CTA).
  const showPriceHero = location.pathname === '/next';

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/build" element={<Build />} />
          <Route path="/next" element={<Next />} />
          <Route path="/about" element={<About />} />
          <Route path="/metal" element={<Metal />} />
        </Routes>
      </div>
      <Footer />
      {showPriceHero && <PriceHero />}
    </div>
  );
}

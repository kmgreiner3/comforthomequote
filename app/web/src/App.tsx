import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import PriceHero from './components/PriceHero';

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

function Build() {
  return <Placeholder title="Build My Roof" note="Answer a few questions to see your price update live." />;
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
  const showPriceHero = location.pathname === '/build' || location.pathname === '/next';

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

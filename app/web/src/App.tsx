import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Landing from './routes/Landing';
import Build from './routes/Build';
import Next from './routes/Next';
import About from './routes/About';

function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-3xl text-navy-950">{title}</h1>
      <p className="mt-2 text-ink">{note}</p>
    </main>
  );
}

function Metal() {
  return <Placeholder title="Roofing Options" note="Explore metal and tile roofing systems." />;
}

export default function App() {
  // /build renders its own PriceHero (it needs to hide on the review step,
  // where the price is already the centerpiece of the page and a floating
  // duplicate would overlap the primary CTA). /next never shows it: the
  // post-acceptance flow isn't configuration, and the price appears in the
  // confirmation summary instead.
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/build" element={<Build />} />
          <Route path="/next" element={<Next />} />
          <Route path="/about" element={<About />} />
          <Route path="/metal" element={<Metal />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

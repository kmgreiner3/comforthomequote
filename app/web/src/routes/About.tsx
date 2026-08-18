import { Link } from 'react-router-dom';

export default function About() {
  return (
    <div>
      <section className="bg-navy-950 px-4 py-14 text-center text-white sm:px-6">
        <h1 className="font-display text-4xl font-semibold md:text-5xl">Comfort Home Quote</h1>
        <p className="mt-3 text-lg text-sky-50/80">Your home. Your roof. Your decision.</p>
      </section>

      <article className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <p className="font-display text-xl leading-relaxed text-navy-950 md:text-2xl">
          The way homeowners research and purchase major home improvements is changing. Today,
          people expect to research their options, understand pricing, compare products, and make
          informed decisions online. Comfort Home Quote brings that experience to the roofing
          industry.
        </p>

        <p className="mt-6 text-base leading-relaxed text-ink/80">
          After 10 years in roofing sales, I saw an opportunity to give homeowners a better way to
          make one of the biggest decisions they will make for their home.
        </p>

        <p className="mt-5 text-base leading-relaxed text-ink/80">
          Traditionally, much of the roofing process relies on a salesperson explaining the
          homeowner&apos;s options, recommending products and upgrades, presenting a price, and
          asking for a decision. But at the end of the day, a salesperson&apos;s job is to sell.
        </p>

        <p className="mt-5 text-base leading-relaxed text-ink/80">
          Comfort Home Quote puts the information directly in the homeowner&apos;s hands.
        </p>

        <p className="mt-5 text-base leading-relaxed text-ink/80">
          Our platform lets homeowners learn about their roof, understand the products and options
          available to them, and see how each decision affects their project and price in real
          time. From roofing materials and underlayment to ventilation, warranties, upgrades, and
          financing, homeowners can take the time to understand what they are buying, why it
          matters, and what it costs.
        </p>

        <p className="mt-5 text-base leading-relaxed text-ink/80">
          Instead of relying solely on what someone sitting across the table tells them, homeowners
          can do their own due diligence, explore their options, and build the roof that makes
          sense for their home and budget. And they can do it on their own time, at their own pace,
          from the comfort of their home.
        </p>

        <h2 className="mt-12 font-display text-2xl font-semibold text-navy-950">
          Your Information Stays Yours
        </h2>

        <p className="mt-5 text-base leading-relaxed text-ink/80">
          Many online &quot;roofing calculators&quot; are designed primarily to generate leads.
          Before homeowners can see meaningful information or pricing, they are often asked for
          their name, phone number, email address, and other personal information. That can result
          in follow-up calls and texts from multiple companies.
        </p>

        <p className="mt-5 text-base leading-relaxed text-ink/80">
          Comfort Home Quote takes a different approach. All we need to get started is the address
          of the property where the work will be performed. You can explore your roof, educate
          yourself on the available options, customize your project, and understand your pricing
          before deciding whether you are ready to move forward. When you are ready, you make the
          decision.
        </p>

        <p className="mt-5 text-base leading-relaxed text-ink/80">
          No salesperson deciding what is best for you. No pressure to make a decision before you
          have done your research. Just the information and tools you need to confidently choose
          what is right for your home.
        </p>

        <blockquote className="mt-12 border-l-4 border-blue-600 pl-6">
          <p className="font-display text-2xl font-semibold text-navy-950 md:text-3xl">
            Your roof. Your research. Your decision.
          </p>
        </blockquote>

        <div className="mt-12 border-t border-navy-950/10 pt-8 text-center">
          <Link
            to="/build"
            className="inline-flex min-h-[44px] items-center rounded-full bg-blue-600 px-8 py-3.5 text-base font-semibold text-white transition-colors duration-200 hover:bg-blue-500"
          >
            Build My Roof
          </Link>
        </div>
      </article>
    </div>
  );
}

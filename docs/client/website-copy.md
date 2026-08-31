# Client Website Copy (Dylan Nadeau, source of truth for on-page text)

**Rendering rules (Kyle, 2026-08-18):** keep Dylan's voice and facts, but NEVER use em dashes in rendered text (rewrite as two sentences or a comma), keep everything concise and scannable, and trim long paragraphs to their point. Efficient and user friendly beats wordy.

Tagline everywhere: **"A quote from the comfort of your home."** Secondary: "Your home. Your roof. Your decision." Logo tagline: "Your Roof. Your Comfort. Your Quote."

## About page

**Comfort Home Quote**

The way homeowners research and purchase major home improvements is changing. Today, people expect to be able to research their options, understand pricing, compare products, and make informed decisions online. Comfort Home Quote brings that experience to the roofing industry.

After 10 years in roofing sales, I saw an opportunity to give homeowners a better way to make one of the biggest decisions they'll make for their home.

Traditionally, much of the roofing process relies on a salesperson explaining the homeowner's options, recommending products and upgrades, presenting a price, and asking for a decision. But at the end of the day, a salesperson's job is to sell.

Comfort Home Quote puts the information directly in the homeowner's hands.

Our platform allows homeowners to learn about their roof, understand the products and options available to them, and see how each decision affects their project and price in real time. From roofing materials and underlayment to ventilation, warranties, upgrades, and financing options, homeowners can take the time to understand what they're buying, why it matters, and what it costs.

Instead of relying solely on what someone sitting across the table tells them, homeowners can do their own due diligence, explore their options, and build the roof that makes sense for their home and budget. And they can do it on their own time, at their own pace, from the comfort of their home.

**Your Information Stays Yours**

Many online "roofing calculators" are designed primarily to generate leads. Before homeowners can see meaningful information or pricing, they're often asked for their name, phone number, email address, and other personal information—which can result in follow-up calls and texts from multiple companies.

Comfort Home Quote takes a different approach. All we need to get started is the address of the property where the work will be performed. You can explore your roof, educate yourself on the available options, customize your project, and understand your pricing before deciding whether you're ready to move forward. When you are ready, you make the decision.

No salesperson deciding what's best for you. No pressure to make a decision before you've done your research. Just the information and tools you need to confidently choose what's right for your home.

**Your roof. Your research. Your decision.**

## Configurator copy (by step)

**Intro / Build Your Roof:** "We've measured your roof. Now it's time to explore your options and build a roofing system that makes sense for your home. As you make selections, your project price will update automatically. Take your time, compare your options, and learn what you're buying and why it matters."

**Home step (feedback round 8: absorbs the old Address step):** address entry (autocomplete) first, then satellite/manual measurement, then a short property-questions block once the outline is confirmed. First question: "Do you have solar panels on your roof?" — segmented No / Yes, with a 1-60 count stepper when Yes. Help text: "$200 per panel covers removal by a licensed solar contractor before the project and reinstall after." Continue is disabled until the outline is confirmed AND this question is answered.

**Shingle step:** "Your shingles are your home's primary layer of protection and one of the biggest factors in the appearance and performance of your new roof. We've simplified the decision into two options."

- **BETTER — IKO Cambridge.** "Dependable Performance. Excellent Value." Architectural asphalt shingle offering dependable protection, impact resistance, and a wide selection of colors. Highlights: Class 3 impact resistance classification · 110 MPH Limited Wind Warranty · Up to 130 MPH Limited High-Wind Warranty when installed according to applicable IKO requirements (six-nail application)* · Class A fire resistance · Limited Lifetime manufacturer warranty* · 10-year Iron Clad Protection period* · 5-Year Workmanship Guarantee.
- **BEST — TAMKO Titan XT.** "Enhanced Protection. Premium Performance." Premium architectural shingle for homeowners looking for enhanced wind performance, impact resistance, and a longer workmanship guarantee. Highlights: UL 2218 Class 3 impact resistance · 110 MPH standard Limited Wind Warranty · Up to 160 MPH, 15-year Limited Wind Warranty when installed according to applicable TAMKO high-wind requirements (TAMKO starter and hip and ridge)* · Limited Lifetime manufacturer warranty* · 10-year Full Start non-prorated warranty period* · 10-Year Workmanship Guarantee. Present as "Upgrade to Titan XT +$[DELTA] or approximately +$[MONTHLY DIFF]/month".

Feedback round 8: the workmanship guarantee (5 / 10 years above) is keyed on the shingle alone now — peel & stick is standard for everyone, so there is no more BETTER+/BEST+ underlayment-driven tier, and no separate underlayment or protection-level confirmation step. There is a manufacturer warranty line on each card too ("IKO Limited Lifetime manufacturer warranty*" / "TAMKO Limited Lifetime manufacturer warranty*").

**Appearance step (feedback round 8: merges the old Color and Finishing/drip-edge steps):** "Choose your color and finish." Desktop: swatch grid alongside a sticky description panel that's always visible. Mobile: the description expands directly beneath the tapped swatch. Drip edge (White/Black/Brown) follows below the colors, same 3 cards as before. Continue requires both a color and a drip edge.

**Included step (feedback round 8: 13 tiles now, underlayment and protection are gone as separate steps):** "Every roof includes all of this." The FIRST tile is now peel & stick underlayment itself — visually distinct (amber INCLUDED emphasis), title "Premium peel and stick underlayment," 1-2 sentences on what it is, plus an expandable "Why not synthetic?" explaining synthetic is mechanically fastened and a lesser barrier, and that we no longer offer it. Then the same 12 tiles as before, all marked INCLUDED:
1. **Roof Removal & Preparation** — existing system removed down to the decking; deck inspected and prepared.
2. **Decking Inspection & Replacement** — first 5 sheets of replacement decking free; $78 per additional sheet; hidden damage may not be known until removal begins.
3. **Ventilation Optimization** — ridge/off-ridge vents, soffit ventilation, balanced intake/exhaust; manages heat and moisture.
4. **New Pipe Boots** — new seal around roof penetrations, prevents future leaks.
5. **Gooseneck Vents** — replaced flashing/seals for fresh weather protection.
6. **New Drip Edge** — directs water away from decking and fascia; colors White/Black/Brown; gutters detached/reset where necessary.
7. **Starter Strip** — proper alignment and enhanced wind resistance at the perimeter.
8. **Flashing Inspection** — wall, chimney, counter, step flashing inspected, addressed or replaced where necessary.
9. **Property Protection** — tarps, netting, and other protection for landscaping, siding, windows, driveways, walkways.
10. **Permits & Inspections** — "We Handle It." Full county permitting and inspection process, photographic documentation, permit closure.
11. **Cleanup & Debris Removal** — dumpster provided; cleanup throughout; final magnet sweep; walkthrough with project manager.
12. **Complimentary Wind Mitigation Report** — after final inspection; documents features Florida insurance carriers may consider for wind-mitigation discounts.

**Review:** "Here's What You Built" — property, shingle, color, "Peel and stick underlayment: Included," drip edge, a solar removal/reinstall line when panels > 0 ("Solar panel removal and reinstall (N panels): +$X"), protection level, workmanship guarantee years, manufacturer warranty line, price + monthly. Pay-cash block (feedback round 8): "Pay cash: $X (5% discount)" then, on its own line, "Pay schedule: 50% on signing, 50% on completion." CTAs: [EDIT MY ROOF] / [I'M READY TO MOVE FORWARD] (strongest CTA on the page).

**Roofing partner:** "Meet Your Local Roofing Partner. At Comfort Home Quote, we believe the company installing your roof is just as important as the products you choose. That's why we strategically select one trusted roofing contractor in each county we serve. Our partners are selected based on experience, workmanship, reliability, reputation, applicable licensing and insurance requirements, and—most importantly—customer service. Our roofing partner has been in business for more than 20 years." Key message: **"Online Convenience. Real People."** "If you have a question or concern before, during, or after installation, our team is available to help."

**Homeowner info:** "We need this information to begin scheduling, permitting, and preparing your project for installation." Fields: full name, phone, email, property address (auto-filled), billing address, preferred contact method. Feedback round 8: a "Same as the address where work is being done" checkbox sits above the billing field — checked, billing mirrors the property address and the field is read-only; unchecking restores whatever was typed manually before checking.

**Pre-installation visit:** "Before installation, your project manager will visit the property to document existing conditions and take the necessary pre-installation photos. What date works best for our project manager to come out?" + Morning / Afternoon / No Preference. Feedback round 8: the visit window is tomorrow through 7 days from today, inclusive — today itself is not offered. Hint text: "Choose a date within the next 7 days."

**Confirmation:** "We've Got It From Here." Show roof system, project price, visit date/time, property. What happens next: project information reviewed → pre-installation visit → permit process begins → installation scheduled → homeowner receives updates. Closing: "You did the research. You built your roof. You made the decision. Now we'll take care of bringing it to life."

## Required footnote (any page showing warranty/wind/financing claims)

"*Manufacturer warranties, wind coverage, and product specifications are subject to the manufacturer's applicable written terms, installation requirements, qualifying components, limitations, and exclusions. Workmanship guarantees are separate from manufacturer warranties and subject to the applicable written workmanship guarantee. TAMKO Limited Lifetime warranty applies to single-family residences; see manufacturer terms." (feedback round 8: the TAMKO single-family sentence is new.) Financing estimates require appropriate lender disclosures ("approximately", subject to credit approval).

## Pending (Dylan's Aug 30 2026 Sunday email)

Additional property questions beyond solar panel count were listed for a future round — not yet scoped, priced, or implemented. See `docs/client/pricing-rules.md`'s own pending note.

## Partner page addendum (Dylan, Aug 20 2026)

Full "Online Convenience. Real People." passage (render em-dash-free, tightened): "You may have completed the entire Comfort Home Quote process online, but that doesn't mean you're on your own. Technology makes it possible to research your options, design your roof, understand your pricing, and make your decision from home. Customer service is what makes the experience complete. If you have a question, concern, or simply want to speak with someone about your project, we're here for you. Our team is available around the clock to help guide you through the process, from the moment you accept your quote through installation and beyond. The convenience of an online experience, backed by real people and a trusted local roofing company."

Plus at the bottom of the partner page: the contractor's Florida roofing license and certificate of liability insurance as viewable documents ("add these as attachments on the bottom").

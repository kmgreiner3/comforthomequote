# Client UX & Screen-Flow Spec (Dylan Nadeau) — condensed

Primary principle: the homeowner should feel like they're **building and learning about their roof**, not filling out a lead form or using a calculator. Simple → Visual → Educational → Transparent → Self-Directed. Never expose per-SQ pricing, tiers, or formulas.

Journey: ADDRESS → HOME → SHINGLE → COLOR → UNDERLAYMENT → PROTECTION LEVEL → WHAT'S INCLUDED → FINISHING DETAILS → REVIEW → I'M READY → PARTNER → CONTACT INFO → PRE-INSTALL VISIT → CONFIRMATION.

1. **Address** — "Let's Start With Your Home. Enter the address where you're considering replacing the roof." [BUILD MY ROOF]. NO name/phone/email.
2. **Your Home** — address, property imagery where available, "We've measured your roof. Let's build your roofing system." [START BUILDING MY ROOF].
3. **Shingle** — two large visual cards (BETTER left / BEST right). BEST emphasizes upgrade delta, not another big total. [SELECT]/[UPGRADE] + [LEARN MORE] opening modal/drawer with deep product detail. Keep selection screen simple.
4. **Color** — manufacturer swatches, selection highlight; "[VIEW ON MY HOME]" preview where possible (future).
5. **Underlayment** — side-by-side STANDARD (INCLUDED) vs PREMIUM (+$actual, +5 YEARS). Never "$50/SQ".
6. **Protection level** — positive confirmation moment: "YOUR ROOF IS BEST+ … = 15-Year Workmanship Guarantee". [CONTINUE].
7. **What's included** — visual tiles/expandable cards, NOT a wall of text: Roof Preparation, Decking, Ventilation, Pipe Boots, Gooseneck Vents, Drip Edge, Starter Strip, Flashing, Property Protection, Permits, Cleanup, Wind Mitigation. Each: icon + 1–2 sentences + INCLUDED indicator + Learn More where useful.
8. **Finishing details** — drip edge color: White / Black / Brown (more later).
9. **Review** — like reviewing a vehicle configuration: property, selected system, protection level, condensed included checklist, YOUR PRICE + monthly. [EDIT MY ROOF] / **[I'M READY TO MOVE FORWARD]** (strongest CTA).
10. **Partner** — transition from shopping to fulfillment. "Online Convenience. Real People." [CONTINUE MY PROJECT].
11. **Homeowner info** — ONLY NOW collect contact details; explain why.
12. **Schedule visit** — calendar of available dates + Morning/Afternoon/No Preference. [SCHEDULE MY VISIT].
13. **Confirmation** — "We've Got It From Here." + next steps + closing message.

**Global price component:** from when pricing exists, keep project price visible — desktop persistent upper-right card; mobile sticky bottom bar ("YOUR ROOF / $12,000 / $XXX per month / [VIEW DETAILS]"). Animate price changes without page refresh.

**Mobile-first requirements:** sticky price bar, large tap targets, swipeable product cards, large swatches, minimal typing, address autocomplete, simple back navigation, saved configuration, fast transitions. Full flow completable comfortably from a phone.

**Experience rule at every decision:** What is this? (educate) · Why would I want it? (benefit) · What does it cost me? (exact dollar impact). Never make the homeowner calculate anything.

**Price update behavior:** every paid selection triggers immediate recalculation; frontend receives new total, dollar change, new monthly, guarantee level if affected. Persistent live configuration object (address, exact SQ, shingle, color, underlayment, drip edge, guarantee, base price, upgrades, total, monthly); survives back-navigation.

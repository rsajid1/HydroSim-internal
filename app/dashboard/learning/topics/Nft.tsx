import React from 'react';
import { InShort, Section, DataTable, Sources } from '../components';

export default function Nft() {
  return (
    <div className="space-y-4">
      <InShort>
        A pump keeps a thin stream of nutrient solution running down sloped channels. Roots sit partly in the
        film and partly in air. It suits fast, shallow-rooted crops such as lettuce, and it stops working the
        moment the pump does.
      </InShort>

      <Section title="How it works">
        <p>
          NFT circulates a shallow stream of solution past the roots continuously. The stream is deliberately
          thin, so only the bottom of the root mat is wetted and the rest stays in air, giving the plant
          nutrients and oxygen at the same time. The method was first described by Dr. Allen Cooper at the
          Glasshouse Crops Research Institute in Littlehampton, England, in the 1960s.
        </p>
        <DataTable
          columns={[{ header: 'Element', key: 'element' }, { header: 'Detail', key: 'detail' }]}
          rows={[
            { element: 'Closed loop', detail: 'A pump lifts solution from a reservoir, it flows down the channels by gravity, and surplus is collected, replenished and reused rather than discarded.' },
            { element: 'Channels', detail: 'Enclosed channels hold the plants. In the simplest builds this is a polyethylene tube with slits cut for the roots. Commercial channels are rigid extrusions with removable lids for cleaning.' },
            { element: 'Distribution', detail: 'Solution reaches each channel through a manifold and flexible tubing joined by emitters. Shut-off valves let a grower tune flow rate per channel.' },
            { element: 'Tubing colour', detail: 'White poly pipe reflects heat and keeps solution cooler. Black pipe does the opposite, which matters in warm climates.' },
          ]}
        />
      </Section>

      <Section title="Best suited to">
        <p>
          Fast-growing, shallow-rooted crops. Lettuce, basil, cilantro, mint, parsley, spinach, arugula, kale,
          Swiss chard and mustard greens all do well, and some strawberry cultivars are grown this way in
          vertical or horizontal channels.
        </p>
        <p>
          The system is efficient with both water and floor space, and its lightweight modular layout scales
          up or down without a redesign. Optimizing water and nutrient use is the goal the technique was
          designed around.
        </p>
      </Section>

      <Section title="Watch out for">
        <ul className="list-disc list-inside space-y-1">
          <li><span className="text-slate-200">Pump dependency.</span> The film only exists while the pump runs. NFT holds no water reserve at the roots, so a pump or power failure starts stressing plants quickly rather than over hours.</li>
          <li><span className="text-slate-200">Clogs.</span> Channels, emitters and delivery lines need regular checks to confirm the film is still flowing and has not been blocked by root mass or debris.</li>
          <li><span className="text-slate-200">Nutrient drift.</span> The same solution recirculates, so concentration and balance shift as plants draw it down. This is ongoing maintenance, not a one-time setup concern.</li>
          <li><span className="text-slate-200">Heavy crops.</span> Large, top-heavy or deep-rooted plants are a mismatch for shallow channels sized around leafy greens — see the Tomato module for what tomato needs instead.</li>
        </ul>
      </Section>

      <Sources
        items={[
          { label: 'Virginia Cooperative Extension (SPES-463): Hydroponic Production of Edible Crops, Nutrient Film Technique (NFT) Systems', url: 'https://www.pubs.ext.vt.edu/SPES/spes-463/spes-463.html' },
          { label: 'Oregon State University Extension (EM 9457): Hydro hints, Nutrient film technique', url: 'https://extension.oregonstate.edu/catalog/pub/em-9457-hydro-hints-nutrient-film-technique' },
          { label: 'Oklahoma State University Extension: Hydroponics (fact sheet)', url: 'https://extension.okstate.edu/fact-sheets/hydroponics' },
          { label: 'Palmitessa, Signore & Santamaria (2024), Frontiers in Plant Science: Advancements and future perspectives in nutrient film technique hydroponic system', url: 'https://doi.org/10.3389/fpls.2024.1504792' },
        ]}
      />
    </div>
  );
}

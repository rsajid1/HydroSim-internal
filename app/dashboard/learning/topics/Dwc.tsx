import React from 'react';
import { InShort, Section, DataTable, Sources } from '../components';

export default function Dwc() {
  return (
    <div className="space-y-4">
      <InShort>
        Roots hang into a shallow pond of nutrient solution held up by a floating raft. There is no pump
        moving solution past the roots, so keeping the water oxygenated is the main job.
      </InShort>

      <Section title="How it works">
        <p>
          DWC, also called a floating or raft system, suspends roots directly in aerated solution. Plants sit
          in net pots or soilless-media cells set into a raft that floats on the surface. In the 1980s, Dr.
          Merle Jensen at the University of Arizona&apos;s Environmental Research Lab developed a relatively deep
          raceway design, roughly 6 to 8 inches, that commercial growers and hobbyists went on to adopt for
          leafy greens.
        </p>
        <DataTable
          columns={[{ header: 'Element', key: 'element' }, { header: 'Detail', key: 'detail' }]}
          rows={[
            { element: 'The pond', detail: 'The production area is essentially a shallow pond of solution. There is no circulating film and no irrigation cycle to time.' },
            { element: 'Aeration', detail: 'Water movement and air exchange are minimal, so DWC depends on active aeration, usually air pumps driving air stones, or ozone injection at larger scale.' },
            { element: 'Oxygen target', detail: 'Above 6 ppm dissolved oxygen is optimal. Below that, growth can be inhibited and ethylene production increases.' },
            { element: 'Temperature limit', detail: 'Warmer water holds less oxygen. At 35°C (95°F) and 5 dS/m, solubility tops out near 6.85 ppm no matter how hard you aerate.' },
          ]}
        />
        <p>Because of that last point, a chiller rather than a bigger air pump is the fix for a hot reservoir.</p>
      </Section>

      <Section title="Monitoring and layout">
        <ul className="list-disc list-inside space-y-1">
          <li><span className="text-slate-200">Meters.</span> DWC needs meters for electrical conductivity, pH and dissolved oxygen. EC and pH should be checked two to three times a week. Growers running submerged-root systems specifically need to watch dissolved oxygen and water temperature.</li>
          <li><span className="text-slate-200">Level.</span> Keep the reservoir bottom level to within about an inch so solution depth is even and growth does not vary across the bed.</li>
          <li><span className="text-slate-200">Drainage.</span> A bulkhead fitting and valve at the bottom makes draining practical instead of a chore.</li>
        </ul>
      </Section>

      <Section title="Watch out for">
        <p>
          The open tank creates the main trade-offs. Light on an open surface encourages algae, and an exposed
          pond loses more water to evaporation than an enclosed system. Once salinity climbs too high, the
          whole nutrient bath has to be dumped and refreshed rather than topped up. At harvest, avoid letting
          solution drip from pulled roots onto neighbouring plants.
        </p>
        <p>
          The upside is speed and simplicity. DWC accelerates growth, suits leafy greens and herbs, and has no
          distribution plumbing to clog.
        </p>
      </Section>

      <Sources
        items={[
          { label: 'Virginia Cooperative Extension (SPES-464): Hydroponic Production of Edible Crops, Deep Water Culture (DWC) Systems', url: 'https://www.pubs.ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-464/spes-464.html' },
          { label: 'Oregon State University Extension (EM 9455): Hydro hints, Deep water culture', url: 'https://extension.oregonstate.edu/catalog/pub/em-9455-hydro-hints-deep-water-culture' },
          { label: 'University of Missouri Extension (G6984): Hydroponic Nutrient Solutions', url: 'https://extension.missouri.edu/publications/g6984' },
          { label: 'University of Kentucky Center for Crop Diversification (CCD-SP-20): Irrigation in Hydroponic Systems', url: 'https://ccd.uky.edu/sites/default/files/2024-12/ccd-sp-20-irrigation-in-hydroponic-systems.pdf' },
        ]}
      />
    </div>
  );
}

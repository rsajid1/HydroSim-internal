import React from 'react';
import { InShort, Section, DataTable, Sources } from '../components';

export default function Lettuce() {
  return (
    <div className="space-y-4">
      <InShort>
        A fast leafy crop that suits both NFT and DWC. It is harvested during heading, before it flowers, so it
        has no fruiting phase. Solution targets are pH 5.5 to 6.0 and 1.0 to 2.0 mS/cm.
      </InShort>

      <Section title="Growing system">
        <p>
          Lettuce is the standard crop for both systems covered in this app. It is named first among the crops
          suited to NFT, and DWC is widely used for leafy greens.
        </p>
      </Section>

      <Section title="Environment targets">
        <p>
          Hydroponic lettuce grows best around 150 to 200 ppm nitrogen, or roughly 1.0 to 2.0 mS/cm, with
          solution pH between 5.5 and 6.0. Transplants raised in soilless substrate tolerate a wider pH band of
          5.5 to 6.5.
        </p>
      </Section>

      <Section title="Growth stages">
        <p>
          The clearest published stage sequence for lettuce comes from field production. The University of
          Arizona describes six distinct stages: seed, cotyledon, seedling, rosette, cupping and heading.
        </p>
        <DataTable
          columns={[
            { header: 'Stage', key: 'stage' },
            { header: 'Begins when', key: 'begins' },
            { header: 'Fall planting', key: 'fall' },
            { header: 'Winter planting', key: 'winter' },
          ]}
          rows={[
            { stage: 'Seed', begins: 'Pre-planting to emergence. Germination starts once the seed meets water at a suitable temperature', fall: 'as little as 12 hours', winter: 'up to 7 days' },
            { stage: 'Cotyledon', begins: 'Plant sheds the seed coat and emerges. Lasts until roots are better established', fall: 'n/a', winter: 'n/a' },
            { stage: 'Seedling', begins: 'First true leaf emerges, once the root has grown a couple of inches', fall: 'about 7 days from emergence', winter: 'about 20 days' },
            { stage: 'Rosette', begins: 'A distinct circular cluster of leaves has formed', fall: 'about 25 days', winter: 'up to 50 days' },
            { stage: 'Cupping', begins: 'Inner leaf tips curl inward at the edges, signalling that head formation is near', fall: 'about 7 days', winter: 'about 14 days' },
            { stage: 'Heading', begins: 'Cupped leaves overlap and cover the growing point. Runs to harvest', fall: 'about 30 days', winter: 'about 45 days' },
          ]}
        />
        <p>
          All figures come from the University of Arizona source. Fall-planted lettuce may need as little as 65
          days from the start of germination to harvest, while winter-planted lettuce can take as long as 120
          days. The difference is driven by temperature.
        </p>
        <p>
          Two caveats: these figures are from field production in the Arizona low desert, where soil,
          irrigation and open-sky conditions differ from a greenhouse — the stage names and their sequence
          transfer, but the durations are a comparison point, not a target. Second, lettuce never reaches a
          flowering or fruiting stage in production, because it is cut during heading.
        </p>
      </Section>

      <Section title="Watch out for">
        <p>
          Pythium root rot presents on lettuce as root tip necrosis rather than the whole root system rotting.
          Low fertility shows as lower-leaf chlorosis on green cultivars and dark purpling on red ones — see
          the Reading Plant Health module for both in context.
        </p>
      </Section>

      <Sources
        items={[
          { label: 'University of Arizona, Arizona Pest Management Center (ACIS): Lettuce, Crop Management. Kerns, Matheron, Palumbo, Sanchez, Still, Tickes, Umeda & Wilcox', url: 'https://acis.cals.arizona.edu/agricultural-ipm/vegetables/lettuce/crop-management' },
          { label: 'Oregon State University Extension (EM 9457): Hydro hints, Nutrient film technique', url: 'https://extension.oregonstate.edu/catalog/pub/em-9457-hydro-hints-nutrient-film-technique' },
          { label: 'Oregon State University Extension (EM 9455): Hydro hints, Deep water culture', url: 'https://extension.oregonstate.edu/catalog/pub/em-9455-hydro-hints-deep-water-culture' },
          { label: 'e-GRO Nutritional Monitoring Series (2018): Lettuce (Lactuca sativa)', url: 'https://hortamericas.com/wp-content/uploads/2018/04/e-gro-Nutritional-Factsheet-Lettuce.pdf' },
          { label: 'Plant Health Progress (APS), 2024: Diagnostic Guide for Pythium Root Rot in Hydroponic Leafy Green and Herb Production', url: 'https://doi.org/10.1094/PHP-07-24-0070-DG' },
        ]}
      />
    </div>
  );
}

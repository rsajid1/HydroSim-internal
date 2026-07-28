import React from 'react';
import { InShort, Section, Sources } from '../components';

export default function NutrientSolution() {
  return (
    <div className="space-y-4">
      <InShort>
        These three readings decide whether a plant can use what you feed it. pH controls availability, EC
        reports total salt concentration, and dissolved oxygen is capped by water temperature.
      </InShort>

      <Section title="Overview">
        <p>
          A nutrient solution is water plus fertilizers, which makes the water itself an ingredient. Testing
          your source water is the only way to know whether it is suitable at all.
        </p>
      </Section>

      <Section title="pH: availability, not quantity">
        <p>
          A well-mixed solution containing every element can still starve a plant if pH sits outside the
          workable range, because pH determines whether nutrients can be taken up.
        </p>
        <p>
          Crop targets are narrower than general guidance suggests. Hydroponic lettuce solution is held between
          pH 5.5 and 6.0, while lettuce transplants raised in soilless substrate tolerate a wider 5.5 to 6.5
          band. Tomato guidance is 5.5 to 6.5, or 5.5 to 6.0 depending on the source (see the Tomato module).
        </p>
      </Section>

      <Section title="EC: total salts, not balance">
        <p>
          EC reports the overall concentration of fertilizer salts, not which nutrients are present or in what
          ratio. Two solutions can share an EC reading and behave completely differently.
        </p>
        <p>
          Lettuce grows best at roughly 150 to 200 ppm nitrogen, which corresponds to about 1.0 to 2.0 mS/cm.
          In deep water culture, EC and pH should be checked two to three times each week. Tracking EC over
          time is how a grower notices that total fertilizer in solution has shifted.
        </p>
      </Section>

      <Section title="Dissolved oxygen and temperature">
        <p>
          Above 6 ppm dissolved oxygen is optimal. Below it, growth may be inhibited and ethylene production
          rises. Water temperature caps how much oxygen the solution can hold, and warmer water holds less. At
          35°C (95°F) with 5 dS/m EC, solubility is about 6.85 ppm, and additional aeration cannot push past
          that.
        </p>
        <p>
          Chilling the solution raises that ceiling. Oxygen availability is a concrete example of how solution
          temperature ends up governing plant health and nutrient uptake.
        </p>
      </Section>

      <Section title="Watch out for">
        <p>
          Lighting, airflow, dissolved oxygen, humidity and air temperature can all push a crop outside its
          comfort zone even when solution chemistry checks out. When symptoms appear, check foliage and roots
          before adjusting fertilizer — the cause is frequently a root or water-management problem rather than
          the feed.
        </p>
      </Section>

      <Sources
        items={[
          { label: 'University of Missouri Extension (G6984): Hydroponic Nutrient Solutions', url: 'https://extension.missouri.edu/publications/g6984' },
          { label: 'Oklahoma State University Extension: Electrical Conductivity and pH Guide for Hydroponics', url: 'https://extension.okstate.edu/fact-sheets/electrical-conductivity-and-ph-guide-for-hydroponics' },
          { label: 'e-GRO Nutritional Monitoring Series (2018): Lettuce (Lactuca sativa)', url: 'https://hortamericas.com/wp-content/uploads/2018/04/e-gro-Nutritional-Factsheet-Lettuce.pdf' },
          { label: 'Virginia Cooperative Extension (SPES-464): Hydroponic Production of Edible Crops, Deep Water Culture (DWC) Systems', url: 'https://www.pubs.ext.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-464/spes-464.html' },
          { label: 'University of New Hampshire Extension: Scouting & Managing Greenhouse Nutrient Problems (fact sheet)', url: 'https://extension.unh.edu/resource/scouting-managing-greenhouse-nutrient-problems-fact-sheet' },
        ]}
      />
    </div>
  );
}

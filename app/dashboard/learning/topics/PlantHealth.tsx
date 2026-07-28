import React from 'react';
import { InShort, Section, DataTable, Sources } from '../components';

export default function PlantHealth() {
  return (
    <div className="space-y-4">
      <InShort>
        Check crops weekly rather than waiting for symptoms to force a rescue. Look at foliage colour and
        vigour, look at the roots, and test pH and EC. Visual symptoms overlap, so they are a prompt to
        measure rather than a diagnosis.
      </InShort>

      <Section title="Overview">
        <p>pH governs which nutrients are available, and EC reports the overall concentration of fertilizer salts.</p>
      </Section>

      <Section title="Healthy signs">
        <ul className="list-disc list-inside space-y-1">
          <li>Even, saturated leaf colour. Uniform green across the canopy, no pale cast on older leaves, no scorched margins.</li>
          <li>Steady size gain between checks. Growth rate is an early signal — in lettuce trials, reduced growth from nitrogen deficiency was visible within the first two weeks, before the yellowing was obvious.</li>
          <li>Turgid foliage. Plants that wilt while solution is plentiful are signalling a root-zone or salinity problem, not thirst.</li>
          <li>Intact roots. Foliar symptoms often trace back to the roots. A root system compromised by Pythium or waterlogging produces leaf symptoms that look nutritional but will not respond to a fertilizer change.</li>
        </ul>
      </Section>

      <Section title="Warning signs">
        <DataTable
          columns={[{ header: 'Sign', key: 'sign' }, { header: 'Usual meaning', key: 'meaning' }]}
          rows={[
            { sign: 'Pale green foliage, overall stunting', meaning: 'Typical first presentation of nitrogen deficiency, which can progress to wilting and dead or yellow leaf margins. In lettuce it advances to uniform chlorosis of the older leaves.' },
            { sign: 'Wilting despite adequate solution, dark green leaves, burned margins', meaning: 'Excess soluble salts, a chemically induced drought that can progress to root death.' },
            { sign: 'Lower-leaf chlorosis, or purpling on red cultivars', meaning: 'In lettuce, associated with low fertility (low EC) rather than disease.' },
            { sign: 'Calcium disorders', meaning: 'Often not a fertilizer shortfall. Under-fertilization, nutrient imbalance and low pH contribute, and so do high temperature, low humidity and poor airflow, because calcium moves with the transpiration stream and leaves out-compete fruit for it.' },
            { sign: 'Root necrosis', meaning: 'Symptoms differ by crop. Spinach shows severe rot through the whole root system, while Pythium on lettuce presents as root tip necrosis.' },
          ]}
        />
        <p>
          Calcium disorders have a specific and well-documented expression in tomato — blossom end rot. The
          Tomato module covers it, since both the mechanism and the management are tomato specific.
        </p>
      </Section>

      <Section title="How to diagnose">
        <p>
          Nutrient solution temperature, EC, dissolved oxygen and pH all shape how root disease presents and
          progresses, so an environmental reading is part of the diagnosis rather than background context.
        </p>
        <p>
          For reference points on a common crop: hydroponic lettuce grows best around 150 to 200 ppm nitrogen,
          roughly 1.0 to 2.0 mS/cm, with solution pH held between 5.5 and 6.0.
        </p>
      </Section>

      <Sources
        items={[
          { label: 'University of New Hampshire Extension: Scouting & Managing Greenhouse Nutrient Problems (fact sheet)', url: 'https://extension.unh.edu/resource/scouting-managing-greenhouse-nutrient-problems-fact-sheet' },
          { label: 'Penn State Extension: Hydroponics Systems and Principles of Plant Nutrition, Essential Nutrients, Function, Deficiency, and Excess', url: 'https://extension.psu.edu/hydroponics-systems-and-principles-of-plant-nutrition-essential-nutrients-function-deficiency-and-excess' },
          { label: 'Mattson, e-GRO Research Update (2015): Symptoms of Common Nutrient Deficiencies in Hydroponic Lettuce', url: 'https://www.e-gro.org/pdf/Mattson_Lettuce_2015_9.pdf' },
          { label: 'e-GRO Nutritional Monitoring Series (2018): Lettuce (Lactuca sativa)', url: 'https://hortamericas.com/wp-content/uploads/2018/04/e-gro-Nutritional-Factsheet-Lettuce.pdf' },
          { label: 'Plant Health Progress (APS), 2024: Diagnostic Guide for Pythium Root Rot in Hydroponic Leafy Green and Herb Production', url: 'https://doi.org/10.1094/PHP-07-24-0070-DG' },
        ]}
      />
    </div>
  );
}

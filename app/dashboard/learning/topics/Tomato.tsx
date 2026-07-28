import React from 'react';
import { InShort, Section, DataTable, Sources } from '../components';

export default function Tomato() {
  return (
    <div className="space-y-4">
      <InShort>
        A long-season fruiting crop that behaves very differently from lettuce. It runs for months, needs
        pollinating, and is normally grown in substrate rather than in NFT or DWC. Solution targets are pH 5.5
        to 6.5 and 2.0 to 2.5 mS/cm.
      </InShort>

      <Section title="Overview">
        <p>
          Tomato is the most widely produced greenhouse crop in the world, with a large share of fresh-market
          supply coming from Canada and Mexico. Greenhouse growers use indeterminate varieties, which keep
          growing after setting fruit, and train them vertically on a trellis. Field operations use determinate
          varieties, which stop growing once fruiting has occurred.
        </p>
      </Section>

      <Section title="Growing system">
        <p>
          This is where tomato diverges from lettuce. Substrate-based systems are normally used, because large
          vining plants need more root support than traditional hydroponic systems can provide.
        </p>
        <DataTable
          columns={[{ header: 'Substrate', key: 'substrate' }, { header: 'Used in', key: 'used' }]}
          rows={[
            { substrate: 'Perlite', used: 'Bag culture, Dutch buckets (11-litre buckets with a drainage hole)' },
            { substrate: 'Pine bark', used: 'Container systems, 3 or 5 gallon nursery pots' },
            { substrate: 'Rockwool', used: 'Highwire systems in advanced greenhouses, with trellis wires at least 12 feet up rather than the usual 6 to 8' },
          ]}
        />
        <p>
          Purdue&apos;s controlled environment programme likewise describes the Dutch bucket system for greenhouse
          tomato. HydroSim offers NFT and DWC only — a tomato grown in either setting inside the simulator is a
          simplification, not a description of standard commercial practice.
        </p>
      </Section>

      <Section title="Environment targets">
        <DataTable
          columns={[{ header: 'Variable', key: 'variable' }, { header: 'Published guidance', key: 'guidance' }]}
          rows={[
            { variable: 'Daytime temperature', guidance: '27 to 29°C (80 to 85°F) for significant growth and yield. Purdue gives a working band above 18°C (65°F) and below 29°C (85°F)' },
            { variable: 'Night temperature', guidance: '16 to 18°C (60 to 65°F), but no lower' },
            { variable: 'EC', guidance: '2.0 to 2.5 mS/cm. Purdue gives roughly the same, noting higher EC improves flavour' },
            { variable: 'pH', guidance: '5.5 to 6.5. Purdue gives 5.5 to 6.0' },
            { variable: 'CO2', guidance: 'Enrichment up to 600 ppm' },
            { variable: 'Light', guidance: 'Above 20 mol/m2/day' },
            { variable: 'Humidity', guidance: '60 to 70 percent is where pollination works best' },
          ]}
        />
        <p>
          Cold damage shows as leaves turning purple and curling inward. Excessive heat affects fruit
          development, causing cracked fruit and reduced fruit set.
        </p>
      </Section>

      <Section title="Growth stages and crop cycle">
        <p>
          Transplants are usually produced in 4 to 6 weeks and moved on at 4 to 6 inches tall. Purdue puts
          flowering at 6 to 8 weeks after planting, with harvest running 2 to 4 times each week for 15 to 20
          weeks. Alabama Extension describes harvesting 1 to 3 times a week depending on season.
        </p>
        <p>
          Two scheduling patterns are common: a single 10-month crop started in August and finished the
          following June, or the two-crop method developed by Mississippi State University, which also starts
          in August, ends the first crop in December, and immediately transplants a second for spring.
        </p>
        <p>
          For stage terminology, the BBCH scale codes development into ten principal stages numbered 0 to 9:
          germination, leaf development, formation of side shoots, stem elongation, inflorescence emergence,
          flowering, fruit development, ripening and senescence. It&apos;s the standard vocabulary if stage names
          need to be recognisable to a horticulturist.
        </p>
      </Section>

      <Section title="Pollination">
        <p>
          Tomato flowers are perfect, meaning they carry male and female parts and can self-pollinate, but
          cross-pollination gives better fruit set and yield. Elevated temperature and high humidity both
          reduce pollination, so the recommended window is the middle of the day before it gets too hot, with
          humidity between 60 and 70 percent.
        </p>
        <p>
          Growers use bumblebees, mechanical pollinators, or electric pollinators that vibrate the flower
          truss. Hives stay active 6 to 8 weeks. Pollination is done three times a week as new flowers develop.
        </p>
      </Section>

      <Section title="Watch out for: blossom end rot">
        <p>
          The characteristic tomato disorder, and the one most closely tied to the variables this app tracks.
          It is physiological rather than infectious, and is not caused by fungi or bacteria. It appears as a
          light tan, water-soaked blemish at the blossom end that enlarges into a dark, sunken, leathery lesion,
          and it can also occur on the side of the fruit or internally with nothing visible outside.
        </p>
        <p>
          The cause is a localised calcium deficiency in the developing fruit rather than a shortage of calcium
          in the solution. Contributing factors include low available calcium, excess nitrogen, ammoniacal
          nitrogen, high soluble potassium and magnesium, high salinity, and both inadequate and excess
          moisture. Root damage from disease or heavy pruning raises the risk. In greenhouse systems, not
          cycling irrigation at night increases blossom end rot, because night is an important period for
          calcium uptake. Oregon State adds that calcium and water demand rise as temperature and growth rate
          rise, so heat spells favour the disorder.
        </p>
        <p>
          Sources disagree on humidity. New Hampshire Extension reports that many studies find increasing
          humidity reduces blossom end rot; University of Florida guidance lists low humidity among the causes.
          The mechanism in both cases is competition between leaves and fruit for calcium moving in the
          transpiration stream, but the practical direction is contested — treat any humidity coefficient here
          as unsettled.
        </p>
        <p>
          Foliar calcium sprays are not effective, because very little calcium is taken up by the fruit and
          calcium absorbed by leaves cannot be moved to it. Commercial operations inject two separate stock
          solutions, a general fertilizer and a calcium nitrate solution, kept apart so calcium phosphate does
          not precipitate.
        </p>
      </Section>

      <Section title="Nutrient solution concentration ranges">
        <p>From Alabama Extension, adapted from Mills and Jones (1996) and Hochmuth and Hochmuth (2018).</p>
        <DataTable
          columns={[{ header: 'Nutrient', key: 'nutrient' }, { header: 'ppm', key: 'ppm' }]}
          rows={[
            { nutrient: 'Nitrogen', ppm: '70 to 150' },
            { nutrient: 'Phosphorus', ppm: '50' },
            { nutrient: 'Potassium', ppm: '120 to 200' },
            { nutrient: 'Calcium', ppm: '150' },
            { nutrient: 'Magnesium', ppm: '40 to 50' },
            { nutrient: 'Sulfur', ppm: '50 to 60' },
            { nutrient: 'Iron', ppm: '2.8' },
            { nutrient: 'Manganese', ppm: '0.8' },
            { nutrient: 'Boron', ppm: '0.7' },
            { nutrient: 'Copper', ppm: '0.2' },
            { nutrient: 'Zinc', ppm: '0.3' },
            { nutrient: 'Molybdenum', ppm: '0.05' },
          ]}
        />
      </Section>

      <Sources
        items={[
          { label: 'Alabama Cooperative Extension System (ANR-2955): Greenhouse Tomato Production. Blanchard, Pickens, da Silva & Wells, reviewed February 2025', url: 'https://www.aces.edu/blog/topics/crop-production/greenhouse-tomato-production/' },
          { label: 'Purdue University, Controlled Environment Agriculture: Greenhouse Tomato Production', url: 'https://www.purdue.edu/hla/sites/cea/wp-content/uploads/sites/15/2024/05/Greenhouse-Tomato-Production.pdf' },
          { label: 'Meier (ed.), BBCH Monograph: Growth Stages of Mono- and Dicotyledonous Plants', url: 'https://www.openagrar.de/servlets/MCRFileNodeServlet/openagrar_derivate_00010428/BBCH-Skala_en.pdf' },
          { label: 'University of New Hampshire Extension: Growing Vegetables, Managing Blossom End-Rot (fact sheet)', url: 'https://extension.unh.edu/resource/growing-vegetables-managing-blossom-end-rot-fact-sheet-0' },
          { label: 'Oregon State University Extension (FS 139): Blossom-End Rot of Tomatoes', url: 'https://extension.oregonstate.edu/catalog/fs-139-blossom-end-rot-tomatoes' },
          { label: 'University of Florida IFAS, u-scout: Blossom End Rot (tomato)', url: 'https://plantpath.ifas.ufl.edu/u-scout/tomato/blossom-end-rot.html' },
          { label: 'HortScience 47(12), 2012: Changes in Selected Quality Attributes of Greenhouse Tomato Fruit as Affected by Pre- and Postharvest Environmental Conditions in Year-round Production', url: 'https://journals.ashs.org/view/journals/hortsci/47/12/article-p1698.xml' },
        ]}
      />
    </div>
  );
}

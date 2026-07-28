'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, BookOpen } from 'lucide-react';
import { DataTable } from './components';
import Nft from './topics/Nft';
import Dwc from './topics/Dwc';
import NutrientSolution from './topics/NutrientSolution';
import PlantHealth from './topics/PlantHealth';
import Lettuce from './topics/Lettuce';
import Tomato from './topics/Tomato';

interface Topic {
  id: string;
  title: string;
  summary: string;
  Content: React.ComponentType;
}

const TOPICS: Topic[] = [
  { id: 'nft', title: '1. Nutrient Film Technique (NFT)', summary: 'A continuously pumped, thin recirculating film past the roots.', Content: Nft },
  { id: 'dwc', title: '2. Deep Water Culture (DWC)', summary: 'Roots suspended in an aerated pond, no pump required.', Content: Dwc },
  { id: 'nutrient-solution', title: '3. Nutrient Solution: pH, EC and Dissolved Oxygen', summary: 'What the three core readings actually measure and why they matter.', Content: NutrientSolution },
  { id: 'plant-health', title: '4. Reading Plant Health', summary: 'What healthy growth looks like, and how to diagnose common warning signs.', Content: PlantHealth },
  { id: 'lettuce', title: '5. Lettuce', summary: 'Growth stages, environment targets, and what to watch for.', Content: Lettuce },
  { id: 'tomato', title: '6. Tomato', summary: 'A long-season fruiting crop — growing system, pollination, and blossom end rot.', Content: Tomato },
];

export default function LearningModulesPage() {
  const [openTopic, setOpenTopic] = useState<string | null>('nft');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30">
            <BookOpen size={20} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Learning Modules</h1>
            <p className="text-sm text-slate-400 mt-1">
              Background reading on the growing systems, measurements and crops that HydroSim simulates.
              Every factual claim below is cited — each module carries its own Sources list, drawn from
              university cooperative extension publications, e-GRO grower factsheets, and peer-reviewed
              papers.
            </p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Quick reference</h2>
          <DataTable
            columns={[
              { header: 'Measurement', key: 'measurement' },
              { header: 'Lettuce', key: 'lettuce' },
              { header: 'Tomato', key: 'tomato' },
            ]}
            rows={[
              { measurement: 'Solution pH', lettuce: '5.5 to 6.0', tomato: '5.5 to 6.5, or 5.5 to 6.0' },
              { measurement: 'EC', lettuce: '1.0 to 2.0 mS/cm', tomato: '2.0 to 2.5 mS/cm' },
              { measurement: 'Nitrogen in solution', lettuce: '150 to 200 ppm', tomato: '70 to 150 ppm' },
              { measurement: 'Dissolved oxygen', lettuce: 'above 6 ppm', tomato: 'above 6 ppm' },
              { measurement: 'Usual growing system', lettuce: 'NFT or DWC', tomato: 'Substrate: perlite, pine bark or rockwool' },
              { measurement: 'Signature disorder', lettuce: 'Pythium root tip necrosis', tomato: 'Blossom end rot' },
            ]}
          />
          <p className="text-xs text-slate-500 mt-2">
            HydroSim itself only offers NFT and DWC — tomato guidance above reflects published commercial
            practice, not a description of how the simulator models it. See each crop&apos;s module for detail.
          </p>
        </div>

        <div className="space-y-2">
          {TOPICS.map((topic) => {
            const isOpen = openTopic === topic.id;
            return (
              <div key={topic.id} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenTopic(isOpen ? null : topic.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{topic.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{topic.summary}</div>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 pt-1 border-t border-slate-800">
                    <topic.Content />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Glossary</h2>
          <DataTable
            columns={[{ header: 'Term', key: 'term' }, { header: 'Meaning', key: 'meaning' }]}
            rows={[
              { term: 'BBCH', meaning: 'A standard numeric scale for coding plant growth stages, 0 to 9' },
              { term: 'Bolting', meaning: "Running to flower, which ends a leafy crop's marketable life" },
              { term: 'Chlorosis', meaning: 'Yellowing of leaf tissue' },
              { term: 'Determinate', meaning: 'A tomato variety that stops growing once fruiting has occurred. Field practice' },
              { term: 'DO', meaning: 'Dissolved oxygen, measured in ppm' },
              { term: 'Dutch bucket', meaning: 'An 11-litre container with a drainage hole, used with perlite for greenhouse tomato' },
              { term: 'DWC', meaning: 'Deep Water Culture. Roots suspended in an aerated pond of solution' },
              { term: 'EC', meaning: 'Electrical conductivity, a measure of total dissolved salts, in mS/cm or dS/m' },
              { term: 'Indeterminate', meaning: 'A tomato variety that keeps growing after setting fruit. Greenhouse practice' },
              { term: 'Necrosis', meaning: 'Death of plant tissue, usually appearing brown or black' },
              { term: 'NFT', meaning: 'Nutrient Film Technique. A thin recirculating stream of solution in sloped channels' },
              { term: 'Pythium', meaning: 'A water mould causing root rot in hydroponic systems' },
              { term: 'Rockwool', meaning: 'A spun mineral substrate used in highwire tomato systems' },
              { term: 'Rosette', meaning: 'The lettuce stage where leaves form a distinct circular cluster' },
              { term: 'Truss', meaning: 'A cluster of flowers or fruit on a tomato stem' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

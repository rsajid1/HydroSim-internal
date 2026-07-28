import React from 'react';

// Shared presentational pieces for the Learning Modules topics — content stays in
// each topic file, these just keep the six of them visually consistent.

export const InShort: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="border-l-4 border-emerald-500/60 bg-emerald-500/10 rounded-r-md px-4 py-3 text-sm text-emerald-100">
    <span className="font-semibold uppercase text-xs text-emerald-300 tracking-wide mr-2">In short</span>
    {children}
  </div>
);

export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-2">
    <h3 className="text-sm font-semibold text-emerald-300">{title}</h3>
    <div className="text-sm text-slate-300 leading-relaxed space-y-2">{children}</div>
  </div>
);

export interface TableColumn {
  header: string;
  key: string;
}

export const DataTable: React.FC<{ columns: TableColumn[]; rows: Record<string, string>[] }> = ({ columns, rows }) => (
  <div className="overflow-x-auto rounded-md border border-slate-800">
    <table className="w-full text-sm text-left">
      <thead className="bg-slate-800/60 text-slate-300">
        <tr>
          {columns.map(col => (
            <th key={col.key} className="px-3 py-2 font-medium">{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">
        {rows.map((row, i) => (
          <tr key={i} className="text-slate-300">
            {columns.map(col => (
              <td key={col.key} className="px-3 py-2 align-top">{row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export interface SourceItem {
  label: string;
  url: string;
}

export const Sources: React.FC<{ items: SourceItem[] }> = ({ items }) => (
  <div className="pt-2 border-t border-slate-800">
    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Sources</h4>
    <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
      {items.map((item, i) => (
        <li key={i}>
          {item.label}{' '}
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline break-all">
            {item.url}
          </a>
        </li>
      ))}
    </ol>
  </div>
);

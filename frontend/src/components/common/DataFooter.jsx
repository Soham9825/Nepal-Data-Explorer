// // import React from "react";
// // export default function DataFooter() {
// //   // TODO: Wire export buttons to:
// //   // CSV  → GET /api/export/csv?type=national
// //   // PDF  → GET /api/export/pdf?type=national
// //   // Full → GET /api/reports/comprehensive

// //   return (
// //     <footer className="bg-surface border border-outline-variant rounded-sm p-8 flex flex-col md:flex-row items-center justify-between card-shadow">
// //       <div className="mb-6 md:mb-0 text-center md:text-left">
// //         <h3 className="text-2xl text-on-surface font-bold font-sans">Access Full Dataset</h3>
// //         <p className="text-on-surface-variant mt-1 text-sm">
// //           Download raw data for research or policy analysis.
// //         </p>
// //       </div>
// //       <div className="flex flex-wrap gap-4 justify-center">
// //         <button className="px-6 py-3 border border-outline-variant rounded-sm flex items-center space-x-2 text-on-surface hover:bg-surface-container-high transition-colors font-bold uppercase text-[12px] active:scale-95">
// //           <span className="material-symbols-outlined text-secondary">description</span>
// //           <span>Export CSV</span>
// //         </button>
// //         <button className="px-6 py-3 border border-outline-variant rounded-sm flex items-center space-x-2 text-on-surface hover:bg-surface-container-high transition-colors font-bold uppercase text-[12px] active:scale-95">
// //           <span className="material-symbols-outlined text-nepal-crimson">picture_as_pdf</span>
// //           <span>Export PDF</span>
// //         </button>
// //         <button className="px-8 py-3 bg-primary text-on-primary rounded-sm font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all text-sm">
// //           Download Comprehensive Report
// //         </button>
// //       </div>
// //     </footer>
// //   );
// // }


// import React from 'react';

// export default function DataFooter() {
//   return (
//     <footer className="bg-surface border border-outline-variant rounded-xl px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6 card-shadow">
//       <div className="text-center md:text-left">
//         <h3 className="text-xl font-bold text-on-surface">Access Full Dataset</h3>
//         <p className="text-on-surface-variant text-sm mt-1">
//           Download raw data for research or policy analysis.
//         </p>
//         <div className="flex items-center gap-4 mt-2 text-xs text-on-surface-variant">
//           <span className="flex items-center gap-1">
//             <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
//             Live Data
//           </span>
//           <span>·</span>
//           <span>Updated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
//         </div>
//       </div>
      
//       <div className="flex flex-wrap gap-3 justify-center">
//         <button className="px-5 py-2.5 border border-outline-variant rounded-lg flex items-center gap-2 text-on-surface hover:bg-surface-container-high transition-all font-bold uppercase text-[11px] active:scale-95">
//           <span className="material-symbols-outlined text-[18px] text-secondary">description</span>
//           <span>Export CSV</span>
//         </button>
//         <button className="px-5 py-2.5 border border-outline-variant rounded-lg flex items-center gap-2 text-on-surface hover:bg-surface-container-high transition-all font-bold uppercase text-[11px] active:scale-95">
//           <span className="material-symbols-outlined text-[18px] text-nepal-crimson">picture_as_pdf</span>
//           <span>Export PDF</span>
//         </button>
//         <button className="px-6 py-2.5 bg-primary text-white rounded-lg font-bold shadow-md hover:brightness-110 active:scale-95 transition-all text-sm flex items-center gap-2">
//           <span className="material-symbols-outlined text-[18px]">download</span>
//           Download Report
//         </button>
//       </div>
//     </footer>
//   );
// }


import React from 'react';
import { Icon } from '../ui/Icon';

export default function DataFooter() {
  return (
    <div className="bg-surface border border-outline-variant rounded-sm px-10 py-8 flex flex-col md:flex-row items-center justify-between card-shadow">
      <div className="mb-6 md:mb-0 text-center md:text-left">
        <h3 className="text-2xl text-on-surface font-bold font-sans">Access Full Dataset</h3>
        <p className="text-on-surface-variant mt-1 text-sm font-sans">
          Download raw data for research or policy analysis.
        </p>
      </div>
      <div className="flex flex-wrap gap-4 justify-center">
        <button className="ui-button px-6 py-3 border border-outline-variant rounded-sm flex items-center space-x-2 text-on-surface hover:bg-surface-container-high transition-colors font-bold uppercase text-[12px] active:scale-95 font-sans">
          <Icon name="description" size={20} color="#0051d5" />
          <span>Export CSV</span>
        </button>
        <button className="ui-button px-6 py-3 border border-outline-variant rounded-sm flex items-center space-x-2 text-on-surface hover:bg-surface-container-high transition-colors font-bold uppercase text-[12px] active:scale-95 font-sans">
          <Icon name="picture_as_pdf" size={20} color="#b70011" />
          <span>Export PDF</span>
        </button>
        <button className="ui-button px-8 py-3 bg-primary text-on-primary rounded-sm font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all text-sm font-sans">
          Download Comprehensive Report
        </button>
      </div>
    </div>
  );
}
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import National from '../pages/National';
import Economic from '../pages/Economic';
import Tourism from '../pages/Tourism';
import Predictions from '../pages/Predictions';
import Compare from '../pages/Compare';
import Provinces from '../pages/Provinces';
import News from '../pages/News';
import Reports from '../pages/Reports';
import Research from '../pages/Research';

import Support from '../pages/Support';
import NotFound from '../pages/NotFound';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<National />} />
        <Route path="/national" element={<National />} />
        <Route path="/economic" element={<Economic />} />
        <Route path="/tourism" element={<Tourism />} />
        <Route path="/predictions" element={<Predictions />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/provinces" element={<Provinces />} />
        <Route path="/provinces/:id" element={<Provinces />} />
        <Route path="/news" element={<News />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/research" element={<Research />} />
      
        <Route path="/support" element={<Support />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
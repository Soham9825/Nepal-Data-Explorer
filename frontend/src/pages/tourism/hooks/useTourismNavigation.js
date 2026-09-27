/**
 * Tab state, deep links and page scrolling for the Tourism dashboard.
 *
 * The top bar search links to `/tourism?section=<id>`, but a link only carries a
 * panel id — it does not know which tab owns that panel, and it cannot scroll to
 * a panel that is not rendered yet. This hook resolves both halves:
 *
 * 1. `?section=<id>` is looked up in the section index, which switches to the
 *    owning tab and parks the id in `pendingSection`.
 * 2. A second effect carries the id out once the panel is actually on the page.
 *
 * The parameter is deliberately left in the URL so the link stays shareable and
 * survives a refresh; picking a tab by hand clears it.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { findTourismSection } from '../../../data/tourismSections';
import { DEFAULT_TAB } from '../constants';

export function useTourismNavigation({ loading }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  // Set while a deep link is being resolved, so the scroll-to-top effect stands
  // down and the panel scroll below can take over.
  const [pendingSection, setPendingSection] = useState('');
  const pageRef = useRef(null);

  const requestedSection = searchParams.get('section') || '';
  const requestedProvince = searchParams.get('province') || '';

  // Choosing a tab by hand supersedes whatever the URL was pointing at.
  const selectTab = (tabId) => {
    setActiveTab(tabId);
    if (!requestedSection) return;
    const next = new URLSearchParams(searchParams);
    next.delete('section');
    setSearchParams(next, { replace: true });
  };

  // Switching sections always starts the new section from the top of the page
  // instead of inheriting the previous tab's scroll offset.
  //
  // A pending deep link is the exception: arriving from search should land on the
  // requested panel, not the top of the tab, so this defers to the effect below.
  useEffect(() => {
    if (pendingSection) return;
    const scroller = pageRef.current?.closest('main');
    if (!scroller || scroller.scrollTop <= 0) return;
    scroller.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab, pendingSection]);

  useEffect(() => {
    const section = findTourismSection(requestedSection);
    if (!section) return;
    setActiveTab(section.tab);
    setPendingSection(section.id);
  }, [requestedSection]);

  // Carry out a deep link once its panel is on the page.
  //
  // On a cold load the page renders a loader first, so the target does not exist
  // yet; the pending target is therefore only cleared once the element is found,
  // and the effect re-runs when loading finishes. Waiting a frame after that gives
  // the freshly selected tab time to lay the panel out before measuring it.
  useEffect(() => {
    if (!pendingSection || loading) return;
    const target = document.getElementById(pendingSection);
    if (!target) return;
    setPendingSection('');
    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingSection, loading]);

  return { activeTab, selectTab, pageRef, requestedProvince };
}

/**
 * Tab state, deep links and page scrolling for the Economic dashboard.
 *
 * The top bar search can link to `/economic?section=<id>`, but a link only carries
 * a section id — it does not know which tab owns that section, and it cannot scroll
 * to a section that is not rendered yet. This hook resolves both halves:
 *
 * 1. `?section=<id>` is looked up in the section catalog, which switches to the
 *    owning tab and parks the id in `pendingSection`.
 * 2. A second effect carries the id out once that section is actually on the page.
 *
 * The tab itself is mirrored into `?tab=<id>` so a link to one tab can be shared and
 * survives a refresh. Picking a tab by hand rewrites it, which keeps the URL honest
 * about what is on screen.
 *
 * Switching tabs always starts the new tab from the top of the page instead of
 * inheriting the previous tab's scroll offset — the two tabs have nothing in common
 * vertically, so keeping the offset would drop the reader into the middle of one.
 * A pending deep link is the exception: arriving from search should land on the
 * requested section, not the top of the tab, so this defers to the effect below.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_TAB, TABS, TAB_BY_ID, sectionElementId } from '../constants';

/**
 * The tab that owns a section, or `''` when the id is not one of ours.
 *
 * Read off `TABS` rather than off a `group` field on the section, so the tab
 * configuration stays the single place that says which tab holds what — adding a
 * section to a tab cannot leave the deep link resolving to a tab that is not
 * showing it.
 */
const tabForSection = (sectionId) =>
  TABS.find((tab) => tab.rows.some((row) => row.includes(sectionId)))?.id || '';

export function useEconomicNavigation({ loading }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const requested = searchParams.get('tab');
    return requested && TAB_BY_ID[requested] ? requested : DEFAULT_TAB;
  });
  // Set while a deep link is being resolved, so the scroll-to-top effect stands
  // down and the section scroll below can take over.
  const [pendingSection, setPendingSection] = useState('');
  const pageRef = useRef(null);

  const requestedSection = searchParams.get('section') || '';

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    setPendingSection('');
    const next = new URLSearchParams(searchParams);
    next.delete('section');
    if (tabId === DEFAULT_TAB) next.delete('tab');
    else next.set('tab', tabId);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (pendingSection) return;
    const scroller = pageRef.current?.closest('main');
    if (!scroller || scroller.scrollTop <= 0) return;
    scroller.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab, pendingSection]);

  useEffect(() => {
    const tabId = tabForSection(requestedSection);
    if (!tabId) return;
    setActiveTab(tabId);
    setPendingSection(requestedSection);
  }, [requestedSection]);

  // Carry out a deep link once its section is on the page.
  //
  // On a cold load the page renders a loader first, so the target does not exist
  // yet; the pending target is therefore only cleared once the element is found,
  // and the effect re-runs when loading finishes. Waiting a frame after that gives
  // the freshly selected tab time to lay the section out before measuring it.
  useEffect(() => {
    if (!pendingSection || loading) return;
    const target = document.getElementById(sectionElementId(pendingSection));
    if (!target) return;
    setPendingSection('');
    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingSection, loading, activeTab]);

  return { activeTab, selectTab, pageRef };
}

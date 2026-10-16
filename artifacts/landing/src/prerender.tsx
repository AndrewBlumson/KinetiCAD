import { renderToString } from 'react-dom/server';
import { Router } from 'wouter';
import { DesktopLanding } from './components/DesktopLanding';
import StoryPage from './pages/StoryPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import NotFound from './pages/not-found';

// Render the existing public components at build time. The CAD workspace remains
// entirely browser-side, including its WebGPU check and local project storage.
export function render(path: string) {
  const Page = ({ '/': DesktopLanding, '/story': StoryPage, '/terms': TermsPage,
    '/privacy': PrivacyPage } as Record<string, typeof DesktopLanding>)[path] ?? NotFound;
  return renderToString(<Router ssrPath={path}><Page /></Router>);
}

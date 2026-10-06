import { ArrowLeft, ClipboardList, Factory, LayoutDashboard, PackageX, Trophy } from 'lucide-react';
import Production from './Production';
import RecordBoard from './RecordBoard';
import Damage from './Damage';

/**
 * Production opens as a workspace of its own rather than another page inside
 * the owner dashboard: the floor's pages have their own sidebar, and the
 * dashboard's menu stays out of the way until you come back to it.
 */
export default function ProductionWorkspace({ token, apiBase, view, onView, onExit }: {
  token: string | null; apiBase: string; view: 'report' | 'records' | 'board' | 'damage';
  onView: (next: 'report' | 'records' | 'board' | 'damage') => void; onExit: () => void;
}) {
  const pages = [
    { id: 'report' as const, label: 'Overview', hint: 'Targets & performance', Icon: LayoutDashboard },
    { id: 'records' as const, label: 'Records', hint: 'Every saved work entry', Icon: ClipboardList },
    { id: 'board' as const, label: 'Record board', hint: 'Fastest ever, and who holds it', Icon: Trophy },
    { id: 'damage' as const, label: 'Damage pcs', hint: 'Broken pieces from the app', Icon: PackageX }
  ];
  return <div className="factory-workspace">
    <aside className="factory-side" aria-label="Production workspace navigation">
      <button type="button" className="factory-back" onClick={onExit}><ArrowLeft size={17} aria-hidden="true" />Back to Office Pro</button>
      <div className="factory-brand"><span aria-hidden="true"><Factory size={22} /></span><div><strong>BAFNA TOYS</strong><small>PRODUCTION</small></div></div>
      <nav aria-label="Production pages">
        {pages.map(page => <button
          key={page.id}
          type="button"
          onClick={() => onView(page.id)}
          className={`factory-link ${view === page.id ? 'on' : ''}`}
          aria-current={view === page.id ? 'page' : undefined}
        ><page.Icon size={18} aria-hidden="true" /><span><strong>{page.label}</strong><small>{page.hint}</small></span></button>)}
      </nav>
      <p className="factory-foot">Owner view · read only<span>All times follow IST</span></p>
    </aside>
    <main className="factory-main">{view === 'board' ? <RecordBoard token={token} apiBase={apiBase} /> : view === 'damage' ? <Damage token={token} apiBase={apiBase} /> : <Production token={token} apiBase={apiBase} view={view} />}</main>
  </div>;
}

'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bell, Boxes, ChartNoAxesCombined, Copy, Home, LayoutDashboard, LogOut, Menu, Plus, Search, Settings, ShoppingBag, Trash2, Users, X } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_MIG_FARM_API_URL || 'https://mig-farm-api.onrender.com';
const pages = ['Dashboard', 'Customers', 'Orders', 'Offers', 'Home Content', 'Push Notifications', 'Notification History', 'Settings'] as const;
type PageName = typeof pages[number];
type Session = { accessToken: string; user: { name: string; email: string; role?: string } };
type Toast = { tone: 'ok' | 'error'; text: string };
type Filters = { q: string; status: string; language: string; payment: string; target: string };

const toneByStatus: Record<string, string> = {
  active: 'ok',
  configured: 'ok',
  online: 'ok',
  paid: 'ok',
  delivered: 'ok',
  ready: 'amber',
  scheduled: 'amber',
  processing: 'amber',
  pending: 'amber',
  new: 'blue',
  draft: 'muted',
  inactive: 'muted',
  not_configured: 'amber',
  failed: 'danger',
  cancelled: 'danger',
  suspended: 'danger',
};

const purposeByForm = {
  offer: 'offer-banner',
  home: 'home-banner',
  push: 'home-banner',
} as const;

const icons: Record<PageName, React.ComponentType<{ size?: number }>> = {
  Dashboard: LayoutDashboard,
  Customers: Users,
  Orders: ShoppingBag,
  Offers: Boxes,
  'Home Content': Home,
  'Push Notifications': Bell,
  'Notification History': ChartNoAxesCombined,
  Settings,
};

async function api<T>(session: Session | null, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API_URL.replace(/\/+$/, '') + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `request_failed_${response.status}`);
  return data as Promise<T>;
}

async function uploadMedia(session: Session | null, file: File, purpose: string) {
  const body = new FormData();
  body.append('purpose', purpose);
  body.append('file', file);
  const response = await fetch(API_URL.replace(/\/+$/, '') + '/api/admin/media/upload', {
    method: 'POST',
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
    body,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `upload_failed_${response.status}`);
  return data as { url: string; key: string };
}

function formBody(form: HTMLFormElement) {
  const body = Object.fromEntries(new FormData(form).entries());
  return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
}

function Table({ columns, rows, empty, onRow }: { columns: string[]; rows: Array<{ id: string; cells: React.ReactNode[] }>; empty: string; onRow?: (id: string) => void }) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  return <div className="tableWrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} onClick={() => onRow?.(row.id)} className={onRow ? 'clickable' : ''}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function Badge({ value }: { value?: string | number | null }) {
  const text = String(value || 'unknown');
  return <span className={`pill ${toneByStatus[text] || 'muted'}`}>{text.replace(/_/g, ' ')}</span>;
}

function money(value: unknown, currency = 'AED') {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function prettyDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : 'Not set';
}

function CellTitle({ title, meta }: { title?: string; meta?: string }) {
  return <div className="cellTitle"><b>{title || 'Untitled'}</b><span>{meta || ''}</span></div>;
}

export default function AdminControlCenter() {
  const [session, setSession] = useState<Session | null>(null);
  const [active, setActive] = useState<PageName>('Dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, any>>({});
  const [detail, setDetail] = useState<{ title: string; content: React.ReactNode } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; action: () => Promise<void> } | null>(null);
  const [filters, setFilters] = useState<Filters>({ q: '', status: '', language: '', payment: '', target: '' });
  const [preview, setPreview] = useState({ title: 'MIG FARM', body: 'Preview content before publishing.' });
  useEffect(() => {
    const stored = sessionStorage.getItem('migAdminSession');
    if (stored) setSession(JSON.parse(stored));
  }, []);
  const route = useMemo(() => ({
    Dashboard: '/api/admin/summary',
    Customers: `/api/admin/customers?limit=30&q=${encodeURIComponent(filters.q)}&language=${encodeURIComponent(filters.language)}&status=${encodeURIComponent(filters.status)}`,
    Orders: `/api/admin/orders?limit=30&q=${encodeURIComponent(filters.q)}&status=${encodeURIComponent(filters.status)}&payment=${encodeURIComponent(filters.payment)}`,
    Offers: `/api/admin/offers?limit=30&q=${encodeURIComponent(filters.q)}&status=${encodeURIComponent(filters.status)}`,
    'Home Content': `/api/admin/home-content?limit=50&q=${encodeURIComponent(filters.q)}`,
    'Push Notifications': `/api/admin/push-campaigns?limit=30&q=${encodeURIComponent(filters.q)}&status=${encodeURIComponent(filters.status)}&target=${encodeURIComponent(filters.target)}`,
    'Notification History': `/api/admin/push-campaigns?limit=50&q=${encodeURIComponent(filters.q)}&status=${encodeURIComponent(filters.status)}&target=${encodeURIComponent(filters.target)}`,
    Settings: '/api/admin/system',
  })[active], [active, filters]);
  const signOut = () => {
    sessionStorage.removeItem('migAdminSession');
    setSession(null);
  };
  const load = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const next = await api(session, route);
      setData((current) => ({ ...current, [active]: next }));
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to load data';
      setToast({ tone: 'error', text });
      if (text.includes('unauthorized')) signOut();
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [session?.accessToken, active, route]);
  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const auth = await api<{ accessToken: string; user: Session['user'] }>(null, '/api/auth/login', { method: 'POST', body: JSON.stringify(formBody(event.currentTarget)) });
      const next = { accessToken: auth.accessToken, user: auth.user };
      await api(next, '/api/admin/summary');
      sessionStorage.setItem('migAdminSession', JSON.stringify(next));
      setSession(next);
      setToast({ tone: 'ok', text: 'Signed in' });
    } catch {
      setToast({ tone: 'error', text: 'Invalid admin credentials or missing admin role' });
    } finally {
      setLoading(false);
    }
  };
  const save = async (path: string, form: HTMLFormElement, method = 'POST') => {
    if (!session) return;
    const body = formBody(form);
    setPreview({ title: String(body.titleEn || body.titleAr || 'MIG FARM'), body: String(body.bodyEn || body.descriptionEn || body.deepLink || '') });
    try {
      await api(session, path, { method, body: JSON.stringify(body) });
      form.reset();
      setToast({ tone: 'ok', text: 'Saved successfully' });
      await load();
    } catch (error) {
      setToast({ tone: 'error', text: error instanceof Error ? error.message : 'Save failed' });
    }
  };
  const remove = async (path: string) => {
    if (!session) return;
    await api(session, path, { method: 'DELETE' });
    setToast({ tone: 'ok', text: 'Deleted' });
    await load();
  };
  if (!session) return <SignIn onSubmit={signIn} loading={loading} toast={toast} />;
  const current = data[active] || {};
  return (
    <div className="shell">
      <aside className={drawerOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand"><div className="mark">M</div><div>MIG FARM<br /><small>Admin Control Center</small></div></div>
        <nav className="nav">{pages.map((page) => {
          const Icon = icons[page];
          return <button key={page} className={active === page ? 'active' : ''} onClick={() => { setActive(page); setDrawerOpen(false); }}><Icon size={18} />{page}</button>;
        })}</nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="iconButton mobileOnly" onClick={() => setDrawerOpen(true)}><Menu size={20} /></button>
          <div><h1>{active}</h1><p>{loading ? 'Loading live backend data...' : 'Production data from MIG FARM API'}</p></div>
          <div className="profile"><span className="dot" />API online <b>{session.user.name || session.user.email}</b><button className="btn secondary" onClick={signOut}><LogOut size={16} />Sign Out</button></div>
        </header>
        <Filters active={active} filters={filters} setFilters={setFilters} />
        {active === 'Dashboard' ? <Dashboard data={current} /> : null}
        {active === 'Customers' ? <Customers data={current} open={(id) => openCustomer(session, id, setDetail, setToast)} /> : null}
        {active === 'Orders' ? <Orders data={current} open={(id) => openOrder(session, id, setDetail, setToast)} update={(id, deliveryStatus) => saveJson(session, `/api/admin/orders/${id}`, { deliveryStatus }, setToast).then(load)} /> : null}
        {active === 'Offers' ? <Offers data={current} save={save} session={session} setToast={setToast} confirmDelete={(id) => setConfirm({ title: 'Delete this offer?', action: () => remove(`/api/admin/offers/${id}`) })} /> : null}
        {active === 'Home Content' ? <HomeContent data={current} save={save} session={session} setToast={setToast} confirmDelete={(id) => setConfirm({ title: 'Delete this home section?', action: () => remove(`/api/admin/home-content/${id}`) })} preview={preview} /> : null}
        {active === 'Push Notifications' ? <Push data={current} save={save} session={session} setToast={setToast} /> : null}
        {active === 'Notification History' ? <NotificationHistory data={current} /> : null}
        {active === 'Settings' ? <SettingsPage data={current} session={session} onPassword={(form) => saveJson(session, '/api/auth/change-password', formBody(form), setToast).then(signOut)} /> : null}
      </main>
      {drawerOpen ? <button className="backdrop" onClick={() => setDrawerOpen(false)} /> : null}
      {detail ? <Drawer detail={detail} close={() => setDetail(null)} /> : null}
      {confirm ? <Confirm value={confirm} close={() => setConfirm(null)} /> : null}
      {toast ? <div className={`toast ${toast.tone}`}>{toast.text}<button onClick={() => setToast(null)}>×</button></div> : null}
    </div>
  );
}

function SignIn({ onSubmit, loading, toast }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; loading: boolean; toast: Toast | null }) {
  return <main className="auth"><form className="authCard" onSubmit={onSubmit}><div className="mark">M</div><h1>MIG FARM Admin</h1><p>Sign in with an admin account. Tokens stay in sessionStorage only.</p><input className="input" name="email" type="email" placeholder="Email" required /><input className="input" name="password" type="password" placeholder="Password" required /><button className="btn" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>{toast ? <p className={toast.tone === 'error' ? 'errorText' : 'okText'}>{toast.text}</p> : null}</form></main>;
}

function Filters({ active, filters, setFilters }: { active: PageName; filters: Filters; setFilters: (value: Filters) => void }) {
  if (active === 'Dashboard' || active === 'Settings') return null;
  return <div className="filters"><Search size={16} /><input className="bareInput" placeholder="Search" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />{active === 'Customers' ? <select value={filters.language} onChange={(event) => setFilters({ ...filters, language: event.target.value })}><option value="">All languages</option><option value="ar">Arabic</option><option value="en">English</option></select> : null}{['Customers','Orders','Offers','Push Notifications','Notification History'].includes(active) ? <input className="bareInput small" placeholder="Status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} /> : null}{active === 'Orders' ? <input className="bareInput small" placeholder="Payment" value={filters.payment} onChange={(event) => setFilters({ ...filters, payment: event.target.value })} /> : null}{['Push Notifications','Notification History'].includes(active) ? <input className="bareInput small" placeholder="Audience" value={filters.target} onChange={(event) => setFilters({ ...filters, target: event.target.value })} /> : null}</div>;
}

function Dashboard({ data }: { data: any }) {
  const cards = [['Customers', data.customers], ['Orders', data.orders], ['Revenue', money(data.revenue)], ['Avg. Order', money(data.averageOrderValue)], ['Pending', data.pendingOrders], ['Active Offers', data.activeOffers], ['Push Campaigns', data.pushCampaigns], ['New Customers', data.newCustomers]];
  return <><section className="metricGrid">{cards.map(([label, value]) => <article className="card metric" key={label}><b>{value ?? '0'}</b><span>{label}</span></article>)}</section><section className="chartGrid"><ChartCard title="Order Status Breakdown" rows={data.orderStatusBreakdown || []} /><MiniList title="Recent Customers" empty="No recent customers" rows={(data.recentCustomers || []).map((c: any) => ({ id: c.id, title: c.name || c.email, meta: `${c.language || 'n/a'} · ${prettyDate(c.createdAt)}`, badge: c.status }))} /><MiniList title="Recent Orders" empty="No orders yet" rows={(data.recentOrders || []).map((o: any) => ({ id: o.id, title: o.id, meta: money(o.total, o.currency), badge: o.delivery_status || o.deliveryStatus }))} /><MiniList title="Recent Push Campaigns" empty="No push campaigns yet" rows={(data.recentPushCampaigns || []).map((p: any) => ({ id: p.id, title: p.title_en || p.title_ar || p.id, meta: p.scheduled_at ? `Scheduled ${prettyDate(p.scheduled_at)}` : 'Send now', badge: p.status }))} /><SystemHealth data={data.system || {}} /></section></>;
}

function ChartCard({ title, rows }: { title: string; rows: Array<{ status: string; total: number }> }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.total || 0)));
  return <article className="card chartCard"><h2>{title}</h2>{rows.length ? rows.map((row) => <div className="chartRow" key={row.status}><span>{row.status}</span><div><i style={{ width: `${(Number(row.total || 0) / max) * 100}%` }} /></div><b>{row.total}</b></div>) : <div className="empty compact">No chart data yet</div>}</article>;
}

function MiniList({ title, rows, empty }: { title: string; rows: Array<{ id: string; title: string; meta: string; badge?: string }>; empty: string }) {
  return <article className="card"><h2>{title}</h2>{rows.length ? rows.map((row) => <div className="miniRow" key={row.id}><div><b>{row.title}</b><span>{row.meta}</span></div><Badge value={row.badge} /></div>) : <div className="empty compact">{empty}</div>}</article>;
}

function SystemHealth({ data }: { data: any }) {
  const rows = Object.entries(data);
  return <article className="card"><h2>System Health</h2>{rows.length ? rows.map(([key, value]) => <div className="bar health" key={key}><span>{key.replace(/([A-Z])/g, ' $1')}</span><Badge value={String(value)} /></div>) : <div className="empty compact">System status unavailable</div>}</article>;
}

function Customers({ data, open }: { data: any; open: (id: string) => void }) {
  return <section className="card"><Table columns={['Customer', 'Contact', 'Language', 'Emirate', 'Orders', 'Spent', 'Status']} empty="No customers found" onRow={open} rows={(data.items || []).map((c: any) => ({ id: c.id, cells: [<CellTitle key="c" title={c.name} meta={prettyDate(c.createdAt)} />, <CellTitle key="e" title={c.email} meta={c.phone || 'No phone'} />, c.language, c.emirate || 'Not set', c.orderCount, money(c.totalSpent), <Badge key="s" value={c.status} />] }))} /></section>;
}

function Orders({ data, open, update }: { data: any; open: (id: string) => void; update: (id: string, status: string) => void }) {
  return <section className="card"><Table columns={['Order', 'Customer', 'Date', 'Delivery', 'Payment', 'Total', 'Lifecycle']} empty="No orders yet" onRow={open} rows={(data.items || []).map((o: any) => ({ id: o.id, cells: [o.id, o.customerName || o.customerEmail || 'Guest', prettyDate(o.createdAt), <Badge key="s" value={o.deliveryStatus} />, <Badge key="p" value={o.paymentStatus} />, money(o.total, o.currency), <select key="u" value={o.deliveryStatus} onClick={(event) => event.stopPropagation()} onChange={(event) => update(o.id, event.target.value)}><option>new</option><option>processing</option><option>ready</option><option>shipped</option><option>delivered</option><option>cancelled</option></select>] }))} /></section>;
}

function Offers({ data, save, session, setToast, confirmDelete }: { data: any; save: (path: string, form: HTMLFormElement, method?: string) => void; session: Session; setToast: (toast: Toast) => void; confirmDelete: (id: string) => void }) {
  return <section className="workspace"><article className="card"><div className="cardHead"><h2>Offers Manager</h2><button className="btn mini"><Plus size={15} />Create Offer</button></div><Table columns={['Offer', 'Target', 'Status', 'Discount', 'Dates', 'Actions']} empty="No active offers" rows={(data.items || []).map((o: any) => ({ id: o.id, cells: [<CellTitle key="t" title={o.title_en} meta={o.title_ar} />, o.target || 'all_products', <Badge key="s" value={o.status} />, o.discount || `${o.discount_type || ''} ${o.discount_value || ''}`, `${prettyDate(o.starts_at)} - ${prettyDate(o.ends_at)}`, <span className="rowActions" key="a"><button title="Duplicate"><Copy size={15} /></button><button className="linkBtn" onClick={() => confirmDelete(o.id)}><Trash2 size={15} /></button></span>] }))} /></article><FormCard title="Offer Editor" action={(form) => save('/api/admin/offers', form)} fields="offer" session={session} setToast={setToast} /></section>;
}

function HomeContent({ data, save, session, setToast, confirmDelete, preview }: { data: any; save: (path: string, form: HTMLFormElement, method?: string) => void; session: Session; setToast: (toast: Toast) => void; confirmDelete: (id: string) => void; preview: { title: string; body: string } }) {
  return <section className="workspace"><article className="card"><Table columns={['Kind', 'Title', 'Visible', 'Order', '']} empty="No home content created" rows={(data.items || []).map((s: any) => ({ id: s.id, cells: [s.kind, s.title_en, <Badge key="v" value={s.visible ? 'active' : 'inactive'} />, s.sort_order, <button className="linkBtn" key="d" onClick={() => confirmDelete(s.id)}>Delete</button>] }))} /></article><div className="stack"><FormCard title="Home Content Manager" action={(form) => save('/api/admin/home-content', form)} fields="home" session={session} setToast={setToast} /><Preview preview={preview} /></div></section>;
}

function Push({ data, save, session, setToast }: { data: any; save: (path: string, form: HTMLFormElement, method?: string) => void; session: Session; setToast: (toast: Toast) => void }) {
  return <section className="workspace"><article className="card"><div className="notice amber">Push delivery provider not configured unless production credentials are present.</div><Table columns={['Campaign', 'Audience', 'Status', 'Scheduled']} empty="No notification campaigns yet" rows={(data.items || []).map((p: any) => ({ id: p.id, cells: [<CellTitle key="t" title={p.title_en} meta={p.title_ar || p.body_en} />, p.target, <Badge key="s" value={p.status} />, p.scheduled_at || 'Send now'] }))} /></article><FormCard title="Push Campaign Builder" action={(form) => save('/api/admin/push-campaigns', form)} fields="push" session={session} setToast={setToast} /></section>;
}

function NotificationHistory({ data }: { data: any }) {
  return <section className="card"><Table columns={['Campaign', 'Audience', 'Created', 'Scheduled', 'Sent', 'Status']} empty="No notification history yet" rows={(data.items || []).map((p: any) => ({ id: p.id, cells: [<CellTitle key="t" title={p.title_en} meta={p.title_ar} />, p.target, prettyDate(p.created_at), p.scheduled_at || 'Not scheduled', p.sent_at || 'Not sent', <Badge key="s" value={p.status} />] }))} /></section>;
}

function SettingsPage({ data, session, onPassword }: { data: any; session: Session; onPassword: (form: HTMLFormElement) => void }) {
  return <section className="workspace"><article className="card"><h2>Admin Account</h2><p>{session.user.email}</p><p>Role: {session.user.role || 'admin'}</p><form className="form" onSubmit={(event) => { event.preventDefault(); onPassword(event.currentTarget); }}><input className="input" name="currentPassword" type="password" placeholder="Current password" required /><input className="input" name="newPassword" type="password" placeholder="New password" required /><input className="input" name="confirmPassword" type="password" placeholder="Confirm password" required /><button className="btn">Change Password</button></form></article><article className="card"><h2>System Status</h2>{Object.entries(data).map(([key, value]) => <div className="bar" key={key}><span>{key}</span><b>{String(value)}</b></div>)}</article></section>;
}

function FormCard({ title, action, fields, session, setToast }: { title: string; action: (form: HTMLFormElement) => void; fields: 'offer' | 'home' | 'push'; session: Session; setToast: (toast: Toast) => void }) {
  const mediaName = fields === 'home' ? 'imageUrl' : 'bannerUrl';
  return <form className="card form editorCard" onSubmit={(event) => { event.preventDefault(); action(event.currentTarget); }}><h2>{title}</h2>{fields === 'home' ? <label>Section type<select className="input" name="kind"><option>hero</option><option>announcement</option><option>promo</option><option>featured</option><option>new_arrivals</option><option>popular</option><option>recommended</option></select></label> : null}<div className="fieldGrid"><label>English title<input className="input" name="titleEn" dir="ltr" required={fields !== 'home'} /></label><label>Arabic title<input className="input rtl" name="titleAr" dir="rtl" required={fields !== 'home'} /></label></div>{fields === 'push' ? <><label>English message<textarea className="input" name="bodyEn" dir="ltr" required /></label><label>Arabic message<textarea className="input rtl" name="bodyAr" dir="rtl" required /></label><div className="fieldGrid"><label>Audience<select className="input" name="target"><option value="all">All Users</option><option value="ar">Arabic Users</option><option value="en">English Users</option><option value="customers">Customers</option></select></label><label>Schedule<input className="input" name="scheduledAt" type="datetime-local" /></label></div><label>Deep link<input className="input" name="deepLink" placeholder="/offers" /></label></> : <><label>English body<textarea className="input" name={fields === 'home' ? 'bodyEn' : 'descriptionEn'} dir="ltr" /></label><label>Arabic body<textarea className="input rtl" name={fields === 'home' ? 'bodyAr' : 'descriptionAr'} dir="rtl" /></label><MediaUploader session={session} name={mediaName} purpose={purposeByForm[fields]} setToast={setToast} /><label>Deep link<input className="input" name="deepLink" placeholder="/catalog" /></label>{fields === 'home' ? <div className="fieldGrid"><label>Priority<input className="input" name="sortOrder" type="number" min="0" /></label><label>Visibility<select className="input" name="visible"><option value="true">Visible</option><option value="false">Hidden</option></select></label></div> : <><div className="fieldGrid"><label>Discount type<select className="input" name="discountType"><option value="percentage">Percentage</option><option value="fixed">Fixed</option></select></label><label>Discount value<input className="input" name="discountValue" type="number" min="0" step="0.01" /></label></div><div className="fieldGrid"><label>Status<select className="input" name="status"><option>draft</option><option>active</option><option>inactive</option><option>scheduled</option></select></label><label>Target<select className="input" name="target"><option value="all_products">All Products</option><option value="category">Category</option><option value="product">Product</option></select></label></div><label>Target reference<input className="input" name="targetRef" placeholder="Product or category reference" /></label><div className="fieldGrid"><label>Start date<input className="input" name="startsAt" type="datetime-local" /></label><label>End date<input className="input" name="endsAt" type="datetime-local" /></label></div></>}</>}<div className="stickyActions"><button className="btn">Save</button></div></form>;
}

function MediaUploader({ session, name, purpose, setToast }: { session: Session; name: string; purpose: string; setToast: (toast: Toast) => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setToast({ tone: 'error', text: 'Only JPEG, PNG and WebP images are allowed' });
    if (file.size > 5 * 1024 * 1024) return setToast({ tone: 'error', text: 'Image must be 5 MB or smaller' });
    setBusy(true);
    try {
      const uploaded = await uploadMedia(session, file, purpose);
      setUrl(uploaded.url);
      setToast({ tone: 'ok', text: 'Media uploaded' });
    } catch (error) {
      setToast({ tone: 'error', text: error instanceof Error ? error.message : 'Upload failed' });
    } finally {
      setBusy(false);
    }
  };
  return <div className="mediaUploader" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void pick(event.dataTransfer.files[0]); }}><input type="hidden" name={name} value={url} /><label>Media upload<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void pick(event.currentTarget.files?.[0])} /></label><div className="dropZone">{url ? <img src={url} alt="" /> : <><b>{busy ? 'Uploading...' : 'Drop image or click to upload'}</b><span>JPEG, PNG or WebP. Manual URL fallback stays available below.</span></>}</div><label>Manual media URL<input className="input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." /></label>{url ? <button className="btn secondary" type="button" onClick={() => setUrl('')}>Remove image</button> : null}</div>;
}

function Preview({ preview }: { preview: { title: string; body: string } }) {
  return <article className="card"><h2>Live Mobile Preview</h2><div className="phone"><div className="phoneHero"><span className="pill">MIG FARM</span><h3>{preview.title}</h3><p>{preview.body}</p></div></div></article>;
}

async function saveJson(session: Session, path: string, body: unknown, setToast: (toast: Toast) => void) {
  try {
    await api(session, path, { method: 'PATCH', body: JSON.stringify(body) });
    setToast({ tone: 'ok', text: 'Updated' });
  } catch (error) {
    setToast({ tone: 'error', text: error instanceof Error ? error.message : 'Update failed' });
  }
}

async function openCustomer(session: Session, id: string, setDetail: (value: { title: string; content: React.ReactNode }) => void, setToast: (toast: Toast) => void) {
  try {
    const data = await api<any>(session, `/api/admin/customers/${id}`);
    setDetail({ title: data.customer.name, content: <div className="detailGrid"><p>{data.customer.email}<br />{data.customer.phone}<br />{data.customer.emirate}</p><b>Orders: {data.customer.orderCount}</b><b>Total spent: AED {data.customer.totalSpent}</b><b>Farms: {data.myFarm?.farms || 0}</b><b>Crops: {data.myFarm?.crops || 0}</b><b>Tasks: {data.myFarm?.tasks || 0}</b><b>Problems: {data.myFarm?.problems || 0}</b></div> });
  } catch (error) {
    setToast({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to open customer' });
  }
}

async function openOrder(session: Session, id: string, setDetail: (value: { title: string; content: React.ReactNode }) => void, setToast: (toast: Toast) => void) {
  try {
    const data = await api<any>(session, `/api/admin/orders/${id}`);
    setDetail({ title: data.order.id, content: <div><p>{data.order.customer?.name || 'Guest'} · {data.order.paymentStatus}</p><Table columns={['Item', 'Qty', 'Unit', 'Line']} empty="No items" rows={(data.order.items || []).map((item: any, index: number) => ({ id: String(index), cells: [item.title, item.quantity, item.unit_price, item.line_total] }))} /><p>Subtotal: AED {data.order.subtotal}<br />Delivery: AED {data.order.delivery}<br />Total: AED {data.order.total}</p></div> });
  } catch (error) {
    setToast({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to open order' });
  }
}

function Drawer({ detail, close }: { detail: { title: string; content: React.ReactNode }; close: () => void }) {
  return <aside className="drawer"><button className="iconButton" onClick={close}><X size={18} /></button><h2>{detail.title}</h2>{detail.content}</aside>;
}

function Confirm({ value, close }: { value: { title: string; action: () => Promise<void> }; close: () => void }) {
  return <div className="modal"><div className="confirm"><h2>{value.title}</h2><p>This action requires confirmation.</p><button className="btn secondary" onClick={close}>Cancel</button><button className="btn danger" onClick={() => value.action().finally(close)}>Confirm</button></div></div>;
}

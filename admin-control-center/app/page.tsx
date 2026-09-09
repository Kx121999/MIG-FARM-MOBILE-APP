'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bell, Boxes, ChartNoAxesCombined, Home, LayoutDashboard, LogOut, Menu, Search, Settings, ShoppingBag, Users, X } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_MIG_FARM_API_URL || 'https://mig-farm-api.onrender.com';
const pages = ['Dashboard', 'Customers', 'Orders', 'Offers', 'Home Content', 'Push Notifications', 'Notification History', 'Settings'] as const;
type PageName = typeof pages[number];
type Session = { accessToken: string; user: { name: string; email: string; role?: string } };
type Toast = { tone: 'ok' | 'error'; text: string };
type Filters = { q: string; status: string; language: string; payment: string; target: string };

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

function formBody(form: HTMLFormElement) {
  const body = Object.fromEntries(new FormData(form).entries());
  return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
}

function Table({ columns, rows, empty, onRow }: { columns: string[]; rows: Array<{ id: string; cells: React.ReactNode[] }>; empty: string; onRow?: (id: string) => void }) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  return <div className="tableWrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} onClick={() => onRow?.(row.id)} className={onRow ? 'clickable' : ''}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div>;
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
        {active === 'Offers' ? <Offers data={current} save={save} confirmDelete={(id) => setConfirm({ title: 'Delete this offer?', action: () => remove(`/api/admin/offers/${id}`) })} /> : null}
        {active === 'Home Content' ? <HomeContent data={current} save={save} confirmDelete={(id) => setConfirm({ title: 'Delete this home section?', action: () => remove(`/api/admin/home-content/${id}`) })} preview={preview} /> : null}
        {active === 'Push Notifications' ? <Push data={current} save={save} /> : null}
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
  const cards = [['Total Customers', data.customers], ['Total Orders', data.orders], ['Revenue', data.revenue == null ? '' : `AED ${Number(data.revenue).toFixed(2)}`], ['Average Order Value', data.averageOrderValue == null ? '' : `AED ${Number(data.averageOrderValue).toFixed(2)}`], ['Pending Orders', data.pendingOrders], ['Active Offers', data.activeOffers], ['Push Campaigns', data.pushCampaigns], ['New Customers', data.newCustomers]];
  return <><section className="metricGrid">{cards.map(([label, value]) => <article className="card metric" key={label}><b>{value ?? '0'}</b><span>{label}</span></article>)}</section><section className="workspace"><article className="card"><h2>Recent Orders</h2><Table columns={['Order', 'Delivery', 'Payment', 'Total']} empty="No orders yet" rows={(data.recentOrders || []).map((o: any) => ({ id: o.id, cells: [o.id, <span className="pill" key="s">{o.delivery_status}</span>, o.payment_status, `${o.currency} ${o.total}`] }))} /></article><article className="card"><h2>Order Status</h2>{(data.orderStatusBreakdown || []).map((row: any) => <div className="bar" key={row.status}><span>{row.status}</span><b>{row.total}</b></div>)}<h2>System</h2><p>DB: {data.system?.database || 'unknown'} · Products: {data.system?.productCount ?? 0}</p></article></section></>;
}

function Customers({ data, open }: { data: any; open: (id: string) => void }) {
  return <section className="card"><Table columns={['Name', 'Email', 'Phone', 'Language', 'Emirate', 'Orders', 'Spent', 'Status']} empty="No customers found" onRow={open} rows={(data.items || []).map((c: any) => ({ id: c.id, cells: [c.name, c.email, c.phone, c.language, c.emirate, c.orderCount, `AED ${c.totalSpent}`, <span className="pill" key="s">{c.status}</span>] }))} /></section>;
}

function Orders({ data, open, update }: { data: any; open: (id: string) => void; update: (id: string, status: string) => void }) {
  return <section className="card"><Table columns={['Order', 'Customer', 'Date', 'Delivery', 'Payment', 'Total', 'Update']} empty="No orders yet" onRow={open} rows={(data.items || []).map((o: any) => ({ id: o.id, cells: [o.id, o.customerName || o.customerEmail || 'Guest', new Date(o.createdAt).toLocaleDateString(), <span className="pill" key="s">{o.deliveryStatus}</span>, o.paymentStatus, `${o.currency} ${o.total}`, <select key="u" value={o.deliveryStatus} onClick={(event) => event.stopPropagation()} onChange={(event) => update(o.id, event.target.value)}><option>new</option><option>processing</option><option>ready</option><option>shipped</option><option>delivered</option><option>cancelled</option></select>] }))} /></section>;
}

function Offers({ data, save, confirmDelete }: { data: any; save: (path: string, form: HTMLFormElement, method?: string) => void; confirmDelete: (id: string) => void }) {
  return <section className="workspace"><article className="card"><Table columns={['Title', 'Arabic', 'Status', 'Discount', 'Dates', '']} empty="No active offers" rows={(data.items || []).map((o: any) => ({ id: o.id, cells: [o.title_en, o.title_ar, <span className="pill" key="s">{o.status}</span>, o.discount || `${o.discount_type || ''} ${o.discount_value || ''}`, `${o.starts_at || ''} ${o.ends_at || ''}`, <button className="linkBtn" key="d" onClick={() => confirmDelete(o.id)}>Delete</button>] }))} /></article><FormCard title="Offer Manager" action={(form) => save('/api/admin/offers', form)} fields="offer" /></section>;
}

function HomeContent({ data, save, confirmDelete, preview }: { data: any; save: (path: string, form: HTMLFormElement, method?: string) => void; confirmDelete: (id: string) => void; preview: { title: string; body: string } }) {
  return <section className="workspace"><article className="card"><Table columns={['Kind', 'Title', 'Visible', 'Order', '']} empty="No home content created" rows={(data.items || []).map((s: any) => ({ id: s.id, cells: [s.kind, s.title_en, String(s.visible), s.sort_order, <button className="linkBtn" key="d" onClick={() => confirmDelete(s.id)}>Delete</button>] }))} /></article><div className="stack"><FormCard title="Home Content Manager" action={(form) => save('/api/admin/home-content', form)} fields="home" /><Preview preview={preview} /></div></section>;
}

function Push({ data, save }: { data: any; save: (path: string, form: HTMLFormElement, method?: string) => void }) {
  return <section className="workspace"><article className="card"><Table columns={['Title', 'Audience', 'Status', 'Scheduled']} empty="No notification campaigns yet" rows={(data.items || []).map((p: any) => ({ id: p.id, cells: [p.title_en, p.target, <span className="pill" key="s">{p.status}</span>, p.scheduled_at || 'Send now'] }))} /></article><FormCard title="Push Composer" action={(form) => save('/api/admin/push-campaigns', form)} fields="push" /></section>;
}

function NotificationHistory({ data }: { data: any }) {
  return <section className="card"><Table columns={['Campaign', 'Audience', 'Created', 'Scheduled', 'Sent', 'Status']} empty="No notification history yet" rows={(data.items || []).map((p: any) => ({ id: p.id, cells: [p.title_en, p.target, new Date(p.created_at).toLocaleString(), p.scheduled_at || '', p.sent_at || '', <span className="pill" key="s">{p.status}</span>] }))} /></section>;
}

function SettingsPage({ data, session, onPassword }: { data: any; session: Session; onPassword: (form: HTMLFormElement) => void }) {
  return <section className="workspace"><article className="card"><h2>Admin Account</h2><p>{session.user.email}</p><p>Role: {session.user.role || 'admin'}</p><form className="form" onSubmit={(event) => { event.preventDefault(); onPassword(event.currentTarget); }}><input className="input" name="currentPassword" type="password" placeholder="Current password" required /><input className="input" name="newPassword" type="password" placeholder="New password" required /><input className="input" name="confirmPassword" type="password" placeholder="Confirm password" required /><button className="btn">Change Password</button></form></article><article className="card"><h2>System Status</h2>{Object.entries(data).map(([key, value]) => <div className="bar" key={key}><span>{key}</span><b>{String(value)}</b></div>)}</article></section>;
}

function FormCard({ title, action, fields }: { title: string; action: (form: HTMLFormElement) => void; fields: 'offer' | 'home' | 'push' }) {
  return <form className="card form" onSubmit={(event) => { event.preventDefault(); action(event.currentTarget); }}><h2>{title}</h2>{fields === 'home' ? <select className="input" name="kind"><option>hero</option><option>announcement</option><option>promo</option><option>featured</option><option>new_arrivals</option><option>popular</option><option>recommended</option></select> : null}<input className="input" name="titleEn" placeholder="English title" required={fields !== 'home'} /><input className="input" name="titleAr" placeholder="Arabic title" required={fields !== 'home'} />{fields === 'push' ? <><textarea className="input" name="bodyEn" placeholder="English message" required /><textarea className="input" name="bodyAr" placeholder="Arabic message" required /><select className="input" name="target"><option value="all">All</option><option value="ar">Arabic users</option><option value="en">English users</option><option value="customers">Customers</option></select><input className="input" name="scheduledAt" placeholder="Schedule ISO date, optional" /></> : <><textarea className="input" name={fields === 'home' ? 'bodyEn' : 'descriptionEn'} placeholder="English body" /><textarea className="input" name={fields === 'home' ? 'bodyAr' : 'descriptionAr'} placeholder="Arabic body" /><input className="input" name={fields === 'home' ? 'imageUrl' : 'bannerUrl'} placeholder="Banner/media URL" /><input className="input" name="deepLink" placeholder="/catalog" />{fields === 'home' ? <><input className="input" name="sortOrder" placeholder="Priority/order" /><select className="input" name="visible"><option value="true">Visible</option><option value="false">Hidden</option></select></> : <><select className="input" name="discountType"><option value="percentage">Percentage</option><option value="fixed">Fixed</option></select><input className="input" name="discountValue" placeholder="Discount value" /><select className="input" name="status"><option>draft</option><option>active</option><option>inactive</option><option>scheduled</option></select><select className="input" name="target"><option value="all_products">All products</option><option value="category">Category</option><option value="product">Product</option></select></>}</>}<button className="btn">Save</button></form>;
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

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const pages = [
  'Dashboard',
  'Customers',
  'Orders',
  'Offers',
  'Home Content',
  'Push Notifications',
  'Notification History',
  'Settings',
] as const;

type PageName = (typeof pages)[number];

type ApiState = {
  apiUrl: string;
  token: string;
};

type Credentials = {
  email: string;
  password: string;
};

async function request<T>(
  state: ApiState,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    state.apiUrl.replace(/\/+$/, '') + path,
    {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`,
        ...(init.headers || {}),
      },
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Session expired. Please sign in again.');
    }

    if (response.status === 403) {
      throw new Error('Admin access required.');
    }

    throw new Error(`Request failed ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<string | number | null | undefined>>;
}) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>

      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{cell ?? ''}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminControlCenter() {
  const [active, setActive] = useState<PageName>('Dashboard');

  const [state, setState] = useState<ApiState>({
    apiUrl: 'https://mig-farm-api.onrender.com',
    token: '',
  });

  const [credentials, setCredentials] = useState<Credentials>({
    email: 'admin@migfarm.ae',
    password: '',
  });

  const [status, setStatus] = useState('');
  const [data, setData] = useState<Record<string, any>>({});

  const [preview, setPreview] = useState({
    title: 'MIG FARM',
    body: 'Create content to preview it here.',
  });

  useEffect(() => {
    setState({
      apiUrl:
        localStorage.getItem('migAdminApi') ||
        'https://mig-farm-api.onrender.com',
      token: sessionStorage.getItem('migAdminToken') || '',
    });
  }, []);

  const load = async (page = active) => {
    if (!state.token) return;

    setStatus('Loading...');

    try {
      const map: Record<PageName, string> = {
        Dashboard: '/api/admin/summary',
        Customers: '/api/admin/customers',
        Orders: '/api/admin/orders',
        Offers: '/api/admin/offers',
        'Home Content': '/api/admin/home-content',
        'Push Notifications': '/api/admin/push-campaigns',
        'Notification History': '/api/admin/push-campaigns',
        Settings: '/api/admin/summary',
      };

      const next = await request(state, map[page]);

      setData((current) => ({
        ...current,
        [page]: next,
      }));

      setStatus('');
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Unable to load data',
      );
    }
  };

  useEffect(() => {
    void load(active);
  }, [active, state.token]);

  const metrics = useMemo(() => {
    const summary = data.Dashboard || {};

    return [
      ['Customers', summary.customers],
      ['Orders', summary.orders],
      [
        'Revenue',
        summary.revenue == null
          ? ''
          : `AED ${summary.revenue}`,
      ],
      ['Active offers', summary.activeOffers],
      ['Notifications', summary.notifications],
    ];
  }, [data.Dashboard]);

  const login = async () => {
    if (!credentials.email || !credentials.password) {
      setStatus('Enter your email and password.');
      return;
    }

    setStatus('Signing in...');

    try {
      const apiUrl = state.apiUrl.replace(/\/+$/, '');

      const response = await fetch(
        apiUrl + '/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: credentials.email.trim(),
            password: credentials.password,
          }),
        },
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid email or password.');
        }

        throw new Error(
          `Login failed (${response.status})`,
        );
      }

      const payload = (await response.json()) as {
        accessToken?: string;
      };

      if (!payload.accessToken) {
        throw new Error('Login failed.');
      }

      const nextState: ApiState = {
        apiUrl,
        token: payload.accessToken,
      };

      // Important:
      // This verifies that the logged-in account
      // actually has admin permission.
      await request(
        nextState,
        '/api/admin/summary',
      );

      localStorage.setItem(
        'migAdminApi',
        apiUrl,
      );

      sessionStorage.setItem(
        'migAdminToken',
        payload.accessToken,
      );

      setState(nextState);

      setCredentials((current) => ({
        ...current,
        password: '',
      }));

      setStatus('');
    } catch (error) {
      sessionStorage.removeItem('migAdminToken');

      setState((current) => ({
        ...current,
        token: '',
      }));

      setStatus(
        error instanceof Error
          ? error.message
          : 'Unable to sign in.',
      );
    }
  };

  const logout = () => {
    sessionStorage.removeItem('migAdminToken');

    setState((current) => ({
      ...current,
      token: '',
    }));

    setData({});
    setStatus('');
  };

  const submit = async (
    path: string,
    form: HTMLFormElement,
  ) => {
    const body = Object.fromEntries(
      new FormData(form).entries(),
    );

    setPreview({
      title: String(
        body.titleEn ||
          body.titleAr ||
          'MIG FARM',
      ),
      body: String(
        body.bodyEn ||
          body.descriptionEn ||
          body.deepLink ||
          '',
      ),
    });

    try {
      setStatus('Saving...');

      await request(state, path, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      form.reset();

      await load(active);

      setStatus('');
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Unable to save.',
      );
    }
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">M</div>

          <div>
            MIG FARM
            <br />
            <small>Admin Control Center</small>
          </div>
        </div>

        <nav className="nav">
          {pages.map((page) => (
            <Link
              key={page}
              href="#"
              className={
                active === page ? 'active' : ''
              }
              onClick={(event) => {
                event.preventDefault();

                if (!state.token) {
                  setStatus(
                    'Sign in to access the control center.',
                  );
                  return;
                }

                setActive(page);
              }}
            >
              {page}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>{active}</h1>

            <p>
              Production control center for MIG FARM.
              Admin access is protected by the MIG FARM API.
            </p>
          </div>

          {state.token ? (
            <div className="connect">
              <button
                className="btn secondary"
                onClick={logout}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>

        <div className="status">
          {status}
        </div>

        {!state.token ? (
          <div
            className="card"
            style={{
              maxWidth: 520,
              margin: '60px auto',
            }}
          >
            <div
              style={{
                marginBottom: 22,
              }}
            >
              <span className="pill">
                MIG FARM
              </span>

              <h2
                style={{
                  marginTop: 14,
                  fontSize: 24,
                }}
              >
                Admin Sign In
              </h2>

              <p>
                Sign in with an authorized MIG FARM
                administrator account.
              </p>
            </div>

            <div className="form">
              <input
                className="input"
                type="email"
                autoComplete="username"
                placeholder="Admin email"
                value={credentials.email}
                onChange={(event) =>
                  setCredentials({
                    ...credentials,
                    email: event.target.value,
                  })
                }
              />

              <input
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={credentials.password}
                onChange={(event) =>
                  setCredentials({
                    ...credentials,
                    password: event.target.value,
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void login();
                  }
                }}
              />

              <button
                className="btn"
                onClick={() => {
                  void login();
                }}
              >
                Sign In
              </button>
            </div>
          </div>
        ) : (
          <>
            {active === 'Dashboard' ? (
              <>
                <div className="grid">
                  {metrics.map(
                    ([label, value]) => (
                      <div
                        className="card metric"
                        key={label}
                      >
                        <b>{value ?? ''}</b>
                        <span>{label}</span>
                      </div>
                    ),
                  )}
                </div>

                <div
                  className="workspace"
                  style={{
                    marginTop: 16,
                  }}
                >
                  <div className="card">
                    <h2>Recent Orders</h2>

                    <DataTable
                      columns={[
                        'Order',
                        'Status',
                        'Total',
                      ]}
                      rows={(
                        data.Dashboard
                          ?.recentOrders || []
                      ).map((o: any) => [
                        o.id,
                        o.status,
                        `${o.currency} ${o.total}`,
                      ])}
                    />
                  </div>

                  <Preview
                    preview={preview}
                  />
                </div>
              </>
            ) : null}

            {active === 'Customers' ? (
              <div className="card">
                <DataTable
                  columns={[
                    'Name',
                    'Email',
                    'Phone',
                    'Language',
                    'Status',
                  ]}
                  rows={(
                    data.Customers?.items || []
                  ).map((c: any) => [
                    c.name,
                    c.email,
                    c.phone,
                    c.language,
                    c.status,
                  ])}
                />
              </div>
            ) : null}

            {active === 'Orders' ? (
              <div className="card">
                <DataTable
                  columns={[
                    'Order',
                    'Customer',
                    'Status',
                    'Payment',
                    'Total',
                  ]}
                  rows={(
                    data.Orders?.items || []
                  ).map((o: any) => [
                    o.id,
                    o.customerId || 'Guest',
                    o.status,
                    o.paymentStatus,
                    `${o.currency} ${o.total}`,
                  ])}
                />
              </div>
            ) : null}

            {active === 'Offers' ? (
              <Editor
                title="Offer Manager"
                table={
                  <DataTable
                    columns={[
                      'Title',
                      'Status',
                      'Discount',
                    ]}
                    rows={(
                      data.Offers?.items || []
                    ).map((o: any) => [
                      o.title_en,
                      o.status,
                      o.discount,
                    ])}
                  />
                }
                onSubmit={(form) => {
                  void submit(
                    '/api/admin/offers',
                    form,
                  );
                }}
              />
            ) : null}

            {active === 'Home Content' ? (
              <Editor
                title="Home Content Manager"
                home
                table={
                  <DataTable
                    columns={[
                      'Kind',
                      'Title',
                      'Visible',
                    ]}
                    rows={(
                      data['Home Content']
                        ?.items || []
                    ).map((s: any) => [
                      s.kind,
                      s.title_en,
                      String(s.visible),
                    ])}
                  />
                }
                onSubmit={(form) => {
                  void submit(
                    '/api/admin/home-content',
                    form,
                  );
                }}
              />
            ) : null}

            {active ===
            'Push Notifications' ? (
              <PushEditor
                table={
                  <DataTable
                    columns={[
                      'Title',
                      'Target',
                      'Status',
                    ]}
                    rows={(
                      data[
                        'Push Notifications'
                      ]?.items || []
                    ).map((p: any) => [
                      p.title_en,
                      p.target,
                      p.status,
                    ])}
                  />
                }
                onSubmit={(form) => {
                  void submit(
                    '/api/admin/push-campaigns',
                    form,
                  );
                }}
              />
            ) : null}

            {active ===
            'Notification History' ? (
              <div className="card">
                <DataTable
                  columns={[
                    'Title',
                    'Target',
                    'Status',
                    'Sent',
                  ]}
                  rows={(
                    data[
                      'Notification History'
                    ]?.items || []
                  ).map((p: any) => [
                    p.title_en,
                    p.target,
                    p.status,
                    p.sent_at || '',
                  ])}
                />
              </div>
            ) : null}

            {active === 'Settings' ? (
              <div className="card">
                <h2>
                  Production Safety
                </h2>

                <p>
                  The database URL, Stripe
                  secrets and administrator
                  credentials are never stored
                  inside this dashboard.
                </p>

                <p>
                  The administrator session is
                  authenticated through the MIG
                  FARM production API.
                </p>

                <button
                  className="btn secondary"
                  onClick={logout}
                >
                  Sign out of admin
                </button>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function Preview({
  preview,
}: {
  preview: {
    title: string;
    body: string;
  };
}) {
  return (
    <div className="card">
      <h2>Live Mobile Preview</h2>

      <div className="phone">
        <div className="phoneHero">
          <span className="pill">
            MIG FARM
          </span>

          <h3>{preview.title}</h3>

          <p>{preview.body}</p>
        </div>
      </div>
    </div>
  );
}

function Editor({
  title,
  table,
  onSubmit,
  home = false,
}: {
  title: string;
  table: React.ReactNode;
  home?: boolean;
  onSubmit: (
    form: HTMLFormElement,
  ) => void;
}) {
  return (
    <div className="workspace">
      <div className="card">
        {table}
      </div>

      <form
        className="card form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(event.currentTarget);
        }}
      >
        <h2>{title}</h2>

        {home ? (
          <select
            className="select"
            name="kind"
          >
            <option value="hero">
              hero
            </option>

            <option value="announcement">
              announcement
            </option>

            <option value="promo">
              promo
            </option>

            <option value="featured">
              featured
            </option>

            <option value="new_arrivals">
              new_arrivals
            </option>

            <option value="popular">
              popular
            </option>

            <option value="recommended">
              recommended
            </option>
          </select>
        ) : null}

        <input
          className="input"
          name="titleEn"
          placeholder="English title"
          required={!home}
        />

        <input
          className="input"
          name="titleAr"
          placeholder="Arabic title"
          required={!home}
        />

        <textarea
          className="textarea"
          name={
            home
              ? 'bodyEn'
              : 'descriptionEn'
          }
          placeholder="English body"
        />

        <textarea
          className="textarea"
          name={
            home
              ? 'bodyAr'
              : 'descriptionAr'
          }
          placeholder="Arabic body"
        />

        <input
          className="input"
          name="deepLink"
          placeholder="/catalog"
        />

        {!home ? (
          <select
            className="select"
            name="status"
          >
            <option value="draft">
              draft
            </option>

            <option value="active">
              active
            </option>

            <option value="inactive">
              inactive
            </option>

            <option value="scheduled">
              scheduled
            </option>
          </select>
        ) : null}

        <button className="btn">
          Save
        </button>
      </form>
    </div>
  );
}

function PushEditor({
  table,
  onSubmit,
}: {
  table: React.ReactNode;
  onSubmit: (
    form: HTMLFormElement,
  ) => void;
}) {
  return (
    <div className="workspace">
      <div className="card">
        {table}
      </div>

      <form
        className="card form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(event.currentTarget);
        }}
      >
        <h2>Push Composer</h2>

        <input
          className="input"
          name="titleEn"
          placeholder="English title"
          required
        />

        <input
          className="input"
          name="titleAr"
          placeholder="Arabic title"
          required
        />

        <textarea
          className="textarea"
          name="bodyEn"
          placeholder="English message"
          required
        />

        <textarea
          className="textarea"
          name="bodyAr"
          placeholder="Arabic message"
          required
        />

        <select
          className="select"
          name="target"
        >
          <option value="all">
            all
          </option>

          <option value="ar">
            ar
          </option>

          <option value="en">
            en
          </option>

          <option value="customers">
            customers
          </option>
        </select>

        <input
          className="input"
          name="deepLink"
          placeholder="/notifications"
        />

        <input
          className="input"
          name="scheduledAt"
          placeholder="2026-09-09T16:00:00Z"
        />

        <button className="btn">
          Queue
        </button>
      </form>
    </div>
  );
}
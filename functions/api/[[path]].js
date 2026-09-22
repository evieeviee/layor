const SESSION_COOKIE = 'layor_session';
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 210000;
const BUNDLE_SAVINGS = { 2: 400, 4: 800, 6: 1500 };

export async function onRequest(context) {
  const { request, env, params } = context;

  try {
    const method = request.method.toUpperCase();

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    const parts = Array.isArray(params.path)
      ? params.path
      : (params.path ? [params.path] : []);

    if (parts[0] === 'health') {
      return json({ ok: true });
    }

    if (parts[0] === 'catalog' && method === 'GET') {
      return getCatalog(env);
    }

    if (parts[0] === 'payment' && method === 'GET') {
      return getPaymentSettings(env);
    }

    if (parts[0] === 'media' && parts[1] && method === 'GET') {
      return getPublicMedia(
        env,
        decodeURIComponent(parts.slice(1).join('/'))
      );
    }

    if (parts[0] === 'auth') {
      if (parts[1] === 'register' && method === 'POST') {
        return register(request, env);
      }

      if (parts[1] === 'login' && method === 'POST') {
        return login(request, env);
      }

      if (parts[1] === 'logout' && method === 'POST') {
        return logout(request, env);
      }

      if (parts[1] === 'me' && method === 'GET') {
        return me(request, env);
      }
    }

    if (parts[0] === 'customer') {
      const user = await requireUser(request, env);

      if (parts[1] === 'vouchers' && method === 'GET') {
        return customerVouchers(env, user.id);
      }

      if (parts[1] === 'orders' && method === 'GET') {
        return customerOrders(env, user.id);
      }
    }

    if (parts[0] === 'orders' && method === 'POST') {
      return createOrder(request, env);
    }

    if (parts[0] === 'admin') {
      const admin = await requireAdmin(request, env);

      if (parts[1] === 'me' && method === 'GET') {
        return json({ user: publicUser(admin) });
      }

      if (parts[1] === 'dashboard' && method === 'GET') {
        return adminDashboard(env);
      }

      if (parts[1] === 'categories') {
        if (method === 'GET') {
          return adminCategories(env);
        }

        if (method === 'POST') {
          return adminCreateCategory(request, env);
        }

        if (parts[2] && method === 'PUT') {
          return adminUpdateCategory(request, env, parts[2]);
        }
      }

      if (parts[1] === 'products') {
        if (method === 'GET') {
          return adminProducts(env);
        }

        if (method === 'POST') {
          return adminCreateProduct(request, env);
        }

        if (parts[2] && method === 'PUT') {
          return adminUpdateProduct(request, env, parts[2]);
        }

        if (parts[2] && method === 'DELETE') {
          return adminDeleteProduct(env, parts[2]);
        }
      }

      if (
        parts[1] === 'product-images' &&
        parts[2] &&
        method === 'DELETE'
      ) {
        return adminDeleteProductImage(env, parts[2]);
      }

      if (
        parts[1] === 'upload' &&
        parts[2] === 'product-image' &&
        method === 'POST'
      ) {
        return adminUploadProductImage(request, env);
      }

      if (
        parts[1] === 'upload' &&
        parts[2] === 'payment-qr' &&
        method === 'POST'
      ) {
        return adminUploadPaymentQr(request, env);
      }

      if (parts[1] === 'orders') {
        if (method === 'GET' && !parts[2]) {
          return adminOrders(env);
        }

        if (
          parts[2] &&
          parts[3] === 'status' &&
          method === 'PUT'
        ) {
          return adminUpdateOrderStatus(
            request,
            env,
            parts[2]
          );
        }

        if (
          parts[2] &&
          parts[3] === 'receipt' &&
          method === 'GET'
        ) {
          return adminReceipt(env, parts[2]);
        }
      }

      if (parts[1] === 'customers') {
        if (method === 'GET' && !parts[2]) {
          return adminCustomers(env);
        }

        if (
          parts[2] &&
          parts[3] === 'points' &&
          method === 'POST'
        ) {
          return adminAdjustPoints(
            request,
            env,
            parts[2]
          );
        }

        if (
          parts[2] &&
          parts[3] === 'vouchers' &&
          method === 'POST'
        ) {
          return adminAssignVoucher(
            request,
            env,
            parts[2]
          );
        }
      }

      if (parts[1] === 'vouchers') {
        if (method === 'GET' && !parts[2]) {
          return adminVouchers(env);
        }

        if (method === 'POST' && !parts[2]) {
          return adminCreateVoucher(request, env);
        }

        if (parts[2] && method === 'PUT') {
          return adminUpdateVoucher(
            request,
            env,
            parts[2]
          );
        }
      }

      if (
        parts[1] === 'settings' &&
        parts[2] === 'payment'
      ) {
        if (method === 'GET') {
          return adminGetPaymentSettings(env);
        }

        if (method === 'PUT') {
          return adminSavePaymentSettings(
            request,
            env
          );
        }
      }
    }

    return json({ error: 'Not found' }, 404);

  } catch (err) {
    console.error(err);

    if (err instanceof HttpError) {
      return json(
        { error: err.message },
        err.status
      );
    }

    return json(
      { error: 'Server error' },
      500
    );
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...headers
      }
    }
  );
}

function nowIso() {
  return new Date().toISOString();
}

function id() {
  return crypto.randomUUID();
}

function moneyCents(v) {
  const n = Number(v);

  return Number.isFinite(n)
    ? Math.max(0, Math.round(n * 100))
    : 0;
}

function boolInt(v) {
  return v ? 1 : 0;
}

function normEmail(v) {
  return String(v || '')
    .trim()
    .toLowerCase();
}

function base64url(bytes) {
  return btoa(
    String.fromCharCode(...bytes)
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(s) {
  s = s
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  while (s.length % 4) {
    s += '=';
  }

  return Uint8Array.from(
    atob(s),
    c => c.charCodeAt(0)
  );
}

async function sha256Text(text) {
  const out = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );

  return base64url(
    new Uint8Array(out)
  );
}

async function hashPassword(
  password,
  saltB64 = null
) {
  const salt = saltB64
    ? fromBase64url(saltB64)
    : crypto.getRandomValues(
        new Uint8Array(16)
      );

  const key =
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

  const bits =
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations:
          PBKDF2_ITERATIONS
      },
      key,
      256
    );

  return {
    salt: base64url(salt),
    hash: base64url(
      new Uint8Array(bits)
    )
  };
}

async function verifyPassword(
  password,
  salt,
  expected
) {
  const got =
    await hashPassword(
      password,
      salt
    );

  return timingSafeEqual(
    got.hash,
    expected
  );
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let x = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    x |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return x === 0;
}

function cookieValue(
  request,
  name
) {
  const raw =
    request.headers.get('Cookie') || '';

  const parts =
    raw
      .split(';')
      .map(x => x.trim());

  for (const p of parts) {
    const i = p.indexOf('=');

    if (
      i > 0 &&
      p.slice(0, i) === name
    ) {
      return decodeURIComponent(
        p.slice(i + 1)
      );
    }
  }

  return '';
}

function sessionCookie(
  token,
  maxAge =
    SESSION_DAYS * 86400
) {
  return (
    `${SESSION_COOKIE}=` +
    `${encodeURIComponent(token)}; ` +
    `HttpOnly; Secure; SameSite=Lax; ` +
    `Path=/; Max-Age=${maxAge}`
  );
}

function clearCookie() {
  return (
    `${SESSION_COOKIE}=; ` +
    `HttpOnly; Secure; SameSite=Lax; ` +
    `Path=/; Max-Age=0`
  );
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    full_name:
      u.full_name || '',
    role: u.role,
    points:
      Number(u.points || 0),
    created_at:
      u.created_at
  };
}

async function bodyJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(
      400,
      'Invalid JSON'
    );
  }
}

async function createSession(
  env,
  userId
) {
  const raw =
    base64url(
      crypto.getRandomValues(
        new Uint8Array(32)
      )
    );

  const tokenHash =
    await sha256Text(raw);

  const expires =
    new Date(
      Date.now() +
      SESSION_DAYS *
      86400000
    ).toISOString();

  await env.DB
    .prepare(
      `INSERT INTO sessions
       (id,user_id,token_hash,expires_at)
       VALUES(?,?,?,?)`
    )
    .bind(
      id(),
      userId,
      tokenHash,
      expires
    )
    .run();

  return raw;
}

async function currentUser(
  request,
  env
) {
  const raw =
    cookieValue(
      request,
      SESSION_COOKIE
    );

  if (!raw) {
    return null;
  }

  const tokenHash =
    await sha256Text(raw);

  const row =
    await env.DB
      .prepare(
        `SELECT u.*
         FROM sessions s
         JOIN users u
           ON u.id=s.user_id
         WHERE s.token_hash=?
         AND s.expires_at>?`
      )
      .bind(
        tokenHash,
        nowIso()
      )
      .first();

  return row || null;
}

async function requireUser(
  request,
  env
) {
  const u =
    await currentUser(
      request,
      env
    );

  if (!u) {
    throw new HttpError(
      401,
      'Please login'
    );
  }

  return u;
}

async function requireAdmin(
  request,
  env
) {
  const u =
    await requireUser(
      request,
      env
    );

  if (u.role !== 'admin') {
    throw new HttpError(
      403,
      'Admin access required'
    );
  }

  return u;
}

async function register(
  request,
  env
) {
  const b =
    await bodyJson(request);

  const email =
    normEmail(b.email);

  const password =
    String(b.password || '');

  const fullName =
    String(
      b.full_name || ''
    ).trim();

  if (
    !/^\S+@\S+\.\S+$/.test(
      email
    )
  ) {
    throw new HttpError(
      400,
      'Enter a valid email'
    );
  }

  if (password.length < 8) {
    throw new HttpError(
      400,
      'Password must be at least 8 characters'
    );
  }

  const exists =
    await env.DB
      .prepare(
        'SELECT id FROM users WHERE email=?'
      )
      .bind(email)
      .first();

  if (exists) {
    throw new HttpError(
      409,
      'This email is already registered'
    );
  }

  const hp =
    await hashPassword(
      password
    );

  const userId = id();
  const createdAt =
    nowIso();

  await env.DB
    .prepare(
      `INSERT INTO users
       (
         id,
         email,
         password_hash,
         password_salt,
         full_name,
         role,
         points,
         created_at
       )
       VALUES(
         ?,?,?,?,?,?,0,?
       )`
    )
    .bind(
      userId,
      email,
      hp.hash,
      hp.salt,
      fullName ||
        email.split('@')[0],
      'customer',
      createdAt
    )
    .run();

  await assignNewUserVouchers(
    env,
    userId
  );

  const rawSession =
    await createSession(
      env,
      userId
    );

  const user =
    await env.DB
      .prepare(
        'SELECT * FROM users WHERE id=?'
      )
      .bind(userId)
      .first();

  return json(
    {
      user:
        publicUser(user)
    },
    201,
    {
      'Set-Cookie':
        sessionCookie(
          rawSession
        )
    }
  );
}

async function login(
  request,
  env
) {
  const b =
    await bodyJson(request);

  const email =
    normEmail(b.email);

  const password =
    String(
      b.password || ''
    );

  const user =
    await env.DB
      .prepare(
        'SELECT * FROM users WHERE email=?'
      )
      .bind(email)
      .first();

  if (
    !user ||
    !(
      await verifyPassword(
        password,
        user.password_salt,
        user.password_hash
      )
    )
  ) {
    throw new HttpError(
      401,
      'Invalid email or password'
    );
  }

  const rawSession =
    await createSession(
      env,
      user.id
    );

  return json(
    {
      user:
        publicUser(user)
    },
    200,
    {
      'Set-Cookie':
        sessionCookie(
          rawSession
        )
    }
  );
}

async function logout(
  request,
  env
) {
  const raw =
    cookieValue(
      request,
      SESSION_COOKIE
    );

  if (raw) {
    await env.DB
      .prepare(
        `DELETE FROM sessions
         WHERE token_hash=?`
      )
      .bind(
        await sha256Text(raw)
      )
      .run();
  }

  return json(
    { ok: true },
    200,
    {
      'Set-Cookie':
        clearCookie()
    }
  );
}

async function me(
  request,
  env
) {
  const user =
    await requireUser(
      request,
      env
    );

  return json({
    user:
      publicUser(user)
  });
}


async function assignNewUserVouchers(env, userId) {
  const rows = (
    await env.DB
      .prepare(
        `SELECT *
         FROM vouchers
         WHERE active=1
         AND auto_assign_new_user=1`
      )
      .all()
  ).results || [];

  for (const v of rows) {
    const days =
      Math.max(
        1,
        Number(v.valid_days || 14)
      );

    const expires =
      new Date(
        Date.now() +
        days * 86400000
      ).toISOString();

    await env.DB
      .prepare(
        `INSERT OR IGNORE INTO customer_vouchers
         (
           id,
           user_id,
           voucher_id,
           assigned_at,
           expires_at,
           used_count
         )
         VALUES(?,?,?,?,?,0)`
      )
      .bind(
        id(),
        userId,
        v.id,
        nowIso(),
        expires
      )
      .run();
  }
}

async function getCatalog(env) {
  const categories = (
    await env.DB
      .prepare(
        `SELECT *
         FROM categories
         WHERE active=1
         ORDER BY sort_order ASC,
                  name ASC`
      )
      .all()
  ).results || [];

  const products = (
    await env.DB
      .prepare(
        `SELECT
           p.*,
           c.name AS category_name
         FROM products p
         LEFT JOIN categories c
           ON c.id=p.category_id
         WHERE p.active=1
         ORDER BY p.created_at DESC`
      )
      .all()
  ).results || [];

  const images = (
    await env.DB
      .prepare(
        `SELECT *
         FROM product_images
         ORDER BY sort_order ASC`
      )
      .all()
  ).results || [];

  const grouped = {};

  for (const image of images) {
    if (!grouped[image.product_id]) {
      grouped[image.product_id] = [];
    }

    grouped[image.product_id].push(
      `/api/media/${encodeURIComponent(
        image.object_key
      )}`
    );
  }

  return json({
    categories,
    products:
      products.map(p => ({
        ...p,
        price:
          Number(
            p.price_cents || 0
          ) / 100,
        active:
          !!p.active,
        featured:
          !!p.featured,
        mix_eligible:
          !!p.mix_eligible,
        images:
          grouped[p.id] || []
      }))
  });
}

async function getPublicMedia(
  env,
  key
) {
  const object =
    await env.MEDIA.get(key);

  if (!object) {
    throw new HttpError(
      404,
      'File not found'
    );
  }

  const headers =
    new Headers();

  object.writeHttpMetadata(
    headers
  );

  headers.set(
    'Cache-Control',
    'public, max-age=86400'
  );

  return new Response(
    object.body,
    { headers }
  );
}

async function getPaymentSettings(env) {
  const settings =
    await settingMap(
      env,
      [
        'bank_name',
        'account_name',
        'account_number',
        'payment_qr_key',
        'points_enabled',
        'points_per_rm'
      ]
    );

  return json({
    bank_name:
      settings.bank_name || '',
    account_name:
      settings.account_name || '',
    account_number:
      settings.account_number || '',
    qr_url:
      settings.payment_qr_key
        ? `/api/media/${encodeURIComponent(
            settings.payment_qr_key
          )}`
        : '',
    points_enabled:
      settings.points_enabled !== '0',
    points_per_rm:
      Number(
        settings.points_per_rm || 1
      )
  });
}

async function customerVouchers(
  env,
  userId
) {
  const rows = (
    await env.DB
      .prepare(
        `SELECT
           cv.id AS customer_voucher_id,
           cv.assigned_at,
           cv.expires_at,
           cv.used_count,
           v.*
         FROM customer_vouchers cv
         JOIN vouchers v
           ON v.id=cv.voucher_id
         WHERE cv.user_id=?
         AND v.active=1
         AND (
           cv.expires_at IS NULL
           OR cv.expires_at>?
         )
         ORDER BY cv.assigned_at DESC`
      )
      .bind(
        userId,
        nowIso()
      )
      .all()
  ).results || [];

  return json({
    vouchers:
      rows.map(v => ({
        ...v,
        min_spend:
          Number(
            v.min_spend_cents || 0
          ) / 100,
        active:
          !!v.active,
        new_user_only:
          !!v.new_user_only,
        auto_assign_new_user:
          !!v.auto_assign_new_user
      }))
  });
}

function orderOut(o) {
  return {
    ...o,
    subtotal:
      Number(
        o.subtotal_cents || 0
      ) / 100,
    discount:
      Number(
        o.discount_cents || 0
      ) / 100,
    total:
      Number(
        o.total_cents || 0
      ) / 100,
    status:
      o.order_status
  };
}

async function customerOrders(
  env,
  userId
) {
  const rows = (
    await env.DB
      .prepare(
        `SELECT *
         FROM orders
         WHERE user_id=?
         ORDER BY created_at DESC`
      )
      .bind(userId)
      .all()
  ).results || [];

  return json({
    orders:
      rows.map(orderOut)
  });
}

async function createOrder(
  request,
  env
) {
  const b =
    await bodyJson(request);

  const user =
    await currentUser(
      request,
      env
    );

  const customerName =
    String(
      b.customer_name || ''
    ).trim();

  const customerEmail =
    normEmail(
      b.customer_email || ''
    );

  const customerPhone =
    String(
      b.customer_phone || ''
    ).trim();

  const pickupDate =
    String(
      b.pickup_date || ''
    ).trim();

  const pickupTime =
    String(
      b.pickup_time || ''
    ).trim();

  if (
    !customerName ||
    !customerPhone ||
    !pickupDate ||
    !pickupTime
  ) {
    throw new HttpError(
      400,
      'Complete your customer and pickup details'
    );
  }

  if (
    !Array.isArray(b.items) ||
    !b.items.length
  ) {
    throw new HttpError(
      400,
      'Your cart is empty'
    );
  }

  let subtotalCents = 0;
  const orderItems = [];

  for (const item of b.items) {
    if (item.bundle) {
      const bundlePrice =
        moneyCents(item.price);

      subtotalCents +=
        bundlePrice;

      orderItems.push({
        product_id: null,
        product_title:
          String(
            item.name ||
            'Mix & Match Bundle'
          ),
        quantity: 1,
        unit_price_cents:
          bundlePrice,
        line_total_cents:
          bundlePrice
      });

      continue;
    }

    const qty =
      Math.max(
        1,
        Math.trunc(
          Number(item.qty || 1)
        )
      );

    const product =
      await env.DB
        .prepare(
          `SELECT *
           FROM products
           WHERE id=?
           AND active=1`
        )
        .bind(
          String(item.id || '')
        )
        .first();

    if (!product) {
      throw new HttpError(
        400,
        'A product in your cart is no longer available'
      );
    }

    const line =
      Number(
        product.price_cents
      ) * qty;

    subtotalCents += line;

    orderItems.push({
      product_id:
        product.id,
      product_title:
        product.title,
      quantity:
        qty,
      unit_price_cents:
        Number(
          product.price_cents
        ),
      line_total_cents:
        line
    });
  }

  let voucherId = null;
  let discountCents = 0;
  let customerVoucher = null;

  if (b.voucher_id) {
    if (!user) {
      throw new HttpError(
        401,
        'Login is required to use account vouchers'
      );
    }

    customerVoucher =
      await env.DB
        .prepare(
          `SELECT
             cv.*,
             v.code,
             v.discount_type,
             v.value,
             v.min_spend_cents,
             v.active,
             v.usage_limit_per_customer
           FROM customer_vouchers cv
           JOIN vouchers v
             ON v.id=cv.voucher_id
           WHERE cv.user_id=?
           AND v.id=?`
        )
        .bind(
          user.id,
          String(b.voucher_id)
        )
        .first();

    if (
      !customerVoucher ||
      !customerVoucher.active
    ) {
      throw new HttpError(
        400,
        'Voucher is not available'
      );
    }

    if (
      customerVoucher.expires_at &&
      customerVoucher.expires_at <
        nowIso()
    ) {
      throw new HttpError(
        400,
        'Voucher has expired'
      );
    }

    if (
      Number(
        customerVoucher.used_count || 0
      ) >=
      Number(
        customerVoucher
          .usage_limit_per_customer || 1
      )
    ) {
      throw new HttpError(
        400,
        'Voucher has already been used'
      );
    }

    if (
      subtotalCents <
      Number(
        customerVoucher
          .min_spend_cents || 0
      )
    ) {
      throw new HttpError(
        400,
        'Minimum spend has not been reached'
      );
    }

    voucherId =
      customerVoucher.voucher_id;

    if (
      customerVoucher
        .discount_type === 'percent'
    ) {
      discountCents =
        Math.round(
          subtotalCents *
          Number(
            customerVoucher.value || 0
          ) /
          100
        );
    } else {
      discountCents =
        Math.round(
          Number(
            customerVoucher.value || 0
          ) * 100
        );
    }

    discountCents =
      Math.min(
        subtotalCents,
        Math.max(
          0,
          discountCents
        )
      );
  }

  const totalCents =
    Math.max(
      0,
      subtotalCents -
      discountCents
    );

  const orderId = id();

  const orderNo =
    'LY' +
    Date.now()
      .toString()
      .slice(-8);

  const created =
    nowIso();

  const statements = [];

  statements.push(
    env.DB
      .prepare(
        `INSERT INTO orders
        (
          id,
          order_no,
          user_id,
          customer_name,
          customer_email,
          customer_phone,
          pickup_date,
          pickup_time,
          note,
          subtotal_cents,
          discount_cents,
          total_cents,
          voucher_id,
          payment_method,
          payment_status,
          order_status,
          receipt_key,
          points_awarded,
          created_at,
          updated_at
        )
        VALUES
        (
          ?,?,?,?,?,?,?,?,?,?,
          ?,?,?,?,?,?,?,0,?,?
        )`
      )
      .bind(
        orderId,
        orderNo,
        user ? user.id : null,
        customerName,
        customerEmail || null,
        customerPhone,
        pickupDate,
        pickupTime,
        String(
          b.note || ''
        ).trim() || null,
        subtotalCents,
        discountCents,
        totalCents,
        voucherId,
        'manual',
        'checking',
        'new',
        b.receipt_key || null,
        created,
        created
      )
  );

  for (const item of orderItems) {
    statements.push(
      env.DB
        .prepare(
          `INSERT INTO order_items
          (
            id,
            order_id,
            product_id,
            product_title,
            quantity,
            unit_price_cents,
            line_total_cents
          )
          VALUES(?,?,?,?,?,?,?)`
        )
        .bind(
          id(),
          orderId,
          item.product_id,
          item.product_title,
          item.quantity,
          item.unit_price_cents,
          item.line_total_cents
        )
    );
  }

  if (customerVoucher) {
    statements.push(
      env.DB
        .prepare(
          `UPDATE customer_vouchers
           SET
             used_count =
               used_count + 1,
             used_at=?,
             order_id=?
           WHERE id=?`
        )
        .bind(
          created,
          orderId,
          customerVoucher.id
        )
    );
  }

  await env.DB.batch(
    statements
  );

  return json(
    {
      ok: true,
      order_no: orderNo,
      total:
        totalCents / 100
    },
    201
  );
}

async function adminDashboard(env) {
  const products =
    await env.DB
      .prepare(
        'SELECT COUNT(*) n FROM products'
      )
      .first();

  const orders =
    await env.DB
      .prepare(
        'SELECT COUNT(*) n FROM orders'
      )
      .first();

  const customers =
    await env.DB
      .prepare(
        `SELECT COUNT(*) n
         FROM users
         WHERE role='customer'`
      )
      .first();

  const vouchers =
    await env.DB
      .prepare(
        'SELECT COUNT(*) n FROM vouchers'
      )
      .first();

  return json({
    products:
      Number(products.n || 0),
    orders:
      Number(orders.n || 0),
    customers:
      Number(customers.n || 0),
    vouchers:
      Number(vouchers.n || 0)
  });
}

async function adminCategories(env) {
  const rows = (
    await env.DB
      .prepare(
        `SELECT *
         FROM categories
         ORDER BY sort_order ASC,
                  name ASC`
      )
      .all()
  ).results || [];

  return json({
    categories: rows
  });
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function adminCreateCategory(
  request,
  env
) {
  const b =
    await bodyJson(request);

  const name =
    String(
      b.name || ''
    ).trim();

  if (!name) {
    throw new HttpError(
      400,
      'Category name required'
    );
  }

  const categoryId = id();

  await env.DB
    .prepare(
      `INSERT INTO categories
       (
         id,
         name,
         slug,
         active,
         sort_order,
         created_at,
         updated_at
       )
       VALUES(?,?,?,?,?,?,?)`
    )
    .bind(
      categoryId,
      name,
      slugify(name) +
        '-' +
        categoryId.slice(0, 6),
      1,
      Number(
        b.sort_order || 0
      ),
      nowIso(),
      nowIso()
    )
    .run();

  return json(
    {
      category: {
        id: categoryId
      }
    },
    201
  );
}

async function adminUpdateCategory(
  request,
  env,
  categoryId
) {
  const b =
    await bodyJson(request);

  const name =
    String(
      b.name || ''
    ).trim();

  if (!name) {
    throw new HttpError(
      400,
      'Category name required'
    );
  }

  await env.DB
    .prepare(
      `UPDATE categories
       SET
         name=?,
         active=?,
         sort_order=?,
         updated_at=?
       WHERE id=?`
    )
    .bind(
      name,
      boolInt(
        b.active !== false
      ),
      Number(
        b.sort_order || 0
      ),
      nowIso(),
      categoryId
    )
    .run();

  return json({
    ok: true
  });
}

function safeName(name) {
  return String(
    name || 'image'
  )
    .replace(
      /[^a-zA-Z0-9._-]/g,
      '-'
    )
    .slice(0, 100);
}

async function adminProducts(env) {
  const rows = (
    await env.DB
      .prepare(
        `SELECT
           p.*,
           c.name AS category_name
         FROM products p
         LEFT JOIN categories c
           ON c.id=p.category_id
         ORDER BY p.created_at DESC`
      )
      .all()
  ).results || [];

  const imgs = (
    await env.DB
      .prepare(
        `SELECT *
         FROM product_images
         ORDER BY sort_order ASC`
      )
      .all()
  ).results || [];

  return json({
    products:
      rows.map(p => ({
        ...p,
        price:
          Number(
            p.price_cents
          ) / 100,
        active:
          !!p.active,
        featured:
          !!p.featured,
        mix_eligible:
          !!p.mix_eligible,
        images:
          imgs
            .filter(
              i =>
                i.product_id ===
                p.id
            )
            .map(i => ({
              id: i.id,
              url:
                `/api/media/${encodeURIComponent(
                  i.object_key
                )}`
            }))
      }))
  });
}

async function adminCreateProduct(
  request,
  env
) {
  const b =
    await bodyJson(request);

  if (
    !String(
      b.title || ''
    ).trim()
  ) {
    throw new HttpError(
      400,
      'Title required'
    );
  }

  const pid = id();

  await env.DB
    .prepare(
      `INSERT INTO products
      (
        id,
        category_id,
        title,
        chinese_title,
        description,
        price_cents,
        active,
        featured,
        mix_eligible,
        created_at,
        updated_at
      )
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`
    )
    .bind(
      pid,
      b.category_id || null,
      String(b.title).trim(),
      b.chinese_title || null,
      b.description || null,
      moneyCents(b.price),
      boolInt(
        b.active !== false
      ),
      boolInt(b.featured),
      boolInt(b.mix_eligible),
      nowIso(),
      nowIso()
    )
    .run();

  return json(
    {
      product: {
        id: pid
      }
    },
    201
  );
}

async function adminUpdateProduct(
  request,
  env,
  pid
) {
  const b =
    await bodyJson(request);

  await env.DB
    .prepare(
      `UPDATE products
       SET
         category_id=?,
         title=?,
         chinese_title=?,
         description=?,
         price_cents=?,
         active=?,
         featured=?,
         mix_eligible=?,
         updated_at=?
       WHERE id=?`
    )
    .bind(
      b.category_id || null,
      String(
        b.title || ''
      ).trim(),
      b.chinese_title || null,
      b.description || null,
      moneyCents(b.price),
      boolInt(
        b.active !== false
      ),
      boolInt(b.featured),
      boolInt(b.mix_eligible),
      nowIso(),
      pid
    )
    .run();

  return json({
    ok: true
  });
}

async function adminDeleteProduct(
  env,
  pid
) {
  const imgs = (
    await env.DB
      .prepare(
        `SELECT object_key
         FROM product_images
         WHERE product_id=?`
      )
      .bind(pid)
      .all()
  ).results || [];

  for (const im of imgs) {
    await env.MEDIA.delete(
      im.object_key
    );
  }

  await env.DB
    .prepare(
      `DELETE FROM products
       WHERE id=?`
    )
    .bind(pid)
    .run();

  return json({
    ok: true
  });
}

async function adminUploadProductImage(
  request,
  env
) {
  const f =
    await request.formData();

  const file =
    f.get('file');

  const pid =
    String(
      f.get('product_id') || ''
    );

  const sort =
    Number(
      f.get('sort_order') || 0
    );

  if (!file || !pid) {
    throw new HttpError(
      400,
      'File and product required'
    );
  }

  if (
    file.size >
    6 * 1024 * 1024
  ) {
    throw new HttpError(
      400,
      'Image must be below 6MB'
    );
  }

  const count =
    await env.DB
      .prepare(
        `SELECT COUNT(*) n
         FROM product_images
         WHERE product_id=?`
      )
      .bind(pid)
      .first();

  if (
    Number(count.n) >= 3
  ) {
    throw new HttpError(
      400,
      'Maximum 3 product images'
    );
  }

  const key =
    `products/${pid}/` +
    `${id()}-` +
    safeName(
      file.name || 'image'
    );

  await env.MEDIA.put(
    key,
    await file.arrayBuffer(),
    {
      httpMetadata: {
        contentType:
          file.type ||
          'image/jpeg'
      }
    }
  );

  const iid = id();

  await env.DB
    .prepare(
      `INSERT INTO product_images
       (
         id,
         product_id,
         object_key,
         sort_order
       )
       VALUES(?,?,?,?)`
    )
    .bind(
      iid,
      pid,
      key,
      sort
    )
    .run();

  return json(
    {
      image: {
        id: iid,
        url:
          `/api/media/${encodeURIComponent(
            key
          )}`
      }
    },
    201
  );
}

async function adminDeleteProductImage(
  env,
  imageId
) {
  const im =
    await env.DB
      .prepare(
        `SELECT *
         FROM product_images
         WHERE id=?`
      )
      .bind(imageId)
      .first();

  if (im) {
    await env.MEDIA.delete(
      im.object_key
    );

    await env.DB
      .prepare(
        `DELETE FROM product_images
         WHERE id=?`
      )
      .bind(imageId)
      .run();
  }

  return json({
    ok: true
  });
}

async function adminOrders(env) {
  const rows = (
    await env.DB
      .prepare(
        `SELECT *
         FROM orders
         ORDER BY created_at DESC`
      )
      .all()
  ).results || [];

  return json({
    orders:
      rows.map(o => ({
        ...orderOut(o),
        receipt_url:
          o.receipt_key
            ? `/api/admin/orders/${o.id}/receipt`
            : ''
      }))
  });
}

async function adminUpdateOrderStatus(
  request,
  env,
  orderId
) {
  const b =
    await bodyJson(request);

  const order =
    await env.DB
      .prepare(
        `SELECT *
         FROM orders
         WHERE id=?`
      )
      .bind(orderId)
      .first();

  if (!order) {
    throw new HttpError(
      404,
      'Order not found'
    );
  }

  const pay =
    String(
      b.payment_status ||
      order.payment_status
    );

  const status =
    String(
      b.order_status ||
      order.order_status
    );

  const validP = [
    'checking',
    'paid',
    'rejected'
  ];

  const validO = [
    'new',
    'confirmed',
    'preparing',
    'ready',
    'completed',
    'cancelled'
  ];

  if (
    !validP.includes(pay) ||
    !validO.includes(status)
  ) {
    throw new HttpError(
      400,
      'Invalid status'
    );
  }

  const stmts = [
    env.DB
      .prepare(
        `UPDATE orders
         SET
           payment_status=?,
           order_status=?,
           updated_at=?
         WHERE id=?`
      )
      .bind(
        pay,
        status,
        nowIso(),
        orderId
      )
  ];

  if (
    status === 'completed' &&
    order.user_id &&
    !order.points_awarded
  ) {
    const settings =
      await settingMap(
        env,
        [
          'points_enabled',
          'points_per_rm'
        ]
      );

    if (
      settings.points_enabled !== '0'
    ) {
      const rate =
        Number(
          settings.points_per_rm || 1
        );

      const pts =
        Math.max(
          0,
          Math.floor(
            (
              Number(
                order.total_cents
              ) / 100
            ) * rate
          )
        );

      if (pts > 0) {
        stmts.push(
          env.DB
            .prepare(
              `UPDATE users
               SET points=points+?
               WHERE id=?`
            )
            .bind(
              pts,
              order.user_id
            )
        );

        stmts.push(
          env.DB
            .prepare(
              `INSERT INTO points_ledger
               (
                 id,
                 user_id,
                 order_id,
                 delta,
                 reason,
                 created_at
               )
               VALUES(?,?,?,?,?,?)`
            )
            .bind(
              id(),
              order.user_id,
              order.id,
              pts,
              `Completed order ${order.order_no}`,
              nowIso()
            )
        );
      }

      stmts.push(
        env.DB
          .prepare(
            `UPDATE orders
             SET points_awarded=1
             WHERE id=?`
          )
          .bind(order.id)
      );
    }
  }

  await env.DB.batch(
    stmts
  );

  return json({
    ok: true
  });
}

async function adminReceipt(
  env,
  orderId
) {
  const o =
    await env.DB
      .prepare(
        `SELECT receipt_key
         FROM orders
         WHERE id=?`
      )
      .bind(orderId)
      .first();

  if (
    !o ||
    !o.receipt_key
  ) {
    throw new HttpError(
      404,
      'Receipt not found'
    );
  }

  const obj =
    await env.MEDIA.get(
      o.receipt_key
    );

  if (!obj) {
    throw new HttpError(
      404,
      'Receipt not found'
    );
  }

  const h =
    new Headers();

  obj.writeHttpMetadata(h);

  h.set(
    'Cache-Control',
    'private, no-store'
  );

  return new Response(
    obj.body,
    { headers: h }
  );
}

async function adminCustomers(env) {
  const rows = (
    await env.DB
      .prepare(
        `SELECT
           id,
           email,
           full_name,
           points,
           created_at
         FROM users
         WHERE role='customer'
         ORDER BY created_at DESC`
      )
      .all()
  ).results || [];

  return json({
    customers: rows
  });
}

async function adminAdjustPoints(
  request,
  env,
  userId
) {
  const b =
    await bodyJson(request);

  const delta =
    Math.trunc(
      Number(
        b.delta || 0
      )
    );

  if (
    !Number.isFinite(delta) ||
    delta === 0
  ) {
    throw new HttpError(
      400,
      'Enter a non-zero points adjustment'
    );
  }

  const u =
    await env.DB
      .prepare(
        `SELECT points
         FROM users
         WHERE id=?`
      )
      .bind(userId)
      .first();

  if (!u) {
    throw new HttpError(
      404,
      'Customer not found'
    );
  }

  const next =
    Math.max(
      0,
      Number(u.points) +
      delta
    );

  const actual =
    next -
    Number(u.points);

  await env.DB.batch([
    env.DB
      .prepare(
        `UPDATE users
         SET points=?
         WHERE id=?`
      )
      .bind(
        next,
        userId
      ),

    env.DB
      .prepare(
        `INSERT INTO points_ledger
         (
           id,
           user_id,
           delta,
           reason,
           created_at
         )
         VALUES(?,?,?,?,?)`
      )
      .bind(
        id(),
        userId,
        actual,
        String(
          b.reason ||
          'Admin adjustment'
        ),
        nowIso()
      )
  ]);

  return json({
    points: next
  });
}

async function adminAssignVoucher(
  request,
  env,
  userId
) {
  const b =
    await bodyJson(request);

  const v =
    await env.DB
      .prepare(
        `SELECT *
         FROM vouchers
         WHERE id=?
         AND active=1`
      )
      .bind(
        String(
          b.voucher_id || ''
        )
      )
      .first();

  if (!v) {
    throw new HttpError(
      404,
      'Voucher not found'
    );
  }

  const expires =
    new Date(
      Date.now() +
      Math.max(
        1,
        Number(
          v.valid_days || 14
        )
      ) *
      86400000
    ).toISOString();

  await env.DB
    .prepare(
      `INSERT OR IGNORE INTO customer_vouchers
       (
         id,
         user_id,
         voucher_id,
         assigned_at,
         expires_at,
         used_count
       )
       VALUES(?,?,?,?,?,0)`
    )
    .bind(
      id(),
      userId,
      v.id,
      nowIso(),
      expires
    )
    .run();

  return json({
    ok: true
  });
}

async function adminVouchers(env) {
  const rows = (
    await env.DB
      .prepare(
        `SELECT *
         FROM vouchers
         ORDER BY created_at DESC`
      )
      .all()
  ).results || [];

  return json({
    vouchers:
      rows.map(v => ({
        ...v,
        min_spend:
          Number(
            v.min_spend_cents
          ) / 100,
        active:
          !!v.active,
        new_user_only:
          !!v.new_user_only,
        auto_assign_new_user:
          !!v.auto_assign_new_user
      }))
  });
}

async function adminCreateVoucher(
  request,
  env
) {
  const b =
    await bodyJson(request);

  const code =
    String(
      b.code || ''
    )
      .trim()
      .toUpperCase();

  const title =
    String(
      b.title || ''
    ).trim();

  if (!code || !title) {
    throw new HttpError(
      400,
      'Code and title required'
    );
  }

  const vid = id();

  await env.DB
    .prepare(
      `INSERT INTO vouchers
      (
        id,
        code,
        title,
        discount_type,
        value,
        min_spend_cents,
        active,
        new_user_only,
        auto_assign_new_user,
        valid_days,
        starts_at,
        ends_at,
        usage_limit_per_customer,
        created_at,
        updated_at
      )
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .bind(
      vid,
      code,
      title,
      b.discount_type ===
        'percent'
        ? 'percent'
        : 'flat',
      Math.max(
        0,
        Number(
          b.value || 0
        )
      ),
      moneyCents(
        b.min_spend
      ),
      boolInt(
        b.active !== false
      ),
      boolInt(
        b.new_user_only
      ),
      boolInt(
        b.auto_assign_new_user
      ),
      Math.max(
        1,
        Math.round(
          Number(
            b.valid_days || 14
          )
        )
      ),
      b.starts_at || null,
      b.ends_at || null,
      Math.max(
        1,
        Math.round(
          Number(
            b.usage_limit_per_customer ||
            1
          )
        )
      ),
      nowIso(),
      nowIso()
    )
    .run();

  return json(
    {
      voucher: {
        id: vid
      }
    },
    201
  );
}

async function adminUpdateVoucher(
  request,
  env,
  vid
) {
  const b =
    await bodyJson(request);

  await env.DB
    .prepare(
      `UPDATE vouchers
       SET
         code=?,
         title=?,
         discount_type=?,
         value=?,
         min_spend_cents=?,
         active=?,
         new_user_only=?,
         auto_assign_new_user=?,
         valid_days=?,
         starts_at=?,
         ends_at=?,
         usage_limit_per_customer=?,
         updated_at=?
       WHERE id=?`
    )
    .bind(
      String(
        b.code || ''
      )
        .trim()
        .toUpperCase(),

      String(
        b.title || ''
      ).trim(),

      b.discount_type ===
        'percent'
        ? 'percent'
        : 'flat',

      Math.max(
        0,
        Number(
          b.value || 0
        )
      ),

      moneyCents(
        b.min_spend
      ),

      boolInt(
        b.active !== false
      ),

      boolInt(
        b.new_user_only
      ),

      boolInt(
        b.auto_assign_new_user
      ),

      Math.max(
        1,
        Math.round(
          Number(
            b.valid_days || 14
          )
        )
      ),

      b.starts_at || null,
      b.ends_at || null,

      Math.max(
        1,
        Math.round(
          Number(
            b.usage_limit_per_customer ||
            1
          )
        )
      ),

      nowIso(),
      vid
    )
    .run();

  return json({
    ok: true
  });
}

async function settingMap(
  env,
  keys
) {
  const ph =
    keys
      .map(() => '?')
      .join(',');

  const rows = (
    await env.DB
      .prepare(
        `SELECT key,value
         FROM settings
         WHERE key IN (${ph})`
      )
      .bind(...keys)
      .all()
  ).results || [];

  return Object.fromEntries(
    rows.map(
      r => [
        r.key,
        r.value || ''
      ]
    )
  );
}

async function adminGetPaymentSettings(
  env
) {
  const o =
    await settingMap(
      env,
      [
        'bank_name',
        'account_name',
        'account_number',
        'payment_qr_key',
        'points_enabled',
        'points_per_rm'
      ]
    );

  return json({
    ...o,
    qr_url:
      o.payment_qr_key
        ? `/api/media/${encodeURIComponent(
            o.payment_qr_key
          )}`
        : ''
  });
}

async function adminSavePaymentSettings(
  request,
  env
) {
  const b =
    await bodyJson(request);

  const vals = {
    bank_name:
      String(
        b.bank_name || ''
      ),

    account_name:
      String(
        b.account_name || ''
      ),

    account_number:
      String(
        b.account_number || ''
      ),

    points_enabled:
      b.points_enabled
        ? '1'
        : '0',

    points_per_rm:
      String(
        Math.max(
          0,
          Number(
            b.points_per_rm || 1
          )
        )
      )
  };

  const stmts =
    Object.entries(vals)
      .map(([k, v]) =>
        env.DB
          .prepare(
            `INSERT INTO settings
             (
               key,
               value,
               updated_at
             )
             VALUES(?,?,?)
             ON CONFLICT(key)
             DO UPDATE SET
               value=excluded.value,
               updated_at=excluded.updated_at`
          )
          .bind(
            k,
            v,
            nowIso()
          )
      );

  await env.DB.batch(
    stmts
  );

  return json({
    ok: true
  });
}

async function adminUploadPaymentQr(
  request,
  env
) {
  const f =
    await request.formData();

  const file =
    f.get('file');

  if (!file) {
    throw new HttpError(
      400,
      'Choose a QR image'
    );
  }

  if (
    file.size >
    4 * 1024 * 1024
  ) {
    throw new HttpError(
      400,
      'QR image must be below 4MB'
    );
  }

  const key =
    'settings/payment-qr';

  await env.MEDIA.put(
    key,
    await file.arrayBuffer(),
    {
      httpMetadata: {
        contentType:
          file.type ||
          'image/png'
      }
    }
  );

  await env.DB
    .prepare(
      `INSERT INTO settings
       (
         key,
         value,
         updated_at
       )
       VALUES(
         'payment_qr_key',
         ?,
         ?
       )
       ON CONFLICT(key)
       DO UPDATE SET
         value=excluded.value,
         updated_at=excluded.updated_at`
    )
    .bind(
      key,
      nowIso()
    )
    .run();

  return json({
    url:
      `/api/media/${encodeURIComponent(
        key
      )}`
  });
}

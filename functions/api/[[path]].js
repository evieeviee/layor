const SESSION_COOKIE = 'layor_session';
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 10000;
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

        if (
          parts[2] &&
          parts[3] === 'assign-all' &&
          method === 'POST'
        ) {
          return adminAssignVoucherToAll(
            env,
            parts[2]
          );
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
      {
        error: 'Server error',
        detail: String(err?.message || err || '')
      },
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
    raw.split(';')
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
    `HttpOnly; Secure; ` +
    `SameSite=Lax; Path=/; Max-Age=0`
  );
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name || '',
    phone: u.phone || '',
    role: u.role,
    points: Number(
      u.points || 0
    ),
    created_at: u.created_at
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
  const raw = base64url(
    crypto.getRandomValues(
      new Uint8Array(32)
    )
  );

  const tokenHash =
    await sha256Text(raw);

  const expires =
    new Date(
      Date.now() +
      SESSION_DAYS * 86400000
    ).toISOString();

  await env.DB.prepare(
    `
    INSERT INTO sessions(
      id,
      user_id,
      token_hash,
      expires_at
    )
    VALUES(?,?,?,?)
    `
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
    await env.DB.prepare(
      `
      SELECT u.*
      FROM sessions s
      JOIN users u
        ON u.id=s.user_id
      WHERE
        s.token_hash=?
        AND s.expires_at>?
      `
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
    String(
      b.password || ''
    );

  const fullName =
    String(
      b.full_name || ''
    ).trim();

  const phone =
    String(
      b.phone || ''
    ).trim();

  if (!fullName) {
    throw new HttpError(
      400,
      'Full name is required'
    );
  }

  if (
    !/^\S+@\S+\.\S+$/.test(email)
  ) {
    throw new HttpError(
      400,
      'Enter a valid email'
    );
  }

  if (
    !phone ||
    phone.replace(
      /\D/g,
      ''
    ).length < 8
  ) {
    throw new HttpError(
      400,
      'Enter a valid phone number'
    );
  }

  if (
    password.length < 8
  ) {
    throw new HttpError(
      400,
      'Password must be at least 8 characters'
    );
  }

  const exists =
    await env.DB.prepare(
      `
      SELECT id
      FROM users
      WHERE email=?
      `
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
  const createdAt = nowIso();

  await env.DB.prepare(
    `
    INSERT INTO users(
      id,
      email,
      password_hash,
      password_salt,
      full_name,
      phone,
      role,
      points,
      created_at
    )
    VALUES(
      ?,?,?,?,?,?,?,0,?
    )
    `
  )
    .bind(
      userId,
      email,
      hp.hash,
      hp.salt,
      fullName,
      phone,
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
    await env.DB.prepare(
      `
      SELECT *
      FROM users
      WHERE id=?
      `
    )
      .bind(userId)
      .first();

  return json(
    {
      user: publicUser(user)
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
    await env.DB.prepare(
      `
      SELECT *
      FROM users
      WHERE email=?
      `
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
      user: publicUser(user)
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
    const hash =
      await sha256Text(raw);

    await env.DB.prepare(
      `
      DELETE FROM sessions
      WHERE token_hash=?
      `
    )
      .bind(hash)
      .run();
  }

  return json(
    {
      ok: true
    },
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

async function getCatalog(env) {
  const categories =
    (
      await env.DB.prepare(
        `
        SELECT *
        FROM categories
        WHERE active=1
        ORDER BY sort_order ASC,
                 name ASC
        `
      ).all()
    ).results || [];

  const products =
    (
      await env.DB.prepare(
        `
        SELECT
          p.*,
          c.name AS category_name
        FROM products p
        LEFT JOIN categories c
          ON c.id=p.category_id
        WHERE p.active=1
        ORDER BY
          p.featured DESC,
          p.created_at DESC
        `
      ).all()
    ).results || [];

  const images =
    (
      await env.DB.prepare(
        `
        SELECT *
        FROM product_images
        ORDER BY
          sort_order ASC,
          created_at ASC
        `
      ).all()
    ).results || [];

  const byProduct = {};

  for (const im of images) {
    if (!byProduct[im.product_id]) {
      byProduct[im.product_id] = [];
    }

    byProduct[im.product_id].push(
      `/api/media/${encodeURIComponent(
        im.object_key
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
          byProduct[p.id] || []
      }))
  });
}

async function getPaymentSettings(
  env
) {
  const o =
    await settingMap(
      env,
      [
        'bank_name',
        'account_name',
        'account_number',
        'payment_qr_key'
      ]
    );

  return json({
    bank_name:
      o.bank_name || '',
    account_name:
      o.account_name || '',
    account_number:
      o.account_number || '',
    qr_url:
      o.payment_qr_key
        ? `/api/media/${encodeURIComponent(
            o.payment_qr_key
          )}`
        : ''
  });
}

async function getPublicMedia(
  env,
  key
) {
  const obj =
    await env.MEDIA.get(key);

  if (!obj) {
    return new Response(
      'Not found',
      {
        status: 404
      }
    );
  }

  const headers =
    new Headers();

  obj.writeHttpMetadata(
    headers
  );

  headers.set(
    'Cache-Control',
    'public, max-age=31536000, immutable'
  );

  return new Response(
    obj.body,
    {
      headers
    }
  );
}

async function customerVouchers(
  env,
  userId
) {
  const rows =
    (
      await env.DB.prepare(
        `
        SELECT
          cv.id AS customer_voucher_id,
          cv.assigned_at,
          cv.expires_at,
          cv.used_count,
          v.*
        FROM customer_vouchers cv
        JOIN vouchers v
          ON v.id=cv.voucher_id
        WHERE
          cv.user_id=?
          AND v.active=1
          AND (
            cv.expires_at IS NULL
            OR cv.expires_at>?
          )
          AND (
            v.starts_at IS NULL
            OR v.starts_at<=?
          )
          AND (
            v.ends_at IS NULL
            OR v.ends_at>=?
          )
          AND cv.used_count <
              v.usage_limit_per_customer
        ORDER BY
          cv.assigned_at DESC
        `
      )
        .bind(
          userId,
          nowIso(),
          nowIso(),
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

async function customerOrders(
  env,
  userId
) {
  const rows =
    (
      await env.DB.prepare(
        `
        SELECT *
        FROM orders
        WHERE user_id=?
        ORDER BY created_at DESC
        `
      )
        .bind(userId)
        .all()
    ).results || [];

  return json({
    orders:
      rows.map(o => ({
        ...o,
        subtotal:
          Number(
            o.subtotal_cents
          ) / 100,
        discount:
          Number(
            o.discount_cents
          ) / 100,
        total:
          Number(
            o.total_cents
          ) / 100
      }))
  });
}

async function createOrder(
  request,
  env
) {
  const form =
    await request.formData();

  const rawPayload =
    form.get('payload');

  if (!rawPayload) {
    throw new HttpError(
      400,
      'Order payload is missing'
    );
  }

  let b;

  try {
    b = JSON.parse(
      String(rawPayload)
    );
  } catch {
    throw new HttpError(
      400,
      'Invalid order payload'
    );
  }

  const current =
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
      b.customer_email
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

  const note =
    String(
      b.note || ''
    ).trim();

  if (!customerName) {
    throw new HttpError(
      400,
      'Customer name required'
    );
  }

  if (
    !customerPhone ||
    customerPhone
      .replace(/\D/g, '')
      .length < 8
  ) {
    throw new HttpError(
      400,
      'Valid phone required'
    );
  }

  if (
    !pickupDate ||
    !pickupTime
  ) {
    throw new HttpError(
      400,
      'Pickup date and time required'
    );
  }

  const incomingItems =
    Array.isArray(b.items)
      ? b.items
      : [];

  if (!incomingItems.length) {
    throw new HttpError(
      400,
      'Cart is empty'
    );
  }

  const orderItems = [];
  let subtotalCents = 0;

  for (
    const item
    of incomingItems
  ) {
    if (
      item.type === 'bundle'
    ) {
      const productIds =
        Array.isArray(
          item.product_ids
        )
          ? item.product_ids
          : [];

      const size =
        productIds.length;

      if (
        !BUNDLE_SAVINGS[size]
      ) {
        throw new HttpError(
          400,
          'Invalid bundle size'
        );
      }

      let bundleSubtotal = 0;

      for (
        const productId
        of productIds
      ) {
        const product =
          await env.DB.prepare(
            `
            SELECT *
            FROM products
            WHERE
              id=?
              AND active=1
              AND mix_eligible=1
            `
          )
            .bind(productId)
            .first();

        if (!product) {
          throw new HttpError(
            400,
            'A Mix & Match product is unavailable'
          );
        }

        bundleSubtotal +=
          Number(
            product.price_cents
          );

        orderItems.push({
          product_id:
            product.id,
          product_title:
            product.title,
          unit_price_cents:
            Number(
              product.price_cents
            ),
          qty: 1,
          bundle_name:
            `${size} Box Mix & Match`
        });
      }

      subtotalCents +=
        Math.max(
          0,
          bundleSubtotal -
          BUNDLE_SAVINGS[size]
        );

      continue;
    }

    const productId =
      String(
        item.product_id || ''
      );

    const qty =
      Math.max(
        1,
        Math.round(
          Number(
            item.qty || 1
          )
        )
      );

    const product =
      await env.DB.prepare(
        `
        SELECT *
        FROM products
        WHERE
          id=?
          AND active=1
        `
      )
        .bind(productId)
        .first();

    if (!product) {
      throw new HttpError(
        400,
        'A product in your bag is unavailable'
      );
    }

    subtotalCents +=
      Number(
        product.price_cents
      ) * qty;

    orderItems.push({
      product_id:
        product.id,
      product_title:
        product.title,
      unit_price_cents:
        Number(
          product.price_cents
        ),
      qty,
      bundle_name:
        null
    });
  }

  let voucher = null;
  let discountCents = 0;

  if (
    current &&
    b.voucher_id
  ) {
    voucher =
      await env.DB.prepare(
        `
        SELECT
          v.*,
          cv.id AS cv_id,
          cv.used_count,
          cv.expires_at
        FROM customer_vouchers cv
        JOIN vouchers v
          ON v.id=cv.voucher_id
        WHERE
          cv.user_id=?
          AND v.id=?
          AND v.active=1
        `
      )
        .bind(
          current.id,
          String(
            b.voucher_id
          )
        )
        .first();

    if (!voucher) {
      throw new HttpError(
        400,
        'Voucher is not available'
      );
    }

    if (
      voucher.expires_at &&
      voucher.expires_at <
        nowIso()
    ) {
      throw new HttpError(
        400,
        'Voucher expired'
      );
    }

    if (
      Number(
        voucher.used_count
      ) >=
      Number(
        voucher.usage_limit_per_customer
      )
    ) {
      throw new HttpError(
        400,
        'Voucher usage limit reached'
      );
    }

    if (
      subtotalCents <
      Number(
        voucher.min_spend_cents
      )
    ) {
      throw new HttpError(
        400,
        'Minimum spend not reached'
      );
    }

    if (
      voucher.discount_type ===
      'percent'
    ) {
      discountCents =
        Math.round(
          subtotalCents *
          Number(
            voucher.value
          ) /
          100
        );
    } else {
      discountCents =
        Number(
          voucher.value
        ) * 100;
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

  const receipt =
    form.get('receipt');

  let receiptKey = null;

  if (
    receipt &&
    typeof receipt === 'object' &&
    receipt.size
  ) {
    if (
      receipt.size >
      8 * 1024 * 1024
    ) {
      throw new HttpError(
        400,
        'Receipt must be below 8MB'
      );
    }

    receiptKey =
      `receipts/${orderId}`;

    await env.MEDIA.put(
      receiptKey,
      await receipt.arrayBuffer(),
      {
        httpMetadata: {
          contentType:
            receipt.type ||
            'application/octet-stream'
        }
      }
    );
  }

  const createdAt =
    nowIso();

  const inserts = [];

  inserts.push(
    env.DB.prepare(
      `
      INSERT INTO orders(
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
      VALUES(
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,
        'checking','new',?,0,?,?
      )
      `
    )
      .bind(
        orderId,
        orderNo,
        current
          ? current.id
          : null,
        customerName,
        customerEmail ||
          null,
        customerPhone,
        pickupDate,
        pickupTime,
        note || null,
        subtotalCents,
        discountCents,
        totalCents,
        voucher
          ? voucher.id
          : null,
        'manual_qr',
        receiptKey,
        createdAt,
        createdAt
      )
  );

  for (
    const item
    of orderItems
  ) {
   inserts.push(
  env.DB.prepare(
    `
    INSERT INTO order_items(
      id,
      order_id,
      product_id,
      product_title,
      quantity,
      unit_price_cents,
      line_total_cents,
      bundle_name,
      created_at
    )
    VALUES(
      ?,?,?,?,?,?,?,?,?
    )
    `
  )
  .bind(
    id(),
    orderId,
    item.product_id,
    item.product_title,
    item.qty,
    item.unit_price_cents,
    item.unit_price_cents * item.qty,
    item.bundle_name,
    createdAt
  )
);
  }

  if (voucher) {
    inserts.push(
      env.DB.prepare(
        `
        UPDATE customer_vouchers
        SET used_count =
          used_count + 1
        WHERE id=?
        `
      )
        .bind(
          voucher.cv_id
        )
    );
  }

  if (current) {
    inserts.push(
      env.DB.prepare(
        `
        UPDATE users
        SET
          full_name=?,
          phone=?
        WHERE id=?
        `
      )
        .bind(
          customerName,
          customerPhone,
          current.id
        )
    );
  }

  await env.DB.batch(
    inserts
  );

  return json(
    {
      ok: true,
      order: {
        id: orderId,
        order_no: orderNo,
        total:
          totalCents / 100,
        payment_status:
          'checking',
        order_status:
          'new'
      }
    },
    201
  );
}

async function assignNewUserVouchers(
  env,
  userId
) {
  const vouchers =
    (
      await env.DB.prepare(
        `
        SELECT *
        FROM vouchers
        WHERE
          active=1
          AND auto_assign_new_user=1
          AND (
            starts_at IS NULL
            OR starts_at<=?
          )
          AND (
            ends_at IS NULL
            OR ends_at>=?
          )
        `
      )
        .bind(
          nowIso(),
          nowIso()
        )
        .all()
    ).results || [];

  if (!vouchers.length) {
    return;
  }

  const stmts = [];

  for (
    const v
    of vouchers
  ) {
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

    stmts.push(
      env.DB.prepare(
        `
        INSERT OR IGNORE INTO customer_vouchers(
          id,
          user_id,
          voucher_id,
          assigned_at,
          expires_at,
          used_count
        )
        VALUES(
          ?,?,?,?,?,0
        )
        `
      )
        .bind(
          id(),
          userId,
          v.id,
          nowIso(),
          expires
        )
    );
  }

  await env.DB.batch(
    stmts
  );
}

async function adminDashboard(
  env
) {
  const [
    products,
    categories,
    orders,
    customers,
    sales
  ] = await Promise.all([
    env.DB.prepare(
      `
      SELECT COUNT(*) AS n
      FROM products
      `
    ).first(),

    env.DB.prepare(
      `
      SELECT COUNT(*) AS n
      FROM categories
      `
    ).first(),

    env.DB.prepare(
      `
      SELECT COUNT(*) AS n
      FROM orders
      `
    ).first(),

    env.DB.prepare(
      `
      SELECT COUNT(*) AS n
      FROM users
      WHERE role='customer'
      `
    ).first(),

    env.DB.prepare(
      `
      SELECT
        COALESCE(
          SUM(total_cents),
          0
        ) AS n
      FROM orders
      WHERE payment_status='paid'
      `
    ).first()
  ]);

  return json({
    products:
      Number(
        products?.n || 0
      ),
    categories:
      Number(
        categories?.n || 0
      ),
    orders:
      Number(
        orders?.n || 0
      ),
    customers:
      Number(
        customers?.n || 0
      ),
    sales:
      Number(
        sales?.n || 0
      ) / 100
  });
}

async function adminCategories(
  env
) {
  const rows =
    (
      await env.DB.prepare(
        `
        SELECT *
        FROM categories
        ORDER BY
          sort_order ASC,
          name ASC
        `
      ).all()
    ).results || [];

  return json({
    categories:
      rows.map(c => ({
        ...c,
        active:
          !!c.active
      }))
  });
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

  const cid = id();

  await env.DB.prepare(
    `
    INSERT INTO categories(
      id,
      name,
      sort_order,
      active,
      created_at
    )
    VALUES(
      ?,?,?,?,?
    )
    `
  )
    .bind(
      cid,
      name,
      Math.round(
        Number(
          b.sort_order || 0
        )
      ),
      boolInt(
        b.active !== false
      ),
      nowIso()
    )
    .run();

  return json(
    {
      category: {
        id: cid
      }
    },
    201
  );
}

async function adminUpdateCategory(
  request,
  env,
  cid
) {
  const b =
    await bodyJson(request);

  await env.DB.prepare(
    `
    UPDATE categories
    SET
      name=?,
      sort_order=?,
      active=?
    WHERE id=?
    `
  )
    .bind(
      String(
        b.name || ''
      ).trim(),
      Math.round(
        Number(
          b.sort_order || 0
        )
      ),
      boolInt(
        b.active !== false
      ),
      cid
    )
    .run();

  return json({
    ok: true
  });
}

async function adminProducts(
  env
) {
  const products =
    (
      await env.DB.prepare(
        `
        SELECT
          p.*,
          c.name AS category_name
        FROM products p
        LEFT JOIN categories c
          ON c.id=p.category_id
        ORDER BY
          p.created_at DESC
        `
      ).all()
    ).results || [];

  const images =
    (
      await env.DB.prepare(
        `
        SELECT *
        FROM product_images
        ORDER BY
          sort_order ASC,
          created_at ASC
        `
      ).all()
    ).results || [];

  const by = {};

  for (
    const im
    of images
  ) {
    if (!by[im.product_id]) {
      by[im.product_id] = [];
    }

    by[im.product_id].push({
      id: im.id,
      object_key:
        im.object_key,
      sort_order:
        im.sort_order,
      url:
        `/api/media/${encodeURIComponent(
          im.object_key
        )}`
    });
  }

  return json({
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
          by[p.id] || []
      }))
  });
}

async function adminCreateProduct(
  request,
  env
) {
  const b =
    await bodyJson(request);

  const title =
    String(
      b.title || ''
    ).trim();

  if (!title) {
    throw new HttpError(
      400,
      'Product title required'
    );
  }

  const dupe =
    await env.DB.prepare(
      `
      SELECT id
      FROM products
      WHERE
        LOWER(title)=LOWER(?)
        AND COALESCE(category_id,'')
            =
            COALESCE(?,'')
      `
    )
      .bind(
        title,
        b.category_id ||
        null
      )
      .first();

  if (dupe) {
    throw new HttpError(
      409,
      'A product with this title already exists in this category'
    );
  }

  const pid = id();
  const now = nowIso();

  await env.DB.prepare(
    `
    INSERT INTO products(
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
    VALUES(
      ?,?,?,?,?,?,?,?,?,?,?
    )
    `
  )
    .bind(
      pid,
      b.category_id ||
        null,
      title,
      b.chinese_title ||
        null,
      b.description ||
        null,
      moneyCents(
        b.price
      ),
      boolInt(
        b.active !== false
      ),
      boolInt(
        b.featured
      ),
      boolInt(
        b.mix_eligible
      ),
      now,
      now
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

  const title =
    String(
      b.title || ''
    ).trim();

  if (!title) {
    throw new HttpError(
      400,
      'Product title required'
    );
  }

  const dupe =
    await env.DB.prepare(
      `
      SELECT id
      FROM products
      WHERE
        id<>?
        AND LOWER(title)=LOWER(?)
        AND COALESCE(category_id,'')
            =
            COALESCE(?,'')
      `
    )
      .bind(
        pid,
        title,
        b.category_id ||
        null
      )
      .first();

  if (dupe) {
    throw new HttpError(
      409,
      'A product with this title already exists in this category'
    );
  }

  await env.DB.prepare(
    `
    UPDATE products
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
    WHERE id=?
    `
  )
    .bind(
      b.category_id ||
        null,
      title,
      b.chinese_title ||
        null,
      b.description ||
        null,
      moneyCents(
        b.price
      ),
      boolInt(
        b.active !== false
      ),
      boolInt(
        b.featured
      ),
      boolInt(
        b.mix_eligible
      ),
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
  const images =
    (
      await env.DB.prepare(
        `
        SELECT object_key
        FROM product_images
        WHERE product_id=?
        `
      )
        .bind(pid)
        .all()
    ).results || [];

  for (
    const im
    of images
  ) {
    await env.MEDIA.delete(
      im.object_key
    );
  }

  await env.DB.prepare(
    `
    DELETE FROM products
    WHERE id=?
    `
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
  const form =
    await request.formData();

  const file =
    form.get('file');

  const productId =
    String(
      form.get('product_id') ||
      ''
    );

  const sortOrder =
    Math.max(
      0,
      Math.min(
        2,
        Math.round(
          Number(
            form.get(
              'sort_order'
            ) || 0
          )
        )
      )
    );

  if (
    !file ||
    !productId
  ) {
    throw new HttpError(
      400,
      'Image and product required'
    );
  }

  if (
    file.size >
    8 * 1024 * 1024
  ) {
    throw new HttpError(
      400,
      'Image must be below 8MB'
    );
  }

  const count =
    await env.DB.prepare(
      `
      SELECT COUNT(*) AS n
      FROM product_images
      WHERE product_id=?
      `
    )
      .bind(productId)
      .first();

  if (
    Number(
      count?.n || 0
    ) >= 3
  ) {
    throw new HttpError(
      400,
      'Maximum 3 images per product'
    );
  }

  const ext =
    String(
      file.type || ''
    )
      .split('/')[1]
      ?.replace(
        /[^a-z0-9]/gi,
        ''
      ) || 'jpg';

  const imageId = id();

  const key =
    `products/${productId}/${imageId}.${ext}`;

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

  await env.DB.prepare(
    `
    INSERT INTO product_images(
      id,
      product_id,
      object_key,
      sort_order,
      created_at
    )
    VALUES(
      ?,?,?,?,?
    )
    `
  )
    .bind(
      imageId,
      productId,
      key,
      sortOrder,
      nowIso()
    )
    .run();

  return json(
    {
      image: {
        id: imageId,
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
  const image =
    await env.DB.prepare(
      `
      SELECT *
      FROM product_images
      WHERE id=?
      `
    )
      .bind(imageId)
      .first();

  if (!image) {
    throw new HttpError(
      404,
      'Image not found'
    );
  }

  await env.MEDIA.delete(
    image.object_key
  );

  await env.DB.prepare(
    `
    DELETE FROM product_images
    WHERE id=?
    `
  )
    .bind(imageId)
    .run();

  return json({
    ok: true
  });
}

async function adminOrders(
  env
) {
  const orders =
    (
      await env.DB.prepare(
        `
        SELECT *
        FROM orders
        ORDER BY
          created_at DESC
        `
      ).all()
    ).results || [];

  const items =
    (
      await env.DB.prepare(
        `
        SELECT *
        FROM order_items
        ORDER BY
          created_at ASC
        `
      ).all()
    ).results || [];

  const by = {};

  for (
    const item
    of items
  ) {
    if (!by[item.order_id]) {
      by[item.order_id] = [];
    }

    by[item.order_id].push({
      ...item,
      unit_price:
        Number(
          item.unit_price_cents
        ) / 100
    });
  }

  return json({
    orders:
      orders.map(o => ({
        ...o,
        subtotal:
          Number(
            o.subtotal_cents
          ) / 100,
        discount:
          Number(
            o.discount_cents
          ) / 100,
        total:
          Number(
            o.total_cents
          ) / 100,
        receipt_url:
          o.receipt_key
            ? `/api/admin/orders/${o.id}/receipt`
            : '',
        items:
          by[o.id] || []
      }))
  });
}

async function adminUpdateOrderStatus(
  request,
  env,
  oid
) {
  const b =
    await bodyJson(request);

  const order =
    await env.DB.prepare(
      `
      SELECT *
      FROM orders
      WHERE id=?
      `
    )
      .bind(oid)
      .first();

  if (!order) {
    throw new HttpError(
      404,
      'Order not found'
    );
  }

  const paymentStatus =
    [
      'checking',
      'paid',
      'rejected'
    ].includes(
      b.payment_status
    )
      ? b.payment_status
      : order.payment_status;

  const orderStatus =
    [
      'new',
      'confirmed',
      'preparing',
      'ready',
      'completed',
      'cancelled'
    ].includes(
      b.order_status
    )
      ? b.order_status
      : order.order_status;

  await env.DB.prepare(
    `
    UPDATE orders
    SET
      payment_status=?,
      order_status=?,
      updated_at=?
    WHERE id=?
    `
  )
    .bind(
      paymentStatus,
      orderStatus,
      nowIso(),
      oid
    )
    .run();

  if (
    paymentStatus === 'paid' &&
    order.payment_status !==
      'paid' &&
    order.user_id
  ) {
    const settings =
      await settingMap(
        env,
        [
          'points_enabled',
          'points_per_rm'
        ]
      );

    const enabled =
      settings.points_enabled !==
      '0';

    const rate =
      Math.max(
        0,
        Number(
          settings.points_per_rm ||
          1
        )
      );

    const points =
      enabled
        ? Math.floor(
            (
              Number(
                order.total_cents
              ) / 100
            ) * rate
          )
        : 0;

    if (points > 0) {
      await env.DB.batch([
        env.DB.prepare(
          `
          UPDATE users
          SET
            points =
              points + ?
          WHERE id=?
          `
        )
          .bind(
            points,
            order.user_id
          ),

        env.DB.prepare(
          `
          INSERT INTO points_ledger(
            id,
            user_id,
            order_id,
            delta,
            reason,
            created_at
          )
          VALUES(
            ?,?,?,?,?,?
          )
          `
        )
          .bind(
            id(),
            order.user_id,
            order.id,
            points,
            `Order ${order.order_no}`,
            nowIso()
          ),

        env.DB.prepare(
          `
          UPDATE orders
          SET points_awarded=?
          WHERE id=?
          `
        )
          .bind(
            points,
            order.id
          )
      ]);
    }
  }

  return json({
    ok: true
  });
}

async function adminReceipt(
  env,
  oid
) {
  const order =
    await env.DB.prepare(
      `
      SELECT receipt_key
      FROM orders
      WHERE id=?
      `
    )
      .bind(oid)
      .first();

  if (
    !order ||
    !order.receipt_key
  ) {
    return new Response(
      'Receipt not found',
      {
        status: 404
      }
    );
  }

  const obj =
    await env.MEDIA.get(
      order.receipt_key
    );

  if (!obj) {
    return new Response(
      'Receipt not found',
      {
        status: 404
      }
    );
  }

  const headers =
    new Headers();

  obj.writeHttpMetadata(
    headers
  );

  headers.set(
    'Cache-Control',
    'private, no-store'
  );

  return new Response(
    obj.body,
    {
      headers
    }
  );
}

async function adminCustomers(
  env
) {
  const customers =
    (
      await env.DB.prepare(
        `
        SELECT
          u.id,
          u.email,
          u.full_name,
          u.phone,
          u.points,
          u.created_at,
          COUNT(o.id) AS order_count,
          COALESCE(
            SUM(
              CASE
                WHEN o.payment_status='paid'
                THEN o.total_cents
                ELSE 0
              END
            ),
            0
          ) AS paid_spend_cents
        FROM users u
        LEFT JOIN orders o
          ON o.user_id=u.id
        WHERE u.role='customer'
        GROUP BY u.id
        ORDER BY
          u.created_at DESC
        `
      ).all()
    ).results || [];

  return json({
    customers:
      customers.map(c => ({
        ...c,
        order_count:
          Number(
            c.order_count || 0
          ),
        paid_spend:
          Number(
            c.paid_spend_cents || 0
          ) / 100
      }))
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

  if (!delta) {
    throw new HttpError(
      400,
      'Enter a point adjustment'
    );
  }

  const row =
    await env.DB.prepare(
      `
      SELECT points
      FROM users
      WHERE
        id=?
        AND role='customer'
      `
    )
      .bind(userId)
      .first();

  if (!row) {
    throw new HttpError(
      404,
      'Customer not found'
    );
  }

  const next =
    Math.max(
      0,
      Number(
        row.points || 0
      ) + delta
    );

  const actualDelta =
    next -
    Number(
      row.points || 0
    );

  await env.DB.batch([
    env.DB.prepare(
      `
      UPDATE users
      SET points=?
      WHERE id=?
      `
    )
      .bind(
        next,
        userId
      ),

    env.DB.prepare(
      `
      INSERT INTO points_ledger(
        id,
        user_id,
        order_id,
        delta,
        reason,
        created_at
      )
      VALUES(
        ?,?,NULL,?,?,?
      )
      `
    )
      .bind(
        id(),
        userId,
        actualDelta,
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

  const voucher =
    await env.DB.prepare(
      `
      SELECT *
      FROM vouchers
      WHERE
        id=?
        AND active=1
      `
    )
      .bind(
        String(
          b.voucher_id || ''
        )
      )
      .first();

  if (!voucher) {
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
          voucher.valid_days ||
          14
        )
      ) *
      86400000
    ).toISOString();

  await env.DB.prepare(
    `
    INSERT OR IGNORE INTO customer_vouchers(
      id,
      user_id,
      voucher_id,
      assigned_at,
      expires_at,
      used_count
    )
    VALUES(
      ?,?,?,?,?,0
    )
    `
  )
    .bind(
      id(),
      userId,
      voucher.id,
      nowIso(),
      expires
    )
    .run();

  return json({
    ok: true
  });
}

async function adminVouchers(
  env
) {
  const rows =
    (
      await env.DB.prepare(
        `
        SELECT *
        FROM vouchers
        ORDER BY
          created_at DESC
        `
      ).all()
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

  if (
    !code ||
    !title
  ) {
    throw new HttpError(
      400,
      'Code and title required'
    );
  }

  const vid = id();

  await env.DB.prepare(
    `
    INSERT INTO vouchers(
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
    VALUES(
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
    `
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
        Math.round(
          Number(
            b.value || 0
          )
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
            b.valid_days ||
            14
          )
        )
      ),
      b.starts_at ||
        null,
      b.ends_at ||
        null,
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

  await env.DB.prepare(
    `
    UPDATE vouchers
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
    WHERE id=?
    `
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
        Math.round(
          Number(
            b.value || 0
          )
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
            b.valid_days ||
            14
          )
        )
      ),
      b.starts_at ||
        null,
      b.ends_at ||
        null,
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

async function adminAssignVoucherToAll(
  env,
  vid
) {
  const voucher =
    await env.DB.prepare(
      `
      SELECT *
      FROM vouchers
      WHERE
        id=?
        AND active=1
      `
    )
      .bind(vid)
      .first();

  if (!voucher) {
    throw new HttpError(
      404,
      'Voucher not found'
    );
  }

  const users =
    (
      await env.DB.prepare(
        `
        SELECT id
        FROM users
        WHERE role='customer'
        `
      ).all()
    ).results || [];

  const expires =
    new Date(
      Date.now() +
      Math.max(
        1,
        Number(
          voucher.valid_days ||
          14
        )
      ) *
      86400000
    ).toISOString();

  const stmts =
    users.map(u =>
      env.DB.prepare(
        `
        INSERT OR IGNORE INTO customer_vouchers(
          id,
          user_id,
          voucher_id,
          assigned_at,
          expires_at,
          used_count
        )
        VALUES(
          ?,?,?,?,?,0
        )
        `
      )
        .bind(
          id(),
          u.id,
          voucher.id,
          nowIso(),
          expires
        )
    );

  if (stmts.length) {
    await env.DB.batch(
      stmts
    );
  }

  return json({
    ok: true,
    assigned:
      users.length
  });
}

async function settingMap(
  env,
  keys
) {
  const placeholders =
    keys.map(() => '?')
      .join(',');

  const rows =
    (
      await env.DB.prepare(
        `
        SELECT
          key,
          value
        FROM settings
        WHERE key IN(
          ${placeholders}
        )
        `
      )
        .bind(...keys)
        .all()
    ).results || [];

  return Object.fromEntries(
    rows.map(r => [
      r.key,
      r.value || ''
    ])
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
            b.points_per_rm ||
            1
          )
        )
      )
  };

  const stmts =
    Object.entries(
      vals
    ).map(
      ([k, v]) =>
        env.DB.prepare(
          `
          INSERT INTO settings(
            key,
            value,
            updated_at
          )
          VALUES(
            ?,?,?
          )
          ON CONFLICT(key)
          DO UPDATE SET
            value=excluded.value,
            updated_at=excluded.updated_at
          `
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
  const form =
    await request.formData();

  const file =
    form.get('file');

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

  await env.DB.prepare(
    `
    INSERT INTO settings(
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
      updated_at=excluded.updated_at
    `
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

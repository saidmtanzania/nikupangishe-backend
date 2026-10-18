#!/usr/bin/env node
/*
 * End-to-end journey test for the core Nikupangishe rental loop.
 *
 * Runs against a live API (default http://localhost:3000/api/v1) that uses
 * NODE_ENV=development, EXPOSE_DEV_AUTH_CODES=true and a disposable database.
 *
 *   node test/journey.e2e.cjs [baseUrl]
 *
 * Journey covered:
 *   owner lists house -> admin verifies -> owner assigns verified agent ->
 *   tenant books viewing -> agent confirms, completes, reports interest ->
 *   owner approves tenant (tenancy + payment details + placement commission) ->
 *   second owner confirms an existing tenant -> exchange between both tenants ->
 *   both owners approve -> exchange completes and the agent earns again.
 */
const BASE = process.argv[2] || process.env.API_URL || 'http://localhost:3000/api/v1';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@nikupangishe.co.tz';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1234';

const run = Date.now().toString().slice(-7);
let passed = 0;
let failed = 0;

function check(cond, label, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${extra ? `\n      ${JSON.stringify(extra).slice(0, 400)}` : ''}`);
  }
}

async function call(method, path, { token, body, expect } = {}) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 10000));
      continue;
    }
    const json = await res.json().catch(() => ({}));
    const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
    if (expect && res.status !== expect) {
      throw new Error(`${method} ${path} -> ${res.status} (expected ${expect}): ${JSON.stringify(json).slice(0, 500)}`);
    }
    return { status: res.status, data, raw: json };
  }
  throw new Error(`${method} ${path} kept returning 429`);
}

async function signUp(role, label) {
  const email = `${label}.${run}@test.local`;
  const phone = `+2557${run.slice(-6)}${String(Math.floor(Math.random() * 90) + 10)}`.slice(0, 13);
  const password = 'Password@123';
  const reg = await call('POST', '/auth/register', {
    body: { firstName: label, lastName: 'Test', email, phone, password, role },
    expect: 201,
  });
  if (!reg.data.otp) throw new Error('Register did not expose OTP; set EXPOSE_DEV_AUTH_CODES=true');
  const ver = await call('POST', '/auth/verify-phone', { body: { phone, code: reg.data.otp }, expect: 200 });
  return { token: ver.data.accessToken, user: ver.data.user, email, password };
}

async function createVerifiedHouse(owner, admin, overrides) {
  const house = await call('POST', '/houses', {
    token: owner.token,
    body: {
      title: `Test house ${overrides.title}`,
      description: 'A clean two bedroom house used by the journey test.',
      houseType: 'apartment',
      address: 'Plot 1',
      area: overrides.area,
      city: 'Dar es Salaam',
      latitude: overrides.lat,
      longitude: overrides.lng,
      rentAmount: overrides.rent,
      bedrooms: 2,
      bathrooms: 1,
      isOpenToExchange: overrides.isOpenToExchange ?? false,
    },
    expect: 201,
  });
  await call('PATCH', `/houses/${house.data.id}/publish`, { token: owner.token, expect: 200 });
  await call('PATCH', `/houses/${house.data.id}/verify`, {
    token: admin.token,
    body: { approved: true, notes: 'journey test' },
    expect: 200,
  });
  return house.data;
}

(async () => {
  console.log(`Journey test against ${BASE}\n`);

  const adminLogin = await call('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    expect: 200,
  });
  const admin = { token: adminLogin.data.accessToken };

  console.log('Accounts');
  const ownerA = await signUp('owner', 'ownerA');
  const ownerB = await signUp('owner', 'ownerB');
  const agent = await signUp('agent', 'agent');
  const tenant1 = await signUp('tenant', 'tenantOne');
  const tenant2 = await signUp('tenant', 'tenantTwo');
  const outsider = await signUp('tenant', 'outsider');
  check(true, 'six users registered and phone-verified');

  const agentProfile = (await call('GET', '/agents/me', { token: agent.token, expect: 200 })).data;
  await call('PATCH', `/agents/${agentProfile.id}/verify`, {
    token: admin.token,
    body: { approved: true },
    expect: 200,
  });
  check(true, 'admin verified the agent');

  console.log('\nListings');
  const lat = -6.7 - Number(run.slice(-3)) / 10000;
  const h1 = await createVerifiedHouse(ownerA, admin, { title: 'A1', area: 'Mikocheni', lat, lng: 39.25, rent: 600000 });
  const h2 = await createVerifiedHouse(ownerB, admin, {
    title: 'B1', area: 'Sinza', lat: lat - 0.05, lng: 39.22, rent: 500000, isOpenToExchange: true,
  });
  check(true, 'two houses listed, published and verified');

  const dupSameOwner = await call('POST', '/houses', {
    token: ownerA.token,
    body: { title: 'dup', description: 'dup', houseType: 'apartment', address: 'x', area: 'Mikocheni', city: 'Dar es Salaam', latitude: lat, longitude: 39.25, rentAmount: 1 },
  });
  check(dupSameOwner.status === 409, 'same owner cannot list a second house at the same GPS point', dupSameOwner.raw);

  for (const [owner, house] of [[ownerA, h1], [ownerB, h2]]) {
    await call('POST', `/houses/${house.id}/agents`, {
      token: owner.token,
      body: { agentId: agentProfile.id, isPrimary: true, customCommissionRate: 30 },
      expect: 201,
    });
  }
  check(true, 'both owners assigned the agent as primary (30% commission)');

  console.log('\nViewing -> approval -> tenancy');
  const preferredDate = new Date(Date.now() + 3 * 86400000).toISOString();
  const viewing = await call('POST', '/viewings', {
    token: tenant1.token,
    body: { houseId: h1.id, preferredDate, tenantMessage: 'Can I see it Saturday?' },
  });
  check(viewing.status === 201, 'tenant can book a viewing', viewing.raw);
  if (viewing.status !== 201) return finish();

  const tenantTryConfirm = await call('PATCH', `/viewings/${viewing.data.id}`, {
    token: tenant1.token,
    body: { status: 'confirmed' },
  });
  check(tenantTryConfirm.status === 403, 'tenant cannot confirm their own viewing', tenantTryConfirm.raw);

  const confirmed = await call('PATCH', `/viewings/${viewing.data.id}`, {
    token: agent.token,
    body: { status: 'confirmed', confirmedDate: preferredDate },
  });
  check(confirmed.status === 200 && confirmed.data.status === 'confirmed', 'agent confirms the viewing', confirmed.raw);

  const earlyApprove = await call('POST', `/viewings/${viewing.data.id}/approve-tenant`, {
    token: ownerA.token,
    body: { paymentInstructions: 'x' },
  });
  check(earlyApprove.status === 400, 'owner cannot approve before the agent reports interest', earlyApprove.raw);

  const completed = await call('PATCH', `/viewings/${viewing.data.id}`, {
    token: agent.token,
    body: { status: 'completed', agentNotes: 'Tenant liked it', tenantInterestedAfterViewing: true },
  });
  check(completed.status === 200 && completed.data.tenantInterestedAfterViewing === true, 'agent completes viewing and reports interest', completed.raw);

  const strangerApprove = await call('POST', `/viewings/${viewing.data.id}/approve-tenant`, {
    token: ownerB.token,
    body: { paymentInstructions: 'x' },
  });
  check(strangerApprove.status === 403, 'a different owner cannot approve this tenant', strangerApprove.raw);

  const approval = await call('POST', `/viewings/${viewing.data.id}/approve-tenant`, {
    token: ownerA.token,
    body: {
      paymentInstructions: 'Pay to M-Pesa 0712 000 000 (Owner A), reference: house A1',
      startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
  });
  check(approval.status === 201, 'owner approves the interested tenant', approval.raw);
  if (approval.status === 201) {
    const t = approval.data.tenancy;
    check(t && t.status === 'active', 'an active tenancy is created', t);
    check(t && Number(t.agreedRent) === 600000, 'agreed rent defaults to the listing rent', t);
    check(t && Number(t.agentCommissionRate) === 30 && Number(t.agentCommissionAmount) === 180000,
      'placement commission is 30% of one month rent (180,000 TZS)', t);
    check(approval.data.commission && approval.data.commission.type === 'initial_placement', 'an initial_placement commission record is created', approval.data.commission);
  }

  const again = await call('POST', `/viewings/${viewing.data.id}/approve-tenant`, {
    token: ownerA.token,
    body: { paymentInstructions: 'again' },
  });
  check(again.status === 400, 'approving the same viewing twice is rejected', again.raw);

  const tenancy1 = await call('GET', '/exchanges/my-tenancy', { token: tenant1.token, expect: 200 });
  check(tenancy1.data && tenancy1.data.houseId === h1.id, 'tenant sees their new tenancy');
  check(tenancy1.data && typeof tenancy1.data.paymentInstructions === 'string' && tenancy1.data.paymentInstructions.includes('M-Pesa'),
    'tenant can read the owner payment instructions', tenancy1.data);

  const h1Public = await call('GET', '/houses', {});
  const listed = JSON.stringify(h1Public.data).includes(h1.id);
  check(!listed, 'rented house disappears from public browse');

  console.log('\nExisting tenant recorded by owner');
  const confirmT2 = await call('POST', '/exchanges/confirm-tenancy', {
    token: ownerB.token,
    body: { tenantUserId: tenant2.user.id, houseId: h2.id, agreedRent: 500000 },
  });
  check(confirmT2.status === 201, 'owner B confirms tenant two already lives in house B1', confirmT2.raw);

  console.log('\nHouse exchange');
  const exchange = await call('POST', '/exchanges', {
    token: tenant1.token,
    body: { exchangeType: 'exchange', targetHouseId: h2.id, notes: 'Closer to work' },
  });
  check(exchange.status === 201, 'tenant one requests an exchange with an occupied, exchange-open house', exchange.raw);
  if (exchange.status !== 201) return finish();
  const exId = exchange.data.id;

  const peek = await call('GET', `/exchanges/${exId}`, { token: outsider.token });
  check(peek.status === 403, 'an unrelated user cannot read the exchange', { status: peek.status });

  const visibleToT2 = await call('GET', `/exchanges/${exId}`, { token: tenant2.token });
  check(visibleToT2.status === 200, 'the other tenant in the exchange can read it', visibleToT2.raw);

  const a1 = await call('PATCH', `/exchanges/${exId}/approve`, { token: ownerA.token });
  check(a1.status === 200, 'initiator owner approves', a1.raw);
  const a2 = await call('PATCH', `/exchanges/${exId}/approve`, { token: ownerB.token });
  check(a2.status === 200 && a2.data.status === 'completed', 'target owner approves and the exchange completes', a2.raw);

  const t1After = await call('GET', '/exchanges/my-tenancy', { token: tenant1.token, expect: 200 });
  const t2After = await call('GET', '/exchanges/my-tenancy', { token: tenant2.token, expect: 200 });
  check(t1After.data && t1After.data.houseId === h2.id, 'tenant one now lives in house B1', t1After.data);
  check(t2After.data && t2After.data.houseId === h1.id, 'tenant two now lives in house A1', t2After.data);
  check(t1After.data && Number(t1After.data.agreedRent) === 500000, "tenant one's new rent is house B1's rent", t1After.data);

  const commissions = await call('GET', '/agents/me/commissions', { token: agent.token });
  check(commissions.status === 200, 'agent can list their commissions', commissions.raw);
  if (commissions.status === 200) {
    const list = Array.isArray(commissions.data) ? commissions.data : commissions.data.items || [];
    const types = list.map((c) => c.type).sort();
    check(types.filter((t) => t === 'exchange').length === 2, 'agent earned an exchange commission on both houses', list);
    check(types.includes('initial_placement'), 'agent still has the original placement commission', list);
  }

  console.log('\nMove to a vacant house');
  const houseA2 = await createVerifiedHouse(ownerA, admin, { title: 'A2', area: 'Mbezi', lat: lat + 0.05, lng: 39.2, rent: 700000 });
  await call('POST', `/houses/${houseA2.id}/agents`, {
    token: ownerA.token,
    body: { agentId: agentProfile.id, isPrimary: true },
    expect: 201,
  });
  const moveToOccupied = await call('POST', '/exchanges', {
    token: tenant2.token,
    body: { exchangeType: 'move', targetHouseId: h2.id },
  });
  check(moveToOccupied.status === 400, 'a move into an occupied house is rejected', moveToOccupied.raw);

  const move = await call('POST', '/exchanges', {
    token: tenant2.token,
    body: { exchangeType: 'move', targetHouseId: houseA2.id, notes: 'Need a bigger place' },
  });
  check(move.status === 201, 'tenant two requests a move to vacant house A2', move.raw);
  if (move.status === 201) {
    // Owner A owns both A1 (current) and A2 (target): one approval covers both sides.
    const mv = await call('PATCH', `/exchanges/${move.data.id}/approve`, { token: ownerA.token });
    check(mv.status === 200 && mv.data.status === 'completed', 'an owner of both houses completes the move in one approval', mv.raw);
    const t2Moved = await call('GET', '/exchanges/my-tenancy', { token: tenant2.token, expect: 200 });
    check(t2Moved.data && t2Moved.data.houseId === houseA2.id && Number(t2Moved.data.agreedRent) === 700000,
      'tenant two now rents A2 at its listed rent', t2Moved.data);
    const browse = await call('GET', '/houses', {});
    check(JSON.stringify(browse.data).includes(h1.id), 'vacated house A1 is listed again');
  }

  finish();
})().catch((e) => {
  console.error('\nJourney aborted:', e.message);
  failed++;
  finish();
});

function finish() {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

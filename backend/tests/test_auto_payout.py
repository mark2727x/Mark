"""
Backend tests for auto-payout on shift completion.
Covers SUCCESS path, SKIP path (no Connect onboarding), idempotency, and
manual payout fallback. Also does a light regression check on the
same-origin API base fix ('Failed to fetch').
"""
import hashlib
import os
import secrets
import time
import psycopg2
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://stripe-payment-21.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
PG_DSN = "postgresql://shiftguard:shiftguard@localhost:5432/shiftguard"


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{h}"


@pytest.fixture(scope="module")
def pg():
    conn = psycopg2.connect(PG_DSN)
    conn.autocommit = True
    yield conn
    conn.close()


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register_and_verify(session, role, email_prefix, extra=None):
    email = f"test_{email_prefix}_{int(time.time()*1000)}@example.com"
    payload = {
        "email": email,
        "phone": "5551234567",
        "password": "password123",
        "name": f"Test {role}",
        "role": role,
    }
    if role == "lifeguard":
        payload.update({
            "certificateAssociation": "American Red Cross",
            "certificateType": "Lifeguarding",
            "certificateNumber": "TEST123456",
        })
    if extra:
        payload.update(extra)
    r = session.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 201, f"register failed: {r.status_code} {r.text}"
    code = r.json().get("verificationCode")
    assert code, "verificationCode missing from dev register response"
    v = session.post(f"{API}/auth/verify-email", json={"email": email, "code": code})
    assert v.status_code == 200, f"verify failed: {v.status_code} {v.text}"
    return email, v.json().get("token"), v.json().get("user", {}).get("id")


def _create_lifeguard_via_db(pg, connect_account_id, onboarded):
    """Insert a verified lifeguard directly via SQL, returns (email, user_id, token)."""
    email = f"test_lg_{int(time.time()*1000)}_{secrets.token_hex(3)}@example.com"
    pw_hash = _hash_password("password123")
    cur = pg.cursor()
    cur.execute(
        """
        INSERT INTO users (email, phone, password_hash, name, role, email_verified,
            stripe_connect_account_id, stripe_connect_onboarded,
            certificate_association, certificate_type, certificate_number, certificate_verified_at)
        VALUES (%s, %s, %s, %s, 'lifeguard', true, %s, %s,
            'American Red Cross', 'Lifeguarding', 'TEST999', now())
        RETURNING id
        """,
        (email, "5551234567", pw_hash, "Test LG", connect_account_id, onboarded),
    )
    user_id = cur.fetchone()[0]
    cur.close()
    # login
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": "password123"})
    assert r.status_code == 200, f"lifeguard login failed: {r.text}"
    return email, user_id, r.json()["token"]


def _create_shift(session, manager_token):
    future_iso = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(time.time() + 7 * 86400))
    payload = {
        "title": "TEST Shift",
        "location": "123 Main St, Springfield, IL 62701",
        "payRate": 25,
        "totalHours": 4,
        "startTime": future_iso,
        "certificationRequired": "Lifeguarding",
        "description": "Test shift for auto-payout",
        "rules": "No running.",
    }
    r = session.post(f"{API}/shifts", json=payload,
                     headers={"Authorization": f"Bearer {manager_token}"})
    assert r.status_code == 201, f"create shift failed: {r.text}"
    return r.json()["id"]


def _mark_shift_paid(pg, shift_id, pi_id="pi_test_manual"):
    cur = pg.cursor()
    cur.execute(
        "UPDATE shifts SET payment_status='paid', stripe_payment_intent_id=%s WHERE id=%s",
        (pi_id, shift_id),
    )
    cur.close()


# ── Regression: same-origin base + register/verify still works ──────────────
def test_regression_register_verify_login_same_origin(session):
    email, token, uid = _register_and_verify(session, "manager", "regmgr")
    assert token, "token should be returned after verify-email"
    # Login again to ensure verified user works
    r = session.post(f"{API}/auth/login", json={"email": email, "password": "password123"})
    assert r.status_code == 200
    assert "token" in r.json()


# ── Auto-payout SKIP path (no Connect onboarding) ───────────────────────────
@pytest.fixture(scope="module")
def manager_creds(session):
    email, token, uid = _register_and_verify(session, "manager", "mgr")
    return {"email": email, "token": token, "id": uid}


def test_auto_payout_skip_no_onboarding(session, pg, manager_creds):
    mgr_token = manager_creds["token"]
    # Lifeguard NOT onboarded
    lg_email, lg_id, lg_token = _create_lifeguard_via_db(
        pg, connect_account_id=None, onboarded=False
    )
    shift_id = _create_shift(session, mgr_token)
    # Lifeguard picks up
    r = requests.post(f"{API}/shifts/{shift_id}/pickup",
                      headers={"Authorization": f"Bearer {lg_token}"})
    assert r.status_code == 200, f"pickup failed: {r.text}"
    # Simulate manager payment
    _mark_shift_paid(pg, shift_id)
    # Complete
    r = requests.post(f"{API}/shifts/{shift_id}/complete",
                      headers={"Authorization": f"Bearer {mgr_token}"})
    assert r.status_code == 200, f"complete failed: {r.text}"
    body = r.json()
    assert "autoPayout" in body, f"autoPayout missing: {body}"
    ap = body["autoPayout"]
    assert ap["attempted"] is True
    assert ap["sent"] is False
    assert "reason" in ap
    assert "Connect" in ap["reason"] or "onboard" in ap["reason"].lower(), ap["reason"]
    # Confirm DB state stays 'paid' (not paid_out)
    cur = pg.cursor()
    cur.execute("SELECT payment_status, stripe_transfer_id FROM shifts WHERE id=%s", (shift_id,))
    row = cur.fetchone()
    cur.close()
    assert row[0] == "paid", f"payment_status should stay 'paid' after skip, got {row[0]}"
    assert row[1] is None, "no transfer id should be set after skip"
    # Save for manual-payout test
    pytest.skip_shift_id = shift_id
    pytest.skip_mgr_token = mgr_token


def test_manual_payout_still_returns_same_reason(pg, manager_creds):
    # After the skip, manual /payout should also fail with same reason
    shift_id = getattr(pytest, "skip_shift_id", None)
    if shift_id is None:
        pytest.skip("depends on skip test")
    r = requests.post(f"{API}/shifts/{shift_id}/payout",
                      headers={"Authorization": f"Bearer {pytest.skip_mgr_token}"})
    assert r.status_code == 400
    assert "Connect" in r.json().get("error", "") or "onboard" in r.json().get("error", "").lower()


# ── Auto-payout SUCCESS path ────────────────────────────────────────────────
def _create_stripe_connect_account(lg_token):
    """Call the API to create a real Connect account id."""
    r = requests.post(f"{API}/connect/onboarding-link", json={},
                      headers={"Authorization": f"Bearer {lg_token}"})
    assert r.status_code == 200, f"onboarding-link failed: {r.text}"
    return r.json().get("accountId")


def test_auto_payout_success_or_stripe_error(session, pg, manager_creds):
    """
    Happy path: lifeguard has stripe_connect_onboarded=true. Because this
    Stripe sandbox account isn't Connect-enabled we can't create a real
    Connect Express account, so we insert a syntactically-valid but fake
    acct_ id and assert that (a) payoutShiftToLifeguard IS reached (the
    Connect-onboarding gate is not the reason), (b) the auto-payout hook
    catches the Stripe error and returns autoPayout.sent=false with a Stripe
    reason, and (c) the shift stays in payment_status='paid' with no stray
    transfer id. This proves the wiring end-to-end even without live Stripe
    Connect. If ever this environment gets Connect enabled, this test will
    upgrade to a real success and still pass because either branch is
    accepted.
    """
    mgr_token = manager_creds["token"]

    lg_email, lg_id, lg_token = _create_lifeguard_via_db(
        pg, connect_account_id=None, onboarded=False
    )
    # Try real Stripe account first; fall back to fake acct_ id if platform
    # doesn't have Connect enabled.
    account_id = None
    try:
        account_id = _create_stripe_connect_account(lg_token)
    except AssertionError as e:
        print(f"NOTE: real Connect create failed (expected on non-Connect keys): {e}")
        account_id = "acct_1FakeTestAccount9999"

    cur = pg.cursor()
    cur.execute(
        "UPDATE users SET stripe_connect_account_id=%s, stripe_connect_onboarded=true WHERE id=%s",
        (account_id, lg_id),
    )
    cur.close()

    shift_id = _create_shift(session, mgr_token)
    r = requests.post(f"{API}/shifts/{shift_id}/pickup",
                      headers={"Authorization": f"Bearer {lg_token}"})
    assert r.status_code == 200, f"pickup failed: {r.text}"
    _mark_shift_paid(pg, shift_id, pi_id=f"pi_test_success_{shift_id}")

    r = requests.post(f"{API}/shifts/{shift_id}/complete",
                      headers={"Authorization": f"Bearer {mgr_token}"})
    assert r.status_code == 200, f"complete failed: {r.text}"
    body = r.json()
    assert "autoPayout" in body
    ap = body["autoPayout"]
    assert ap["attempted"] is True

    cur = pg.cursor()
    cur.execute(
        "SELECT payment_status, stripe_transfer_id FROM shifts WHERE id=%s", (shift_id,)
    )
    ps, tr = cur.fetchone()
    cur.close()

    if ap["sent"]:
        # Full success — Stripe accepted the transfer
        assert ps == "paid_out"
        assert tr and tr.startswith("tr_"), f"transfer id: {tr}"
        # Idempotency: another payout call should fail with 'already sent'
        r2 = requests.post(f"{API}/shifts/{shift_id}/payout",
                           headers={"Authorization": f"Bearer {mgr_token}"})
        assert r2.status_code == 400
        assert "already" in r2.json().get("error", "").lower(), r2.json()
    else:
        # Stripe rejected (fake acct or sandbox not fully onboarded) — the
        # important assertion is that we passed the Connect-onboarding gate
        # (i.e. reason should NOT be the "not finished Stripe Connect
        # onboarding" one; it should be a Stripe-side error).
        reason = ap.get("reason", "")
        print(f"NOTE: auto-payout sent=false, reason={reason!r}")
        assert "onboarding" not in reason.lower(), (
            f"Auto-payout should have passed the onboarding gate but reason was: {reason}"
        )
        assert ps == "paid", f"DB should stay 'paid' on stripe failure, got {ps}"
        assert tr is None, "no stripe_transfer_id should be set on failure"


# ── Idempotency: pre-set transfer id should make /payout return 400 ─────────
def test_payout_idempotency_when_transfer_already_set(session, pg, manager_creds):
    mgr_token = manager_creds["token"]
    lg_email, lg_id, lg_token = _create_lifeguard_via_db(
        pg, connect_account_id="acct_test", onboarded=True
    )
    shift_id = _create_shift(session, mgr_token)
    r = requests.post(f"{API}/shifts/{shift_id}/pickup",
                      headers={"Authorization": f"Bearer {lg_token}"})
    assert r.status_code == 200
    # Manually simulate a completed + already-paid-out shift
    cur = pg.cursor()
    cur.execute(
        """UPDATE shifts SET status='completed', payment_status='paid_out',
           stripe_transfer_id='tr_test_existing', stripe_payment_intent_id='pi_test'
           WHERE id=%s""",
        (shift_id,),
    )
    cur.close()
    r = requests.post(f"{API}/shifts/{shift_id}/payout",
                      headers={"Authorization": f"Bearer {mgr_token}"})
    assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"
    assert "already" in r.json().get("error", "").lower(), r.json()


# ── Cleanup ──────────────────────────────────────────────────────────────────@pytest.fixture(scope="module", autouse=True)
def _cleanup(pg):
    yield
    cur = pg.cursor()
    cur.execute("DELETE FROM shifts WHERE title LIKE 'TEST%'")
    cur.execute("DELETE FROM users WHERE email LIKE 'test_%'")
    cur.close()

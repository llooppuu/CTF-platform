import os
import time

import requests
from bs4 import BeautifulSoup


BASE_URL = os.getenv("CTFD_URL", "http://ctfd:8000").rstrip("/")
SITE_NAME = os.getenv("CTFD_SITE_NAME", "Local CTF")
ADMIN_NAME = os.getenv("CTFD_ADMIN_NAME", "admin")
ADMIN_EMAIL = os.getenv("CTFD_ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("CTFD_ADMIN_PASSWORD", "change-me-now")
USER_MODE = os.getenv("CTFD_USER_MODE", "users")
WAIT_TIMEOUT_SECONDS = int(os.getenv("CTFD_WAIT_TIMEOUT_SECONDS", "120"))


def wait_for_ctfd() -> None:
    deadline = time.time() + WAIT_TIMEOUT_SECONDS

    while time.time() < deadline:
        try:
            response = requests.get(f"{BASE_URL}/login", timeout=5)
            if response.status_code in (200, 302):
                return
        except requests.RequestException:
            pass
        time.sleep(2)

    raise RuntimeError("Timed out waiting for CTFd to become reachable")


def parse_setup_nonce(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    nonce_input = soup.select_one("input[name='nonce']")
    return nonce_input["value"] if nonce_input and nonce_input.has_attr("value") else ""


def is_setup_page(response: requests.Response) -> bool:
    if response.status_code != 200:
        return False
    return parse_setup_nonce(response.text) != ""


def run_setup() -> None:
    session = requests.Session()
    setup_response = session.get(f"{BASE_URL}/setup", timeout=10)

    if not is_setup_page(setup_response):
        print("CTFd already initialized. Skipping auto-setup.")
        return

    nonce = parse_setup_nonce(setup_response.text)
    if not nonce:
        raise RuntimeError("Could not extract setup nonce from /setup")

    payload = {
        "ctf_name": SITE_NAME,
        "name": ADMIN_NAME,
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
        "user_mode": USER_MODE,
        "nonce": nonce,
    }

    submit = session.post(
        f"{BASE_URL}/setup",
        data=payload,
        timeout=15,
        allow_redirects=False,
    )

    if submit.status_code not in (200, 302, 303):
        raise RuntimeError(f"Setup submission failed: HTTP {submit.status_code}")

    verify = session.get(f"{BASE_URL}/setup", timeout=10)
    if is_setup_page(verify):
        raise RuntimeError("CTFd still shows /setup after bootstrap; check credentials and logs")

    print("CTFd setup completed successfully.")


if __name__ == "__main__":
    wait_for_ctfd()
    run_setup()
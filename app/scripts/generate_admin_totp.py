import base64
import secrets
import urllib.parse


def main() -> None:
    secret = base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")
    label = urllib.parse.quote("Reda1000IA:adminlopes")
    issuer = urllib.parse.quote("Reda1000IA")
    print(f"ADMIN_TOTP_SECRET={secret}")
    print(f"otpauth://totp/{label}?secret={secret}&issuer={issuer}&digits=6&period=30")


if __name__ == "__main__":
    main()

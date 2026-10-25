#!/usr/bin/env python3
import sys
import smtplib
from email.message import EmailMessage

def test_automation_setup() -> None:
    print("TEST: Automation pipeline triggered successfully!")
def test_automation_setup2() -> None:
    print("TEST: Automation pipeline triggered successfully!")

def send_email(sender_email: str, app_password: str, receiver_email: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = sender_email
    msg["To"] = receiver_email
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(sender_email, app_password)
        smtp.send_message(msg)


def main():
    # Args: sender_email app_password receiver_email subject body
    if len(sys.argv) < 6:
        print("Usage: email_sender.py <sender_email> <app_password> <receiver_email> <subject> <body>")
        sys.exit(2)

    sender_email = sys.argv[1]
    app_password = sys.argv[2]
    receiver_email = sys.argv[3]
    subject = sys.argv[4]
    body = " ".join(sys.argv[5:])

    try:
        send_email(sender_email, app_password, receiver_email, subject, body)
        print("OK")
        sys.exit(0)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 

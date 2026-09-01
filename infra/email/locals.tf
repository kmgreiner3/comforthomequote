locals {
  domain           = "comforthomequote.com"
  zone_id          = "Z09657963VZ2063QHF7JD" # comforthomequote.com zone, management account
  mail_from_domain = "mail.comforthomequote.com"
  inbox_address    = "info@comforthomequote.com"
  # Receive-only for now (Kyle, 2026-09-01): inbound mail to info@ forwards
  # to Dylan's personal inbox. Send-as can be added later with SMTP creds.
  forward_to = ["dylannadeau2@gmail.com"]
}

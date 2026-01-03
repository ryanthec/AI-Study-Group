import os
import requests
from typing import Optional

class EmailService:
    def __init__(self):
        # We replace SMTP credentials with Brevo API configuration
        self.api_url = "https://api.brevo.com/v3/smtp/email"
        self.api_key = os.getenv("BREVO_API_KEY", "")
        
        # Sender info needs to be a valid verified sender in Brevo
        self.sender_email = os.getenv("SMTP_SENDER", "noreply@yourdomain.com") 
        self.sender_name = os.getenv("SENDER_NAME", "AI Study Group App")
        
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

    def send_invitation_email(
        self,
        invitee_email: str,
        inviter_name: str,
        group_name: str,
        token: str
    ) -> bool:
        """Send study group invitation email via Brevo API"""
        try:
            invitation_link = f"{self.frontend_url}/invitations/accept?token={token}"
            subject = f"{inviter_name} invited you to join '{group_name}' study group"
            
            # The HTML body remains exactly the same as your design
            html_body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #1890ff;">Study Group Invitation</h2>
                        <p>Hi there,</p>
                        <p><strong>{inviter_name}</strong> has invited you to join the study group 
                        <strong>"{group_name}"</strong>.</p>
                        
                        <div style="margin: 30px 0;">
                            <a href="{invitation_link}" 
                               style="background-color: #1890ff; color: white; padding: 12px 24px; 
                                      text-decoration: none; border-radius: 4px; display: inline-block;">
                                Accept Invitation
                            </a>
                        </div>
                        
                        <p>Or copy and paste this link in your browser:</p>
                        <p style="color: #666; word-break: break-all;">{invitation_link}</p>
                        
                        <p style="margin-top: 30px; font-size: 12px; color: #999;">
                            This invitation will expire in 7 days. If you didn't expect this invitation, 
                            you can safely ignore this email.
                        </p>
                    </div>
                </body>
            </html>
            """
            
            # Construct the JSON payload for Brevo
            payload = {
                "sender": {
                    "name": self.sender_name,
                    "email": self.sender_email
                },
                "to": [
                    {
                        "email": invitee_email
                    }
                ],
                "subject": subject,
                "htmlContent": html_body
            }
            
            headers = {
                "accept": "application/json",
                "api-key": self.api_key,
                "content-type": "application/json"
            }

            # Send the request
            response = requests.post(self.api_url, json=payload, headers=headers)
            
            # Check for success (201 Created is typical for Brevo, but 200-299 is safe)
            if 200 <= response.status_code < 300:
                return True
            else:
                print(f"Failed to send email. Status: {response.status_code}, Response: {response.text}")
                return False

        except Exception as e:
            print(f"Failed to send invitation email: {e}")
            return False

email_service = EmailService()
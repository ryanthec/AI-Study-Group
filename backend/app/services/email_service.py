import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from typing import Optional

class EmailService:
    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.sender_email = os.getenv("SMTP_SENDER")
        self.sender_password = os.getenv("SMTP_PASSWORD")
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

    def send_invitation_email(
        self,
        invitee_email: str,
        inviter_name: str,
        group_name: str,
        token: str
    ) -> bool:
        """Send study group invitation email"""
        try:
            invitation_link = f"{self.frontend_url}/invitations/accept?token={token}"
            
            subject = f"{inviter_name} invited you to join '{group_name}' study group"
            
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
            
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = self.sender_email
            message["To"] = invitee_email
            
            html_part = MIMEText(html_body, "html")
            message.attach(html_part)
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(self.sender_email, self.sender_password)
                server.sendmail(self.sender_email, invitee_email, message.as_string())
            
            return True
        except Exception as e:
            print(f"Failed to send invitation email: {e}")
            return False

email_service = EmailService()

from flask import current_app
from flask_mail import Message, Mail
import logging

logger = logging.getLogger(__name__)

def send_otp_email(email, otp, name=None):
    """Send OTP verification email to patient"""
    try:
        mail = Mail(current_app)
        
        subject = "DocEasy - Verify Your Email"
        
        # HTML email template
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">DocEasy</h1>
                <p style="margin: 5px 0;">Your Health, Our Priority</p>
            </div>
            
            <div style="padding: 30px; background-color: #f5f5f5;">
                <h2 style="color: #333;">Email Verification</h2>
                <p style="color: #666;">Hello {name or 'there'},</p>
                <p style="color: #666;">Thank you for registering with DocEasy. Please use the following verification code to complete your registration:</p>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <h1 style="color: #1e40af; font-size: 36px; letter-spacing: 8px; margin: 0;">{otp}</h1>
                </div>
                
                <p style="color: #666;">This code will expire in 10 minutes.</p>
                <p style="color: #666;">If you didn't request this verification, please ignore this email.</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    This is an automated message from DocEasy. Please do not reply to this email.
                </p>
            </div>
            
            <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">© 2025 DocEasy. All rights reserved.</p>
                <p style="margin: 5px 0;">Connecting Patients with Quality Healthcare</p>
            </div>
        </div>
        """
        
        # Plain text version
        text_body = f"""
        DocEasy - Email Verification
        
        Hello {name or 'there'},
        
        Thank you for registering with DocEasy. Please use the following verification code to complete your registration:
        
        {otp}
        
        This code will expire in 10 minutes.
        
        If you didn't request this verification, please ignore this email.
        
        Best regards,
        The DocEasy Team
        """
        
        msg = Message(
            subject=subject,
            recipients=[email],
            html=html_body,
            body=text_body,
            sender=current_app.config.get('MAIL_DEFAULT_SENDER', 'DocEasy <doceasy4@gmail.com>')
        )
        
        mail.send(msg)
        logger.info(f"OTP email sent successfully to {email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send OTP email to {email}: {str(e)}")
        return False

def send_welcome_email(email, name):
    """Send welcome email after successful registration"""
    try:
        mail = Mail(current_app)
        
        subject = "Welcome to DocEasy!"
        
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Welcome to DocEasy!</h1>
            </div>
            
            <div style="padding: 30px; background-color: #f5f5f5;">
                <h2 style="color: #333;">Hello {name}!</h2>
                <p style="color: #666;">Your account has been successfully verified. You can now:</p>
                
                <ul style="color: #666;">
                    <li>Browse and book appointments with qualified doctors</li>
                    <li>Access your medical history</li>
                    <li>Attend video consultations</li>
                    <li>Manage your health profile</li>
                </ul>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:5173/dashboard/patient" 
                       style="background-color: #1e40af; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Go to Dashboard
                    </a>
                </div>
                
                <p style="color: #666;">If you have any questions, feel free to contact our support team.</p>
            </div>
            
            <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">© 2025 DocEasy. All rights reserved.</p>
            </div>
        </div>
        """
        
        msg = Message(
            subject=subject,
            recipients=[email],
            html=html_body,
            sender=current_app.config.get('MAIL_DEFAULT_SENDER', 'DocEasy <doceasy4@gmail.com>')
        )
        
        mail.send(msg)
        logger.info(f"Welcome email sent successfully to {email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send welcome email to {email}: {str(e)}")
        return False

def send_doctor_otp_email(email, otp, name=None):
    """Send OTP verification email to doctor"""
    try:
        mail = Mail(current_app)
        
        subject = "DocEasy - Doctor Registration Verification"
        
        # HTML email template
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">DocEasy</h1>
                <p style="margin: 5px 0;">Healthcare Professional Platform</p>
            </div>
            
            <div style="padding: 30px; background-color: #f5f5f5;">
                <h2 style="color: #333;">Doctor Registration Verification</h2>
                <p style="color: #666;">Hello Dr. {name or 'there'},</p>
                <p style="color: #666;">Thank you for joining DocEasy as a healthcare professional. Please use the following verification code to complete your email verification:</p>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <h1 style="color: #1e40af; font-size: 36px; letter-spacing: 8px; margin: 0;">{otp}</h1>
                </div>
                
                <p style="color: #666;">This code will expire in 10 minutes.</p>
                <p style="color: #666;">After email verification, you'll need to complete your profile and upload your medical credentials for admin verification.</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    This is an automated message from DocEasy. Please do not reply to this email.
                </p>
            </div>
            
            <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">© 2025 DocEasy. All rights reserved.</p>
                <p style="margin: 5px 0;">Connecting Healthcare Professionals with Patients</p>
            </div>
        </div>
        """
        
        # Plain text version
        text_body = f"""
        DocEasy - Doctor Registration Verification
        
        Hello Dr. {name or 'there'},
        
        Thank you for joining DocEasy as a healthcare professional. Please use the following verification code to complete your email verification:
        
        {otp}
        
        This code will expire in 10 minutes.
        
        After email verification, you'll need to complete your profile and upload your medical credentials for admin verification.
        
        Best regards,
        The DocEasy Team
        """
        
        msg = Message(
            subject=subject,
            recipients=[email],
            html=html_body,
            body=text_body,
            sender=current_app.config.get('MAIL_DEFAULT_SENDER', 'DocEasy <doceasy4@gmail.com>')
        )
        
        mail.send(msg)
        logger.info(f"Doctor OTP email sent successfully to {email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send doctor OTP email to {email}: {str(e)}")
        return False

def send_doctor_profile_submission_email(email, name):
    """Send confirmation email after doctor profile submission"""
    try:
        mail = Mail(current_app)
        
        subject = "DocEasy - Profile Submitted for Verification"
        
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">DocEasy</h1>
                <p style="margin: 5px 0;">Healthcare Professional Platform</p>
            </div>
            
            <div style="padding: 30px; background-color: #f5f5f5;">
                <h2 style="color: #333;">Profile Submitted Successfully!</h2>
                <p style="color: #666;">Dear Dr. {name},</p>
                <p style="color: #666;">Your profile and credentials have been successfully submitted to DocEasy. Our admin team will review your information and verify your credentials.</p>
                
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                    <h4 style="color: #856404; margin: 0 0 10px 0;">What happens next?</h4>
                    <ul style="color: #856404; margin: 0; padding-left: 20px;">
                        <li>Admin verification of your credentials (1-2 business days)</li>
                        <li>Email notification upon approval</li>
                        <li>Access to your doctor dashboard</li>
                        <li>Ability to receive patient appointments</li>
                    </ul>
                </div>
                
                <p style="color: #666;">You will receive an email notification once your profile is verified. Thank you for your patience.</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    This is an automated message from DocEasy. Please do not reply to this email.
                </p>
            </div>
            
            <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">© 2025 DocEasy. All rights reserved.</p>
            </div>
        </div>
        """
        
        msg = Message(
            subject=subject,
            recipients=[email],
            html=html_body,
            sender=current_app.config.get('MAIL_DEFAULT_SENDER', 'DocEasy <doceasy4@gmail.com>')
        )
        
        mail.send(msg)
        logger.info(f"Doctor profile submission email sent successfully to {email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send doctor profile submission email to {email}: {str(e)}")
        return False

def send_doctor_verification_result_email(email, name, approved):
    """Send email notification about verification result"""
    try:
        mail = Mail(current_app)
        
        if approved:
            subject = "DocEasy - Profile Approved! Welcome to Our Platform"
            status_color = "#28a745"
            status_bg = "#d4edda"
            status_text = "Approved"
            message = "Congratulations! Your profile has been approved and you can now start receiving patient appointments."
            action_text = "Go to Dashboard"
            action_url = "http://localhost:5173/dashboard/doctor"
        else:
            subject = "DocEasy - Profile Verification Update"
            status_color = "#dc3545"
            status_bg = "#f8d7da"
            status_text = "Requires Review"
            message = "Your profile needs additional review. Please check your credentials and contact support if needed."
            action_text = "Contact Support"
            action_url = "mailto:support@doceasy.com"
        
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">DocEasy</h1>
                <p style="margin: 5px 0;">Healthcare Professional Platform</p>
            </div>
            
            <div style="padding: 30px; background-color: #f5f5f5;">
                <h2 style="color: #333;">Profile Verification Update</h2>
                <p style="color: #666;">Dear Dr. {name},</p>
                
                <div style="background-color: {status_bg}; padding: 15px; border-radius: 8px; border-left: 4px solid {status_color}; margin: 20px 0; text-align: center;">
                    <h3 style="color: {status_color}; margin: 0;">Status: {status_text}</h3>
                </div>
                
                <p style="color: #666;">{message}</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{action_url}" 
                       style="background-color: #1e40af; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        {action_text}
                    </a>
                </div>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    This is an automated message from DocEasy. Please do not reply to this email.
                </p>
            </div>
            
            <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">© 2025 DocEasy. All rights reserved.</p>
            </div>
        </div>
        """
        
        msg = Message(
            subject=subject,
            recipients=[email],
            html=html_body,
            sender=current_app.config.get('MAIL_DEFAULT_SENDER', 'DocEasy <doceasy4@gmail.com>')
        )
        
        mail.send(msg)
        logger.info(f"Doctor verification result email sent successfully to {email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send doctor verification result email to {email}: {str(e)}")
        return False 

def send_password_reset_email(email, reset_token, user_name=None, user_role='user'):
    """Send password reset email with secure reset link"""
    try:
        mail = Mail(current_app)
        
        subject = "DocEasy - Password Reset Request"
        
        # Get frontend URL from environment or use default
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5173')
        reset_url = f"{frontend_url}/reset-password?token={reset_token}&email={email}"
        
        # Role-specific dashboard URLs
        if user_role == 'doctor':
            dashboard_url = f"{frontend_url}/dashboard/doctor"
            role_title = "Healthcare Professional"
        elif user_role == 'admin':
            dashboard_url = f"{frontend_url}/dashboard/admin"
            role_title = "Administrator"
        else:
            dashboard_url = f"{frontend_url}/dashboard/patient"
            role_title = "Patient"
        
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">DocEasy</h1>
                <p style="margin: 5px 0;">Your Health, Our Priority</p>
            </div>
            
            <div style="padding: 30px; background-color: #f5f5f5;">
                <h2 style="color: #333;">Password Reset Request</h2>
                <p style="color: #666;">Hello {user_name or 'there'},</p>
                <p style="color: #666;">We received a request to reset your password for your DocEasy {role_title} account.</p>
                
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                    <h4 style="color: #856404; margin: 0 0 10px 0;">Security Notice:</h4>
                    <p style="color: #856404; margin: 0; font-size: 14px;">
                        If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
                    </p>
                </div>
                
                <p style="color: #666;">To reset your password, click the button below:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" 
                       style="background-color: #1e40af; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block; 
                              font-weight: bold;">
                        Reset My Password
                    </a>
                </div>
                
                <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
                <p style="color: #666; font-size: 12px; background-color: #f8f9fa; padding: 10px; border-radius: 4px; word-break: break-all;">
                    {reset_url}
                </p>
                
                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                    <strong>Important:</strong> This link will expire in 1 hour for security reasons.
                </p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    This is an automated message from DocEasy. Please do not reply to this email.<br>
                    If you need help, contact our support team.
                </p>
            </div>
            
            <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">© 2025 DocEasy. All rights reserved.</p>
                <p style="margin: 5px 0;">Connecting Patients with Quality Healthcare</p>
            </div>
        </div>
        """
        
        # Plain text version
        text_body = f"""
        DocEasy - Password Reset Request
        
        Hello {user_name or 'there'},
        
        We received a request to reset your password for your DocEasy {role_title} account.
        
        To reset your password, copy and paste this link into your browser:
        {reset_url}
        
        Important: This link will expire in 1 hour for security reasons.
        
        If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
        
        Best regards,
        The DocEasy Team
        
        ---
        This is an automated message from DocEasy. Please do not reply to this email.
        """
        
        msg = Message(
            subject=subject,
            recipients=[email],
            html=html_body,
            body=text_body,
            sender=current_app.config.get('MAIL_DEFAULT_SENDER', 'DocEasy <doceasy4@gmail.com>')
        )
        
        mail.send(msg)
        logger.info(f"Password reset email sent successfully to {email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {str(e)}")
        return False

def send_password_reset_confirmation_email(email, user_name=None, user_role='user'):
    """Send confirmation email after successful password reset"""
    try:
        mail = Mail(current_app)
        
        subject = "DocEasy - Password Successfully Reset"
        
        # Get frontend URL from environment or use default
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5173')
        
        # Role-specific login URLs
        if user_role == 'doctor':
            login_url = f"{frontend_url}/login/doctor"
            role_title = "Healthcare Professional"
        elif user_role == 'admin':
            login_url = f"{frontend_url}/login/admin"
            role_title = "Administrator"
        else:
            login_url = f"{frontend_url}/login/patient"
            role_title = "Patient"
        
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">DocEasy</h1>
                <p style="margin: 5px 0;">Your Health, Our Priority</p>
            </div>
            
            <div style="padding: 30px; background-color: #f5f5f5;">
                <h2 style="color: #333;">Password Successfully Reset</h2>
                <p style="color: #666;">Hello {user_name or 'there'},</p>
                <p style="color: #666;">Your password for your DocEasy {role_title} account has been successfully reset.</p>
                
                <div style="background-color: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0; text-align: center;">
                    <h4 style="color: #155724; margin: 0;">✓ Password Reset Successful</h4>
                    <p style="color: #155724; margin: 5px 0; font-size: 14px;">You can now log in with your new password</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{login_url}" 
                       style="background-color: #1e40af; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block; 
                              font-weight: bold;">
                        Log In to DocEasy
                    </a>
                </div>
                
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                    <h4 style="color: #856404; margin: 0 0 10px 0;">Security Tips:</h4>
                    <ul style="color: #856404; margin: 0; padding-left: 20px; font-size: 14px;">
                        <li>Use a strong, unique password</li>
                        <li>Don't share your password with anyone</li>
                        <li>Log out when using shared computers</li>
                        <li>Contact support if you notice suspicious activity</li>
                    </ul>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                    If you didn't request this password reset, please contact our support team immediately.
                </p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    This is an automated message from DocEasy. Please do not reply to this email.<br>
                    If you need help, contact our support team.
                </p>
            </div>
            
            <div style="background-color: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">© 2025 DocEasy. All rights reserved.</p>
                <p style="margin: 5px 0;">Connecting Patients with Quality Healthcare</p>
            </div>
        </div>
        """
        
        msg = Message(
            subject=subject,
            recipients=[email],
            html=html_body,
            sender=current_app.config.get('MAIL_DEFAULT_SENDER', 'DocEasy <doceasy4@gmail.com>')
        )
        
        mail.send(msg)
        logger.info(f"Password reset confirmation email sent successfully to {email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send password reset confirmation email to {email}: {str(e)}")
        return False 
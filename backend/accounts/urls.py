from django.urls import path

from . import views

app_name = 'accounts'

urlpatterns = [
	path('signup/', views.signup, name='signup'),
	path('login/', views.login, name='login'),
	path('logout/', views.logout, name='logout'),
	path('forgot-password/', views.forgotpassword, name='forgotpassword'),
	path('verify-email/', views.verifyemail, name='verifyemail'),
	path('resend-verification/', views.resend_verification_email, name='resend_verification_email'),
    # JSON API endpoints for SPA
    path('api/csrf/', views.api_get_csrf, name='api_get_csrf'),
    path('api/login/', views.api_login, name='api_login'),
    path('api/logout/', views.api_logout_api, name='api_logout_api'),
    path('api/signup/', views.api_signup, name='api_signup'),
    path('api/me/', views.api_me, name='api_me'),
    path('api/admin/users/', views.api_admin_users, name='api_admin_users'),
	path('api/token/refresh/', views.DeletedUserSafeTokenRefreshView.as_view(), name='token_refresh'),
	path('api/password-reset/request/', views.api_password_reset_request, name='api_password_reset_request'),
	path('api/password-reset/verify/', views.api_password_reset_verify, name='api_password_reset_verify'),
	path('api/password-reset/confirm/', views.api_password_reset_confirm, name='api_password_reset_confirm'),
	path('api/support/', views.api_support_message, name='api_support_message'),
	path('api/verify-email/', views.api_verify_email, name='api_verify_email'),
	path('api/send-verification-email/', views.api_send_verification_email, name='api_send_verification_email'),
path('oauth/<str:provider>/', views.oauth_start, name='oauth_start'),
    path('oauth/<str:provider>/callback/', views.oauth_callback, name='oauth_callback'),
    path('api/oauth/exchange/', views.api_oauth_exchange, name='api_oauth_exchange'),
]
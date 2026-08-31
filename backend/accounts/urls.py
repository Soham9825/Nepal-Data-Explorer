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
]
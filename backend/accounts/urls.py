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
]
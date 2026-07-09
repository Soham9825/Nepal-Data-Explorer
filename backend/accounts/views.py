from django.shortcuts import render, redirect
from django.contrib.auth import login as auth_login, logout as auth_logout, authenticate
from .models import CustomUser, VerifiedEmail
from django.core.mail import send_mail
from functools import wraps
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
import random
import time
import re



def signup(request):
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        confirm_password = request.POST.get('confirm_password', '')

        if not re.match(r'^[A-Za-z0-9_]{3,30}$', username):
            return render(request, 'signup.html', {
                'error': 'Invalid Username'
            })

        if CustomUser.objects.filter(username=username).exists():
            return render(request, 'signup.html', {'error': 'Username already exists'})

        try:
            validate_email(email)
        except ValidationError:
            return render(request, 'signup.html', {'error': 'Invalid email address'})

        if CustomUser.objects.filter(email=email).exists():
            return render(request, 'signup.html', {'error': 'Email already exists'})

        if len(password) < 8:
            return render(request, 'signup.html', {'error': 'Password must be at least 8 characters'})

        if password != confirm_password:
            return render(request, 'signup.html', {'error': 'Passwords do not match'})

        request.session['pending_signup'] = {
            'username': username,
            'email': email,
            'password': password
        }

        code = f'{random.randint(100000, 999999)}'
        request.session['verification_code'] = code
        request.session['last_verification_sent'] = time.time()
        request.session.set_expiry(60 * 15)

        send_mail(
            subject='Verify Your email - Codehub',
            message=f'Use this code to verify your email: {code}',
            from_email='codehub@gmail.com',
            recipient_list=[email],
            fail_silently=False
        )

        return redirect('verifyemail')

    return render(request, 'signup.html', {'title': 'Signup'})


def login(request):
    if request.method == 'POST':
        identifier = request.POST.get('username')
        password = request.POST.get('password')
        remember_me = request.POST.get('remember_me')

        if not re.match(r'^[A-Za-z0-9_]{3,30}$', identifier):
            return render(request, 'login.html', {
                'error': 'Invalid Username'
            })

        user = authenticate(request, username=identifier, password=password)

        if user:
            auth_login(request, user)
            if remember_me:
                request.session.set_expiry(60 * 60 * 24 * 30)
            else:
                request.session.set_expiry(0)
            return redirect('/')
        else:
            return render(request, 'login.html',{'error':'Invalid Username or Password'})
        
    else:
        return render(request, 'login.html', {'title': 'Login'})
    


def logout(request):
    auth_logout(request)
    return redirect('login')

def forgotpassword(request):
    return render(request, 'forgotpassword.html', {'title': 'Forgot Password'})

def send_verification_email(user):
    code = f'{random.randint(100000,999999)}'
    VerifiedEmail.objects.update_or_create(user = user, defaults={'code':code})

    send_mail(
        subject='Verify Your email - Nepal Data Explorer',
        message=f'Use this code to verify your email {code}',
        from_email='nepaldataexplorer@gmail.com',
        recipient_list=[user.email],
        fail_silently=False)
    
def verifyemail(request):
    if request.method == "POST":
        entered_code = request.POST.get('code')
        stored_code = request.session.get('verification_code')
        signup_data = request.session.get('pending_signup')

        if not signup_data or not stored_code:
            return redirect('signup') 
        
        if not entered_code.isdigit():
            return render(request, 'verification.html', {'error': 'Code must be numeric'})

        if entered_code == stored_code:
            user = CustomUser.objects.create_user(
                username=signup_data['username'],
                email=signup_data['email'],
                password=signup_data['password']
            )
            user.is_verified = True
            user.save()

            del request.session['pending_signup']
            del request.session['verification_code']

            auth_login(request, user)
            return redirect('/')
        else:
            return render(request, 'verification.html', {'error': 'Verification code does not match'})

    return render(request, 'verification.html', {'title': 'Email Verification'})




def email_verification_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if request.user.is_authenticated and request.user.is_verified:
            return view_func(request, *args, **kwargs)
        else:
            return redirect('verification')
    return wrapper

def resend_verification_email(request):
    last_sent = request.session.get('last_verification_sent')
    now = time.time()

    if last_sent and now - last_sent < 60:
        wait_time = int(60 - (now - last_sent))
        return render(request, 'verification.html', {'error': f'Please wait {wait_time} seconds before resending the code.'})
    
    signup_data = request.session.get('pending_signup')
    if not signup_data:
        return redirect('signup')

    email = signup_data.get('email')
    code = f'{random.randint(100000, 999999)}'
    request.session['verification_code'] = code
    request.session['last_verification_sent'] = now

    send_mail(
        subject='Verify Your email - Nepal Data Explorer',
        message=f'Use this code to verify your email: {code}',
        from_email='nepaldataexplorer@gmail.com',
        recipient_list=[email],
        fail_silently=False
    )

    return redirect('verifyemail')




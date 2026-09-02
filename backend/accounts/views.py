from django.shortcuts import render, redirect
from django.contrib.auth import login as auth_login, logout as auth_logout, authenticate
from django.contrib.auth.hashers import make_password
from .models import CustomUser, VerifiedEmail
from django.core.mail import send_mail
from functools import wraps
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
import random
import time
import re
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.middleware.csrf import get_token
import json
import hashlib
import secrets
from datetime import timedelta
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from .models import PasswordResetToken



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
            'password_hash': make_password(password)
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
                password=None
            )
            user.password = signup_data['password_hash']
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


# --- JSON API helpers for SPA authentication ---


@ensure_csrf_cookie
def api_get_csrf(request):
    token = get_token(request)
    return JsonResponse({'csrfToken': token})


@require_POST
@csrf_protect
def api_login(request):
    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'detail': 'Invalid JSON'}, status=400)

    identifier = data.get('username') or data.get('email')
    password = data.get('password')
    remember_me = data.get('remember_me', False)

    if not identifier or not password:
        return JsonResponse({'detail': 'Missing credentials'}, status=400)

    # allow login by username or email
    user = authenticate(request, username=identifier, password=password)

    if not user:
        # try email lookup
        try:
            u = CustomUser.objects.get(email=identifier)
            user = authenticate(request, username=u.username, password=password)
        except CustomUser.DoesNotExist:
            user = None

    if user:
        auth_login(request, user)
        if remember_me:
            request.session.set_expiry(60 * 60 * 24 * 30)
        else:
            request.session.set_expiry(0)
        return JsonResponse({'username': user.username, 'email': user.email})
    else:
        return JsonResponse({'detail': 'Invalid credentials'}, status=401)


@require_POST
def api_logout_api(request):
    auth_logout(request)
    return JsonResponse({'detail': 'logged out'})


def api_me(request):
    try:
        user = request.user
    except Exception:
        user = None

    if user is not None and getattr(user, 'is_authenticated', False):
        return JsonResponse({'username': user.username, 'email': user.email})
    return JsonResponse({'detail': 'Not authenticated'}, status=401)


@require_POST
@csrf_protect
def api_signup(request):
    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'detail': 'Invalid JSON'}, status=400)

    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')

    if not re.match(r'^[A-Za-z0-9_]{3,30}$', username):
        return JsonResponse({'detail': 'Invalid Username'}, status=400)

    if CustomUser.objects.filter(username=username).exists():
        return JsonResponse({'detail': 'Username already exists'}, status=400)

    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({'detail': 'Invalid email address'}, status=400)

    if CustomUser.objects.filter(email=email).exists():
        return JsonResponse({'detail': 'Email already exists'}, status=400)

    if len(password) < 8:
        return JsonResponse({'detail': 'Password must be at least 8 characters'}, status=400)

    if password != confirm_password:
        return JsonResponse({'detail': 'Passwords do not match'}, status=400)

    user = CustomUser.objects.create_user(username=username, email=email, password=password)
    user.is_verified = True
    user.save()
    auth_login(request, user)
    return JsonResponse({'username': user.username, 'email': user.email})


def _json_body(request):
    try:
        return json.loads(request.body)
    except (TypeError, ValueError):
        return None


@require_POST
@csrf_protect
def api_password_reset_request(request):
    data = _json_body(request)
    email = (data or {}).get('email', '').strip().lower()
    if not email:
        return JsonResponse({'detail': 'Email is required.'}, status=400)

    user = CustomUser.objects.filter(email__iexact=email, is_active=True).first()
    if user:
        raw_token = secrets.token_urlsafe(32)
        PasswordResetToken.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())
        PasswordResetToken.objects.create(
            user=user,
            token_hash=PasswordResetToken.hash_token(raw_token),
            expires_at=timezone.now() + timedelta(minutes=30),
        )
        reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={raw_token}"
        send_mail(
            'Reset your Nepal Data Explorer password',
            f'Use this link within 30 minutes: {reset_url}',
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=True,
        )
    return JsonResponse({'detail': 'If that email exists, a password reset link has been sent.'})


@require_POST
@csrf_protect
def api_password_reset_confirm(request):
    data = _json_body(request)
    token = (data or {}).get('token', '')
    password = (data or {}).get('password', '')
    if not token or not password:
        return JsonResponse({'detail': 'Token and password are required.'}, status=400)
    reset = PasswordResetToken.objects.select_related('user').filter(token_hash=PasswordResetToken.hash_token(token)).first()
    if not reset or not reset.is_valid():
        return JsonResponse({'detail': 'Invalid or expired reset token.'}, status=400)
    try:
        validate_password(password, reset.user)
    except ValidationError as error:
        return JsonResponse({'detail': error.messages}, status=400)
    reset.user.set_password(password)
    reset.user.save(update_fields=['password'])
    reset.used_at = timezone.now()
    reset.save(update_fields=['used_at'])
    return JsonResponse({'detail': 'Password reset successfully.'})


OAUTH_PROVIDERS = {
    'google': {
        'client_id': 'GOOGLE_CLIENT_ID', 'client_secret': 'GOOGLE_CLIENT_SECRET', 'redirect_uri': 'GOOGLE_REDIRECT_URI',
        'authorize_url': 'https://accounts.google.com/o/oauth2/v2/auth', 'token_url': 'https://oauth2.googleapis.com/token',
        'scope': 'openid email profile',
    },
    'github': {
        'client_id': 'GITHUB_CLIENT_ID', 'client_secret': 'GITHUB_CLIENT_SECRET', 'redirect_uri': 'GITHUB_REDIRECT_URI',
        'authorize_url': 'https://github.com/login/oauth/authorize', 'token_url': 'https://github.com/login/oauth/access_token',
        'scope': 'read:user user:email',
    },
}


def _oauth_redirect(provider, error=None):
    suffix = f'?oauth_error={urlencode({"error": error})[6:]}' if error else '?oauth=success'
    return redirect(f'{settings.FRONTEND_URL.rstrip("/")}/login{suffix}')


def oauth_start(request, provider):
    config = OAUTH_PROVIDERS.get(provider)
    client_id = getattr(settings, config['client_id'], '') if config else ''
    if not config or not client_id:
        return _oauth_redirect(provider, 'provider_not_configured')
    state = secrets.token_urlsafe(32)
    request.session[f'oauth_state_{provider}'] = state
    request.session.set_expiry(600)
    params = {
        'client_id': client_id, 'redirect_uri': getattr(settings, config['redirect_uri']),
        'response_type': 'code', 'scope': config['scope'], 'state': state,
    }
    if provider == 'google':
        params['access_type'] = 'online'
    return redirect(f"{config['authorize_url']}?{urlencode(params)}")


def _oauth_request(url, data, headers=None):
    request = Request(url, data=urlencode(data).encode(), headers=headers or {'Accept': 'application/json'}, method='POST')
    with urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode())


def _oauth_user(provider, access_token):
    if provider == 'google':
        request = Request('https://openidconnect.googleapis.com/v1/userinfo', headers={'Authorization': f'Bearer {access_token}'})
        with urlopen(request, timeout=10) as response:
            profile = json.loads(response.read().decode())
        return profile.get('email'), profile.get('name') or profile.get('email', '').split('@')[0]

    request = Request('https://api.github.com/user', headers={'Authorization': f'Bearer {access_token}', 'Accept': 'application/vnd.github+json'})
    with urlopen(request, timeout=10) as response:
        profile = json.loads(response.read().decode())
    email = profile.get('email')
    if not email:
        with urlopen(Request('https://api.github.com/user/emails', headers={'Authorization': f'Bearer {access_token}', 'Accept': 'application/vnd.github+json'}), timeout=10) as response:
            emails = json.loads(response.read().decode())
        email = next((item['email'] for item in emails if item.get('primary') and item.get('verified')), None)
    return email, profile.get('name') or profile.get('login')


def oauth_callback(request, provider):
    config = OAUTH_PROVIDERS.get(provider)
    if not config or request.GET.get('error'):
        return _oauth_redirect(provider, request.GET.get('error', 'provider_error'))
    expected_state = request.session.pop(f'oauth_state_{provider}', None)
    if not expected_state or not secrets.compare_digest(expected_state, request.GET.get('state', '')):
        return _oauth_redirect(provider, 'invalid_state')
    try:
        token = _oauth_request(
            config['token_url'],
            {'client_id': getattr(settings, config['client_id']), 'client_secret': getattr(settings, config['client_secret']), 'code': request.GET.get('code', ''), 'redirect_uri': getattr(settings, config['redirect_uri'])},
            {'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded'},
        )
        email, display_name = _oauth_user(provider, token.get('access_token', ''))
        if not email:
            return _oauth_redirect(provider, 'verified_email_required')
        user = CustomUser.objects.filter(email__iexact=email).first()
        if not user:
            base = re.sub(r'[^A-Za-z0-9_]', '_', (display_name or email.split('@')[0]))[:20] or provider
            username = base
            while CustomUser.objects.filter(username=username).exists():
                username = f'{base[:15]}_{secrets.token_hex(3)}'
            user = CustomUser.objects.create_user(username=username, email=email, password=secrets.token_urlsafe(32))
        user.is_verified = True
        user.save(update_fields=['is_verified'])
        auth_login(request, user)
        return _oauth_redirect(provider)
    except Exception:
        return _oauth_redirect(provider, 'oauth_request_failed')




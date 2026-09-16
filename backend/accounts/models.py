from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
import uuid
import hashlib
from django.utils import timezone
from django.utils.text import slugify
from datetime import timedelta
from django.conf import settings

class CustomUserManager(BaseUserManager):
    def create_user(self, username,email, password = None):
        if not username:
            raise ValueError("Username is required")
        if not email:
            raise ValueError('Email is required')
        user = self.model(username = username, email = self.normalize_email(email))
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, username,email, password):
        user = self.create_user(username =username, email = email,  password = password)
        user.is_superuser = True
        user.is_staff = True
        user.is_active = True
        user.save(using = self._db)
        return user
    

class CustomUser(AbstractBaseUser,PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=25, unique=True)
    email = models.EmailField(unique=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    objects = CustomUserManager()

    def __str__(self):
        return self.username

class Role(models.Model):
    name = models.CharField(max_length=25)
    users = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='roles')

    def __str__(self):
        return self.name
    

class VerifiedEmail(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_expired(self):
        return timezone.now() > self.created_at + timedelta(minutes=15)
    
    def __str__(self):
        return f"Verification for {self.user.username} - Code : {self.code}"


class PasswordResetToken(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    def is_valid(self):
        return self.used_at is None and timezone.now() < self.expires_at

    @staticmethod
    def hash_token(token):
        return hashlib.sha256(token.encode()).hexdigest()


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="password_reset_otps")
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)

    def is_valid(self):
        return self.used_at is None and self.attempts < 5 and timezone.now() < self.expires_at


class EmailVerificationToken(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="email_verification_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    def is_valid(self):
        return self.used_at is None and timezone.now() < self.expires_at

    @staticmethod
    def hash_token(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def __str__(self):
        return f"Email verification for {self.user.username} ({self.email})"



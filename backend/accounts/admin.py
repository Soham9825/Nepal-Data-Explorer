from django.contrib import admin
from .models import (
    CustomUser, Role, VerifiedEmail, EmailVerificationToken
)
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin



class CustomUserAdmin(BaseUserAdmin):
    model = CustomUser
    list_display = ('username', 'email', 'is_verified', 'email_verified', 'is_staff', 'is_superuser')
    list_filter = ('is_verified', 'email_verified', 'is_staff', 'is_superuser')
    search_fields = ('username', 'email')
    ordering = ('username',)
    fieldsets = (
        (None, {'fields': ('username', 'email', 'password')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'is_verified', 'email_verified', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login',)}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2', 'is_verified', 'email_verified', 'is_staff', 'is_superuser')}
        ),
    )


class VerifiedEmailAdmin(admin.ModelAdmin):
    list_display = ('user', 'code', 'created_at')
    search_fields = ('user__username', 'user__email')


class RoleAdmin(admin.ModelAdmin):
    list_display = ('name',)
    filter_horizontal = ('users',)


class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'email', 'created_at', 'expires_at', 'used_at')
    search_fields = ('user__username', 'user__email', 'email')
    list_filter = ('used_at',)


admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(Role, RoleAdmin)
admin.site.register(VerifiedEmail, VerifiedEmailAdmin)
admin.site.register(EmailVerificationToken, EmailVerificationTokenAdmin)
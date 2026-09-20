from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings


class DeletedUserSafeTokenRefreshSerializer(TokenRefreshSerializer):
    """Rejects refresh tokens for deleted/inactive users and blacklists them.

    The stock refresh serializer raises an uncaught ``CustomUser.DoesNotExist``
    (a 500) when the user was hard-deleted, and the token stays usable so it
    keeps issuing new pairs. This override fails cleanly with 401 and
    immediately blacklists the offending refresh token.
    """

    default_error_messages = {
        "user_not_found": "The account no longer exists.",
    }

    def validate(self, attrs):
        refresh = self.token_class(attrs["refresh"])

        user_id = refresh.payload.get(api_settings.USER_ID_CLAIM)
        if user_id:
            user_model = get_user_model()
            user = user_model.objects.filter(pk=user_id).first()
            if user is None or not api_settings.USER_AUTHENTICATION_RULE(user):
                try:
                    refresh.blacklist()
                except AttributeError:
                    pass
                if user is None:
                    raise AuthenticationFailed(
                        self.error_messages["user_not_found"],
                        "user_not_found",
                    )
                raise AuthenticationFailed(
                    self.error_messages["no_active_account"],
                    "no_active_account",
                )

        return super().validate(attrs)
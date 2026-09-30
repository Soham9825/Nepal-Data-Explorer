from django.test import TestCase
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch
from rest_framework.test import APIClient

from accounts.models import CustomUser, EmailVerificationToken
from analytics.ml.moderation import find_profanity
import re


class ModerationTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(
			username='supporttester', email='user_email@gmail.com', password='test-password'
		)
		self.user.email_verified = True
		self.user.save(update_fields=['email_verified'])
		self.client.force_authenticate(user=self.user)

	def test_normal_text_is_not_profane(self):
		self.assertFalse(find_profanity('Please help me understand the tourism data.'))

	def test_nepali_and_variation_profanity(self):
		for message in ('muji', 'RAANDI', 'raanddii', 'r@ndi', 'r.a.n.d.i', 'randi ko ban', 'khatey'):
			with self.subTest(message=message):
				self.assertTrue(find_profanity(message))

	def test_similar_normal_words_are_not_profane(self):
		self.assertFalse(find_profanity('The brand image and candidate ranking are useful.'))

	@patch('accounts.views.EmailMessage')
	@patch('accounts.views.moderate_message')
	def test_support_uses_authenticated_email(self, mock_moderate, mock_email):
		mock_moderate.return_value.as_dict.return_value = {
			'allowed': True, 'status': 'allowed', 'message': 'Message accepted.',
		}
		mock_moderate.return_value.allowed = True
		response = self.client.post(reverse('accounts:api_support_message'), data={
			'name': 'A User', 'email': 'attacker@example.com', 'subject': 'Question', 'message': 'Hello there',
		}, content_type='application/json')
		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.json().get('success'))
		self.assertEqual(mock_email.call_args.kwargs['reply_to'], [self.user.email])
		mock_email.return_value.send.assert_called_once_with(fail_silently=False)

	@patch('accounts.views.send_mail')
	@patch('accounts.views.moderate_message')
	def test_blocked_message_is_not_emailed(self, mock_moderate, mock_send_mail):
		mock_moderate.return_value.as_dict.return_value = {
			'allowed': False, 'status': 'blocked', 'message': 'Blocked.',
		}
		mock_moderate.return_value.allowed = False
		response = self.client.post(reverse('accounts:api_support_message'), data={
			'name': 'A User', 'email': 'attacker@example.com', 'subject': 'Question', 'message': 'muji',
		}, content_type='application/json')
		self.assertEqual(response.status_code, 400)
		mock_send_mail.assert_not_called()

	@override_settings(DEFAULT_FROM_EMAIL='nepaldataexplorer@gmail.com')
	@patch('accounts.views.EmailMessage')
	@patch('accounts.views.moderate_message')
	def test_support_sends_after_moderation_with_reply_to_user(self, mock_moderate, mock_email):
		mock_moderate.return_value.as_dict.return_value = {
			'allowed': True, 'status': 'allowed', 'message': 'Message accepted.',
		}
		mock_moderate.return_value.allowed = True
		response = self.client.post(reverse('accounts:api_support_message'), data={
			'name': 'A User', 'email': 'attacker@example.com', 'subject': 'Question', 'message': 'Hello there',
		}, content_type='application/json')
		self.assertEqual(response.status_code, 200)
		mock_email.assert_called_once()
		self.assertEqual(mock_email.call_args.kwargs['to'], ['nepaldataexplorer@gmail.com'])
		self.assertIn('Hello there', mock_email.call_args.kwargs['body'])
		self.assertEqual(mock_email.call_args.kwargs['reply_to'], [self.user.email])
		mock_email.return_value.send.assert_called_once_with(fail_silently=False)


class EmailVerificationTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(
			username='verifytester', email='verify_user@gmail.com', password='test-password'
		)
		self.user.email_verified = False
		self.user.save(update_fields=['email_verified'])
		self.client.force_authenticate(user=self.user)

	def test_send_verification_email_creates_token_and_sends(self):
		with patch('accounts.views.send_mail') as mock_send:
			response = self.client.post(reverse('accounts:api_send_verification_email'), content_type='application/json')
		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.json().get('success'))
		token = EmailVerificationToken.objects.get(user=self.user)
		self.assertTrue(token.is_valid())
		mock_send.assert_called_once()
		subject = mock_send.call_args.kwargs['subject']
		body = mock_send.call_args.kwargs['message']
		self.assertIn('verify your email', subject.lower())
		self.assertIn('verify-email?token=', body)

	def test_send_verification_email_already_verified(self):
		self.user.email_verified = True
		self.user.save(update_fields=['email_verified'])
		response = self.client.post(reverse('accounts:api_send_verification_email'), content_type='application/json')
		self.assertEqual(response.status_code, 200)
		self.assertIn('already verified', response.json()['detail'].lower())

	def test_verify_email_with_valid_token(self):
		raw = 'valid-raw-token'
		EmailVerificationToken.objects.create(
			user=self.user, token_hash=EmailVerificationToken.hash_token(raw), email=self.user.email,
			expires_at=timezone.now() + timedelta(hours=24))
		response = self.client.post(reverse('accounts:api_verify_email'), data={'token': raw}, content_type='application/json')
		self.assertEqual(response.status_code, 200)
		data = response.json()
		self.assertTrue(data.get('success'))
		self.assertIn('access', data)
		self.user.refresh_from_db()
		self.assertTrue(self.user.email_verified)
		self.assertTrue(self.user.is_verified)

	def test_verify_email_invalid_token(self):
		response = self.client.post(reverse('accounts:api_verify_email'), data={'token': 'does-not-exist'}, content_type='application/json')
		self.assertEqual(response.status_code, 400)

	def test_verify_email_expired_token(self):
		raw = 'expired-raw-token'
		EmailVerificationToken.objects.create(
			user=self.user, token_hash=EmailVerificationToken.hash_token(raw), email=self.user.email,
			expires_at=timezone.now() - timedelta(hours=1))
		response = self.client.post(reverse('accounts:api_verify_email'), data={'token': raw}, content_type='application/json')
		self.assertEqual(response.status_code, 400)
		self.user.refresh_from_db()
		self.assertFalse(self.user.email_verified)

	def test_verify_email_used_token_is_not_reusable(self):
		raw = 'used-once-token'
		record = EmailVerificationToken.objects.create(
			user=self.user, token_hash=EmailVerificationToken.hash_token(raw), email=self.user.email,
			expires_at=timezone.now() + timedelta(hours=24))
		record.used_at = timezone.now()
		record.save(update_fields=['used_at'])
		response = self.client.post(reverse('accounts:api_verify_email'), data={'token': raw}, content_type='application/json')
		self.assertEqual(response.status_code, 400)


class SignupVerificationFlowTests(TestCase):
	"""New signups must stay unverified until the emailed link is clicked."""

	def setUp(self):
		self.client = APIClient()

	def test_signup_does_not_verify_or_issue_tokens(self):
		with patch('accounts.views.send_mail') as mock_send:
			response = self.client.post(reverse('accounts:api_signup'), data={
				'username': 'newbie', 'email': 'newbie@gmail.com',
				'password': 'Strong-pass-123', 'confirm_password': 'Strong-pass-123',
			}, content_type='application/json')
		self.assertEqual(response.status_code, 200)
		data = response.json()
		self.assertNotIn('access', data)
		self.assertNotIn('refresh', data)
		user = CustomUser.objects.get(username='newbie')
		self.assertFalse(user.is_verified)
		self.assertFalse(user.email_verified)
		mock_send.assert_called_once()


class SupportMessageVerifiedEmailTests(TestCase):
	"""Case 1: unverified email users cannot send support messages."""

	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(
			username='unverifiedtester', email='unverified@gmail.com', password='test-password'
		)
		self.user.email_verified = False
		self.user.save(update_fields=['email_verified'])
		self.client.force_authenticate(user=self.user)

	@patch('accounts.views.EmailMessage')
	@patch('accounts.views.moderate_message')
	def test_unverified_email_is_rejected_without_sending(self, mock_moderate, mock_email):
		mock_moderate.return_value.as_dict.return_value = {
			'allowed': True, 'status': 'allowed', 'message': 'Message accepted.',
		}
		mock_moderate.return_value.allowed = True
		response = self.client.post(reverse('accounts:api_support_message'), data={
			'name': 'A User', 'subject': 'Question', 'message': 'I need help with the tourism dashboard.',
		}, content_type='application/json')
		self.assertEqual(response.status_code, 400)
		self.assertFalse(response.json().get('success'))
		self.assertIn('verify your email', response.json()['detail'].lower())
		mock_email.assert_not_called()
		mock_email.return_value.send.assert_not_called()
		mock_moderate.assert_not_called()


class SupportMessageErrorCasesTests(TestCase):
	"""Case 4: invalid email format and Case 5: email send failure."""

	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(
			username='sendingtester', email='good@gmail.com', password='test-password'
		)
		self.user.email_verified = True
		self.user.save(update_fields=['email_verified'])
		self.client.force_authenticate(user=self.user)

	@patch('accounts.views.EmailMessage')
	@patch('accounts.views.moderate_message')
	def test_invalid_email_format_returns_400(self, mock_moderate, mock_email):
		CustomUser.objects.filter(pk=self.user.pk).update(email='not-an-email')
		self.client.force_authenticate(user=CustomUser.objects.get(pk=self.user.pk))
		mock_moderate.return_value.as_dict.return_value = {
			'allowed': True, 'status': 'allowed', 'message': 'Message accepted.',
		}
		mock_moderate.return_value.allowed = True
		response = self.client.post(reverse('accounts:api_support_message'), data={
			'name': 'A User', 'subject': 'Question', 'message': 'I need help.',
		}, content_type='application/json')
		self.assertEqual(response.status_code, 400)
		self.assertFalse(response.json().get('success'))
		mock_email.assert_not_called()

	@patch('accounts.views.EmailMessage', autospec=True)
	@patch('accounts.views.moderate_message')
	def test_email_send_failure_returns_503(self, mock_moderate, mock_email):
		mock_moderate.return_value.as_dict.return_value = {
			'allowed': True, 'status': 'allowed', 'message': 'Message accepted.',
		}
		mock_moderate.return_value.allowed = True
		mock_email.return_value.send.side_effect = Exception('SMTP failure')
		response = self.client.post(reverse('accounts:api_support_message'), data={
			'name': 'A User', 'subject': 'Question', 'message': 'This is a test message.',
		}, content_type='application/json')
		self.assertEqual(response.status_code, 503)
		self.assertFalse(response.json().get('success'))
		self.assertIn('could not send', response.json()['detail'].lower())


class SupportMessageHappytPathVerifiedTests(TestCase):
	"""Case 2: verified email + clean message -> 200 success."""

	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(
			username='happytester', email='happy@gmail.com', password='test-password'
		)
		self.user.email_verified = True
		self.user.save(update_fields=['email_verified'])
		self.client.force_authenticate(user=self.user)

	@patch('accounts.views.EmailMessage')
	@patch('accounts.views.moderate_message')
	def test_verified_clean_message_returns_success(self, mock_moderate, mock_email):
		mock_moderate.return_value.as_dict.return_value = {
			'allowed': True, 'status': 'allowed', 'message': 'Message accepted.',
		}
		mock_moderate.return_value.allowed = True
		response = self.client.post(reverse('accounts:api_support_message'), data={
			'name': 'A User', 'subject': 'Question', 'message': 'I need help with the tourism dashboard.',
		}, content_type='application/json')
		self.assertEqual(response.status_code, 200)
		data = response.json()
		self.assertTrue(data.get('success'))
		mock_email.return_value.send.assert_called_once_with(fail_silently=False)


class SupportMessageModerationRejectionTests(TestCase):
	"""Case 3: verified email + toxic message -> 400, no email."""

	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(
			username='rejectedtester', email='rejected@gmail.com', password='test-password'
		)
		self.user.email_verified = True
		self.user.save(update_fields=['email_verified'])
		self.client.force_authenticate(user=self.user)

	@patch('accounts.views.EmailMessage')
	@patch('accounts.views.moderate_message')
	def test_toxic_message_is_rejected_without_email(self, mock_moderate, mock_email):
		mock_moderate.return_value.as_dict.return_value = {
			'allowed': False, 'status': 'blocked', 'message': 'Your message was blocked because it appears toxic.',
		}
		mock_moderate.return_value.allowed = False
		response = self.client.post(reverse('accounts:api_support_message'), data={
			'name': 'A User', 'subject': 'Question', 'message': 'You are terrible and worthless.',
		}, content_type='application/json')
		self.assertEqual(response.status_code, 400)
		data = response.json()
		self.assertFalse(data.get('success'))
		self.assertEqual(data.get('status'), 'blocked')
		mock_email.assert_not_called()
		mock_email.return_value.send.assert_not_called()


class RefreshTokenDeletedUserTests(TestCase):
	"""Refresh must reject and blacklist tokens for deleted/inactive users."""

	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(
			username='ghostuser', email='ghost@gmail.com', password='Ghost-pass-123'
		)
		self.user.email_verified = True
		self.user.save(update_fields=['email_verified'])

	def _login_tokens(self):
		response = self.client.post(reverse('accounts:api_login'), data={
			'username': 'ghostuser', 'password': 'Ghost-pass-123',
		}, content_type='application/json')
		self.assertEqual(response.status_code, 200)
		return response.json()

	def test_refresh_works_for_existing_user(self):
		tokens = self._login_tokens()
		response = self.client.post(reverse('accounts:token_refresh'), data={
			'refresh': tokens['refresh'],
		}, content_type='application/json')
		self.assertEqual(response.status_code, 200)
		self.assertIn('access', response.json())
		self.assertIn('refresh', response.json())

	def test_refresh_rejected_and_blacklisted_for_deleted_user(self):
		tokens = self._login_tokens()
		self.client.force_authenticate(user=None)
		user_pk = self.user.pk
		self.user.delete()

		response = self.client.post(reverse('accounts:token_refresh'), data={
			'refresh': tokens['refresh'],
		}, content_type='application/json')
		self.assertEqual(response.status_code, 401)
		self.assertEqual(response.json().get('detail'), 'The account no longer exists.')

		from rest_framework_simplejwt.tokens import RefreshToken
		from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
		refresh = RefreshToken(tokens['refresh'], verify=False)
		outstanding = OutstandingToken.objects.filter(jti=refresh.payload['jti']).first()
		self.assertIsNotNone(outstanding)
		self.assertTrue(BlacklistedToken.objects.filter(token=outstanding).exists(), 'refresh token should be blacklisted')

	def test_refresh_rejected_for_inactive_user(self):
		tokens = self._login_tokens()
		CustomUser.objects.filter(pk=self.user.pk).update(is_active=False)

		response = self.client.post(reverse('accounts:token_refresh'), data={
			'refresh': tokens['refresh'],
		}, content_type='application/json')
		self.assertEqual(response.status_code, 401)
		self.assertEqual(response.json().get('detail'), 'No active account found for the given token.')


class PasswordResetReuseTests(TestCase):
	"""New password must differ from the current one."""

	def setUp(self):
		self.user = CustomUser.objects.create_user(
			username='resettester', email='reset@gmail.com', password='Old-pass-123'
		)

	def _reset_token(self):
		with patch('accounts.views.send_mail') as mock_send:
			response = self.client.post(reverse('accounts:api_password_reset_request'), data={
				'email': 'reset@gmail.com',
			}, content_type='application/json')
			self.assertEqual(response.status_code, 200)
		otp = re.search(r'password reset code is (\d{6})', mock_send.call_args[0][1]).group(1)
		response = self.client.post(reverse('accounts:api_password_reset_verify'), data={
			'email': 'reset@gmail.com', 'otp': otp,
		}, content_type='application/json')
		self.assertEqual(response.status_code, 200)
		return response.json()['reset_token']

	def test_same_password_is_rejected(self):
		token = self._reset_token()
		response = self.client.post(reverse('accounts:api_password_reset_confirm'), data={
			'reset_token': token, 'password': 'Old-pass-123',
		}, content_type='application/json')
		self.assertEqual(response.status_code, 400)
		self.assertIn('previous password', response.json()['detail'])
		self.assertTrue(CustomUser.objects.get(pk=self.user.pk).check_password('Old-pass-123'))

	def test_different_password_is_accepted(self):
		token = self._reset_token()
		response = self.client.post(reverse('accounts:api_password_reset_confirm'), data={
			'reset_token': token, 'password': 'New-pass-456',
		}, content_type='application/json')
		self.assertEqual(response.status_code, 200)
		user = CustomUser.objects.get(pk=self.user.pk)
		self.assertTrue(user.check_password('New-pass-456'))
		self.assertFalse(user.check_password('Old-pass-123'))

def _anonymous_account():
	"""Invent a throwaway account so no example username, email or password is stored
	here. These rows only ever reach Django's separate test database."""
	import uuid
	token = uuid.uuid4().hex
	return {
		'username': f'user-{token[:12]}',
		'email': f'{token}@example.invalid',
		'password': uuid.uuid4().hex,
	}


def _png(size=(1200, 600), fmt='PNG'):
	import io
	from PIL import Image
	buffer = io.BytesIO()
	Image.new('RGB', size, (30, 90, 200)).save(buffer, format=fmt)
	return buffer.getvalue()


class AvatarUploadTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(**_anonymous_account())
		self.client.force_authenticate(user=self.user)

	def upload(self, payload, filename='upload.png', content_type='image/png'):
		import io
		return self.client.patch(
			reverse('accounts:api_profile'),
			{'avatar': (io.BytesIO(payload), filename)},
			format='multipart',
			HTTP_CONTENT_TYPE=content_type,
		)

	def avatar_path(self):
		return reverse('accounts:avatar', args=[self.user.pk])

	def test_upload_stores_square_bytes_in_the_database(self):
		from accounts.models import Profile
		from PIL import Image
		import io
		self.assertFalse(Profile.objects.filter(user=self.user).exists())

		response = self.upload(_png())

		self.assertEqual(response.status_code, 200)
		stored = Profile.objects.get(user=self.user)
		with Image.open(io.BytesIO(bytes(stored.avatar))) as image:
			self.assertEqual(image.size, (256, 256))
			self.assertEqual(image.format, 'PNG')

	def test_avatar_url_is_relative_and_versioned(self):
		avatar_url = self.upload(_png()).json()['avatarUrl']

		# Relative on purpose: an absolute URL built from the Host header could be
		# poisoned and then persisted in the browser's cached user object.
		self.assertFalse(avatar_url.startswith('http'))
		self.assertTrue(avatar_url.startswith('/'))
		self.assertIn(f'/api/avatar/{self.user.pk}/', avatar_url)
		self.assertIn('?v=', avatar_url)

	def test_patch_without_an_avatar_or_removal_is_rejected(self):
		response = self.client.patch(
			reverse('accounts:api_profile'), {'misnamed': 'value'}, format='multipart'
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn('avatar', response.json()['detail'])

	def test_serving_the_avatar_returns_the_stored_image(self):
		from PIL import Image
		import io
		self.upload(_png())

		response = self.client.get(self.avatar_path())

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response['Content-Type'], 'image/png')
		self.assertEqual(response['Cache-Control'], 'private, max-age=86400')
		with Image.open(io.BytesIO(response.content)) as image:
			self.assertEqual(image.size, (256, 256))

	def test_etag_turns_a_repeat_request_into_a_304(self):
		self.upload(_png())
		path = self.avatar_path()

		first = self.client.get(path)
		second = self.client.get(path, HTTP_IF_NONE_MATCH=first['ETag'])

		self.assertEqual(first.status_code, 200)
		self.assertTrue(first['ETag'].startswith('"'))
		self.assertEqual(second.status_code, 304)
		self.assertEqual(second.content, b'')

	def test_requesting_a_missing_avatar_is_404(self):
		self.assertEqual(self.client.get(self.avatar_path()).status_code, 404)

	def test_user_without_an_avatar_reports_null_url(self):
		response = self.client.get(reverse('accounts:api_profile'))

		self.assertEqual(response.status_code, 200)
		self.assertIsNone(response.json()['avatarUrl'])

	def test_non_image_declared_as_png_is_rejected(self):
		from accounts.models import Profile
		response = self.upload(b'<html><script>alert(1)</script></html>', filename='fake.png')

		self.assertEqual(response.status_code, 400)
		self.assertIn('readable image', response.json()['detail'])
		self.assertFalse(Profile.objects.filter(user=self.user).exists())

	def test_disallowed_format_is_rejected(self):
		import io
		from PIL import Image
		buffer = io.BytesIO()
		Image.new('RGB', (60, 60), (200, 0, 0)).save(buffer, format='GIF')

		response = self.upload(buffer.getvalue(), filename='anim.gif', content_type='image/gif')

		self.assertEqual(response.status_code, 400)
		self.assertIn('JPG, PNG or WebP', response.json()['detail'])

	def test_oversized_upload_is_rejected(self):
		from accounts.models import Profile
		response = self.upload(b'\x89PNG\r\n\x1a\n' + b'0' * (5 * 1024 * 1024 + 10))

		self.assertEqual(response.status_code, 400)
		self.assertIn('5 MB', response.json()['detail'])
		self.assertFalse(Profile.objects.filter(user=self.user).exists())

	def test_another_account_cannot_inherit_the_avatar(self):
		from accounts.models import Profile
		self.upload(_png((400, 400), 'PNG'))
		other = CustomUser.objects.create_user(**_anonymous_account())
		other_client = APIClient()
		other_client.force_authenticate(user=other)

		payload = other_client.get(reverse('accounts:api_profile')).json()

		self.assertIsNone(payload['avatarUrl'])
		self.assertFalse(Profile.objects.filter(user=other).exists())

	def test_two_accounts_keep_independent_avatars(self):
		from accounts.models import Profile
		import io
		other = CustomUser.objects.create_user(**_anonymous_account())
		self.upload(_png((400, 400), 'PNG'))

		other_client = APIClient()
		other_client.force_authenticate(user=other)
		other_client.patch(
			reverse('accounts:api_profile'),
			{'avatar': (io.BytesIO(_png((600, 600), 'JPEG')), 'other.jpg')},
			format='multipart',
		)

		self.assertEqual(Profile.objects.get(user=self.user).avatar_content_type, 'image/png')
		self.assertEqual(Profile.objects.get(user=other).avatar_content_type, 'image/jpeg')

	def test_replacing_the_avatar_swaps_the_bytes_and_the_version(self):
		first_url = self.upload(_png((400, 400), 'PNG')).json()['avatarUrl']
		first_etag = self.client.get(self.avatar_path())['ETag']

		second_url = self.upload(
			_png((600, 600), 'JPEG'), filename='next.jpg'
		).json()['avatarUrl']

		self.assertNotEqual(first_url, second_url)
		self.assertNotEqual(first_etag, self.client.get(self.avatar_path())['ETag'])

	def test_remove_avatar_clears_the_row(self):
		from accounts.models import Profile
		self.upload(_png())

		response = self.client.patch(
			reverse('accounts:api_profile'), {'remove_avatar': True}, format='json'
		)

		self.assertEqual(response.status_code, 200)
		self.assertIsNone(response.json()['avatarUrl'])
		cleared = Profile.objects.get(user=self.user)
		self.assertIsNone(cleared.avatar)
		self.assertEqual(cleared.avatar_content_type, '')
		self.assertIsNone(cleared.avatar_updated_at)
		self.assertEqual(self.client.get(self.avatar_path()).status_code, 404)

	def test_replace_then_remove_ends_with_no_avatar(self):
		self.upload(_png((400, 400), 'PNG'))
		self.upload(_png((600, 600), 'JPEG'), filename='next.jpg')

		response = self.client.patch(
			reverse('accounts:api_profile'), {'remove_avatar': True}, format='json'
		)

		self.assertEqual(response.status_code, 200)
		self.assertIsNone(response.json()['avatarUrl'])

	def test_uploading_again_after_removing_works(self):
		self.upload(_png())
		self.client.patch(
			reverse('accounts:api_profile'), {'remove_avatar': True}, format='json'
		)

		response = self.upload(_png((500, 500), 'PNG'))

		self.assertEqual(response.status_code, 200)
		self.assertIsNotNone(response.json()['avatarUrl'])
		self.assertEqual(self.client.get(self.avatar_path()).status_code, 200)

	def test_no_file_is_written_to_the_media_root(self):
		import tempfile
		from pathlib import Path
		with tempfile.TemporaryDirectory() as media_root:
			with override_settings(MEDIA_ROOT=media_root):
				self.upload(_png())
				self.assertEqual(list(Path(media_root).rglob('*')), [])


class CrossDeviceAvatarTests(TestCase):
	"""Same account, two clients: an avatar set anywhere must be visible everywhere, with
	no shared filesystem and no per-tab state."""

	def setUp(self):
		import uuid
		self.password = uuid.uuid4().hex
		fields = _anonymous_account()
		fields['password'] = self.password
		self.user = CustomUser.objects.create_user(**fields)

	def sign_in_on_a_new_device(self):
		import io
		device = APIClient()
		data = device.post(
			reverse('accounts:api_login'),
			{'username': self.user.username, 'password': self.password},
			format='json',
		).json()
		device.credentials(HTTP_AUTHORIZATION=f"Bearer {data['access']}")
		return device

	def upload_from(self, device, size=(900, 300), fmt='PNG'):
		import io
		return device.patch(
			reverse('accounts:api_profile'),
			{'avatar': (io.BytesIO(_png(size, fmt)), 'shared.png')},
			format='multipart',
		)

	def avatar_url_for(self, device):
		return device.get(reverse('accounts:api_profile')).json()['avatarUrl']

	def test_avatar_uploaded_on_one_device_is_visible_on_another(self):
		from accounts.models import Profile
		first = self.sign_in_on_a_new_device()
		second = self.sign_in_on_a_new_device()

		self.upload_from(first)

		self.assertIsNotNone(self.avatar_url_for(second))
		self.assertEqual(Profile.objects.filter(user=self.user).count(), 1)

	def test_a_device_signed_in_before_the_upload_also_sees_it(self):
		stale_device = self.sign_in_on_a_new_device()
		self.assertIsNone(self.avatar_url_for(stale_device))

		self.upload_from(self.sign_in_on_a_new_device())

		self.assertIsNotNone(self.avatar_url_for(stale_device))

	def test_a_change_on_one_device_shows_on_the_other(self):
		first = self.sign_in_on_a_new_device()
		second = self.sign_in_on_a_new_device()
		self.upload_from(first, (900, 300), 'PNG')
		before = self.avatar_url_for(second)

		self.upload_from(first, (600, 600), 'JPEG')

		self.assertNotEqual(before, self.avatar_url_for(second))

	def test_a_removal_on_one_device_shows_on_the_other(self):
		first = self.sign_in_on_a_new_device()
		second = self.sign_in_on_a_new_device()
		self.upload_from(first)
		self.assertIsNotNone(self.avatar_url_for(second))

		first.patch(reverse('accounts:api_profile'), {'remove_avatar': True}, format='json')

		self.assertIsNone(self.avatar_url_for(second))

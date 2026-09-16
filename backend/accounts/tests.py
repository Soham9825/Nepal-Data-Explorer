from django.test import TestCase
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch
from rest_framework.test import APIClient

from accounts.models import CustomUser, EmailVerificationToken
from analytics.ml.moderation import find_profanity


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
		self.assertTrue(response.json().get('success'))
		self.user.refresh_from_db()
		self.assertTrue(self.user.email_verified)

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
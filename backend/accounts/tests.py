from django.test import TestCase
from django.test import override_settings
from django.urls import reverse
from unittest.mock import patch
from rest_framework.test import APIClient

from accounts.models import CustomUser
from analytics.ml.moderation import find_profanity


class ModerationTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(
			username='supporttester', email='user_email@gmail.com', password='test-password'
		)
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

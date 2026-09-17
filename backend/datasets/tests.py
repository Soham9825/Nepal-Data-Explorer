from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import CustomUser

from .csv_validation import MAX_FIELD_SIZE


class CSVValidationTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		user = CustomUser.objects.create_user(
			username='csvtester', email='csv.user@gmail.com', password='test-password'
		)
		self.client.force_authenticate(user=user)

	def upload(self, content):
		return self.client.post(
			reverse('datasets:validate_uploaded_csv'),
			{'file': SimpleUploadedFile('dataset.csv', content.encode(), content_type='text/csv')},
			format='multipart',
		)

	def test_valid_csv_reports_missing_values_and_measure(self):
		response = self.upload('year,province,value\n2024,Koshi,10\n2025,Koshi,\n')
		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertTrue(payload['valid'])
		self.assertEqual(payload['missing_cells'], 1)
		self.assertEqual(payload['schema']['numeric_columns'], ['year', 'value'])
		self.assertIn('province', payload['schema']['dimension_columns'])

	def test_multi_dimension_csv_reports_dimensions(self):
		response = self.upload('year,province,sector,value\n2024,Koshi,Tourism,10\n')
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['schema']['dimension_columns'], ['province', 'sector'])

	def test_duplicate_headers_are_rejected(self):
		response = self.upload('year,Value,value\n2024,1,2\n')
		self.assertEqual(response.status_code, 400)
		self.assertIn('Duplicate column headers', response.json()['detail'])

	def test_headerless_numeric_file_is_rejected(self):
		response = self.upload('2024,10\n2025,20\n')
		self.assertEqual(response.status_code, 400)
		payload = response.json()
		self.assertFalse(payload['valid'])
		self.assertIn('column headers', payload['detail'])

	def test_tab_delimited_file_is_accepted(self):
		response = self.upload('year\tprovince\tvalue\n2024\tKoshi\t10\n2025\tBagmati\t20\n')
		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.json()['valid'])

	def test_headers_only_file_is_rejected(self):
		response = self.upload('year,province,value\n')
		self.assertEqual(response.status_code, 400)
		self.assertIn('no data rows', response.json()['detail'])

	def test_inconsistent_delimiters_are_rejected(self):
		response = self.upload('a,b,c\n1,2;3\n4,5|6\n')
		self.assertEqual(response.status_code, 400)
		self.assertFalse(response.json()['valid'])

	def test_oversized_cell_is_rejected_gracefully(self):
		content = 'a,b\n"' + ('x' * (MAX_FIELD_SIZE + 1)) + '",1\n'
		response = self.upload(content)
		self.assertEqual(response.status_code, 400)
		self.assertFalse(response.json()['valid'])

	def test_upload_requires_authentication(self):
		self.client.logout()
		response = self.upload('year,value\n2024,10\n')
		self.assertIn(response.status_code, (401, 403))

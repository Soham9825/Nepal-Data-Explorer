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


class CSVPreprocessTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		user = CustomUser.objects.create_user(
			username='csvprep', email='prep.user@gmail.com', password='test-password'
		)
		self.client.force_authenticate(user=user)

	def prepare(self, content, **post):
		data = {'file': SimpleUploadedFile('dataset.csv', content.encode(), content_type='text/csv')}
		for name, value in post.items():
			data[name] = value
		return self.client.post(
			reverse('datasets:prepare_uploaded_csv'),
			data,
			format='multipart',
		)

	def test_typed_rows_with_missing_values(self):
		response = self.prepare('year,province,value\n2024,Koshi,"1,000"\n2025,Koshi,\n2026,Lumbini,"$2.5M"\n')
		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertTrue(payload['valid'])
		self.assertEqual([row['value'] for row in payload['rows']], [1000.0, None, 2500000.0])
		self.assertEqual(payload['columns'][2]['missing'], 1)
		self.assertEqual(payload['types']['value'], 'numeric')
		self.assertEqual(payload['types']['province'], 'categorical')

	def test_percentage_and_negative_parentheses_are_cleaned(self):
		response = self.prepare('name,growth\nA,12.5%\nB,(3)\nC,n/a\n')
		payload = response.json()
		self.assertEqual([row['growth'] for row in payload['rows']], [12.5, -3.0, None])

	def test_forward_fill_transform(self):
		content = 'year,value\n2020,10\n2021,\n2022,\n2023,40\n'
		response = self.prepare(content, transforms='{"value": "forward"}')
		payload = response.json()
		self.assertEqual([row['value'] for row in payload['rows']], [10.0, 10.0, 10.0, 40.0])
		self.assertEqual(payload['cleaning']['transforms']['value']['filled'], 2)

	def test_mean_and_drop_transforms(self):
		content = 'year,value\n2020,10\n2021,\n2022,30\n'
		payload = self.prepare(content, transforms='{"value": "mean"}').json()
		self.assertEqual([row['value'] for row in payload['rows']], [10.0, 20.0, 30.0])
		payload = self.prepare(content, transforms='{"value": "drop"}').json()
		self.assertEqual([row['value'] for row in payload['rows']], [10.0, 30.0])
		self.assertEqual(payload['cleaning']['transforms']['value']['rows_dropped'], 1)

	def test_all_empty_rows_are_dropped_and_reported(self):
		response = self.prepare('a,b\n1,x\n,\n2,y\n')
		payload = response.json()
		self.assertEqual(len(payload['rows']), 2)
		self.assertEqual(payload['cleaning']['rows_kept'], 2)
		self.assertEqual(payload['cleaning']['rows_dropped_all_missing'], 1)
		self.assertIn('all-empty', payload['warnings'][-1])
		self.assertEqual(payload['row_count'], 2)

	def test_typed_parser_drops_all_missing_rows(self):
		from .csv_preprocess import parse_typed_rows
		headers = ['a', 'b']
		rows, errors, dropped = parse_typed_rows(headers, [
			{'a': '1', 'b': 'x'},
			{'a': '', 'b': 'n/a'},
			{'a': '2', 'b': 'y'},
		], {'a': 'numeric', 'b': 'categorical'})
		self.assertEqual(len(rows), 2)
		self.assertEqual(dropped, 1)

	def test_type_override_relabels_numeric_text(self):
		response = self.prepare('code,label\nA01,First\nB02,\n', types='{"code": "text"}')
		payload = response.json()
		self.assertEqual(payload['types']['code'], 'text')
		self.assertEqual(payload['columns'][0]['type'], 'text')

	def test_boolean_column_typing(self):
		response = self.prepare('name,active\nA,yes\nB,false\nC,\n')
		payload = response.json()
		self.assertEqual(payload['types']['active'], 'boolean')
		self.assertEqual([row['active'] for row in payload['rows']], [True, False, None])

	def test_invalid_transform_is_rejected(self):
		response = self.prepare('a,b\n1,2\n', transforms='{bad json')
		self.assertEqual(response.status_code, 400)
		self.assertFalse(response.json()['valid'])

	def test_prepare_requires_authentication(self):
		self.client.logout()
		response = self.prepare('year,value\n2024,10\n')
		self.assertIn(response.status_code, (401, 403))


class CSVQualityTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		user = CustomUser.objects.create_user(
			username='qualitytester', email='quality.user@gmail.com', password='test-password'
		)
		self.client.force_authenticate(user=user)

	def prepare(self, content, **post):
		data = {'file': SimpleUploadedFile('dataset.csv', content.encode('utf-8'), content_type='text/csv')}
		for name, value in post.items():
			data[name] = value
		return self.client.post(
			reverse('datasets:prepare_uploaded_csv'),
			data,
			format='multipart',
		)

	def test_quality_analysis_detection_and_statuses(self):
		content = (
			'hotel_name,latitude,longitude,price,rating,check_in\n'
			'Hotel Annapurna,27.712,85.318,4500,4.5,2025-01-15\n'
			'Hotel Pokhara,28.209,83.985,3200,,2025-01-16\n'
			'Bad Row,200.0,85.318,-500,12,not-a-date\n'
			'=1+1,27.712,85.318,4500,4.5,2025-01-15\n'
			'Hotel Annapurna,27.712,85.318,4500,4.5,2025-01-15\n'
		)
		response = self.prepare(content)
		self.assertEqual(response.status_code, 200)
		payload = response.json()
		self.assertIn('quality', payload)
		quality = payload['quality']

		self.assertEqual(quality['summary']['records'], 5)
		self.assertEqual(quality['summary']['invalid'], 1)  # Bad Row
		self.assertGreaterEqual(quality['summary']['warning'], 2)  # Missing rating, formula, duplicate
		self.assertGreaterEqual(quality['summary']['duplicates'], 1)
		self.assertGreaterEqual(quality['summary']['formula_cells'], 1)

		# Column detection
		detected = quality['detected']
		self.assertIn('latitude', detected['latitude_columns'])
		self.assertIn('longitude', detected['longitude_columns'])
		self.assertIn('price', detected['price_columns'])
		self.assertIn('rating', detected['rating_columns'])
		self.assertIn('check_in', detected['date_columns'])
		self.assertIn('hotel_name', detected['name_columns'])

from django.db import models


class ForecastArtifact(models.Model):
	STATUS_CHOICES = [
		("trained", "Trained"),
		("failed", "Failed"),
		("archived", "Archived"),
	]

	series_name = models.CharField(max_length=150, db_index=True)
	series_key = models.CharField(max_length=300, db_index=True)
	model_name = models.CharField(max_length=150)
	frequency = models.CharField(max_length=20, db_index=True)
	target_field = models.CharField(max_length=150)
	group_fields = models.JSONField(default=list, blank=True)
	horizon = models.PositiveIntegerField(default=12)
	train_start = models.CharField(max_length=50, blank=True)
	train_end = models.CharField(max_length=50, blank=True)
	test_start = models.CharField(max_length=50, blank=True)
	test_end = models.CharField(max_length=50, blank=True)
	metrics = models.JSONField(default=dict, blank=True)
	feature_config = models.JSONField(default=dict, blank=True)
	residual_std = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
	model_path = models.CharField(max_length=500)
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="trained", db_index=True)
	is_active = models.BooleanField(default=True)
	notes = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-created_at", "series_name", "series_key"]
		indexes = [
			models.Index(fields=["series_name", "series_key"]),
			models.Index(fields=["status", "is_active"]),
		]

	def __str__(self):
		return f"{self.series_name} - {self.series_key} ({self.model_name})"


class ForecastPoint(models.Model):
	SPLIT_CHOICES = [
		("validation", "Validation"),
		("future", "Future"),
	]

	artifact = models.ForeignKey(ForecastArtifact, related_name="points", on_delete=models.CASCADE)
	series_key = models.CharField(max_length=300, db_index=True)
	period_label = models.CharField(max_length=80)
	period_start = models.DateField(null=True, blank=True)
	period_end = models.DateField(null=True, blank=True)
	step_ahead = models.PositiveIntegerField()
	actual_value = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
	predicted_value = models.DecimalField(max_digits=20, decimal_places=4)
	lower_bound = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
	upper_bound = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
	split = models.CharField(max_length=20, choices=SPLIT_CHOICES, db_index=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["artifact_id", "series_key", "step_ahead", "period_label"]
		constraints = [
			models.UniqueConstraint(
				fields=["artifact", "series_key", "step_ahead", "period_label", "split"],
				name="unique_forecast_point_record",
			)
		]

	def __str__(self):
		return f"{self.artifact_id} - {self.series_key} - {self.period_label}"


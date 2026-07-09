from django.contrib import admin

from .models import ForecastArtifact, ForecastPoint


@admin.register(ForecastArtifact)
class ForecastArtifactAdmin(admin.ModelAdmin):
	list_display = (
		"series_name",
		"series_key",
		"model_name",
		"frequency",
		"horizon",
		"status",
		"is_active",
		"created_at",
	)
	list_filter = ("series_name", "frequency", "status", "is_active")
	search_fields = ("series_name", "series_key", "model_name", "notes")


@admin.register(ForecastPoint)
class ForecastPointAdmin(admin.ModelAdmin):
	list_display = (
		"artifact",
		"series_key",
		"period_label",
		"step_ahead",
		"split",
		"predicted_value",
		"actual_value",
	)
	list_filter = ("split",)
	search_fields = ("series_key", "period_label")
